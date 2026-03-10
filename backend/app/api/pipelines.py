import asyncio
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.pipeline import Pipeline
from app.models.run import Run
from app.models.skill import Skill
from app.schemas.common import PaginatedResponse
from app.schemas.pipeline import PipelineCreate, PipelineResponse, PipelineUpdate
from app.schemas.skill import SkillResponse
from app.utils.exceptions import NotFoundException, ValidationException
from app.utils.pagination import paginate, pagination_params

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


@router.get("", response_model=PaginatedResponse[PipelineResponse])
async def list_pipelines(
    params: dict = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = params["page"], params["page_size"]
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(Pipeline.id)))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Pipeline).order_by(Pipeline.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [PipelineResponse.model_validate(p) for p in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.post("", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline(body: PipelineCreate, db: AsyncSession = Depends(get_db)):
    pipeline = Pipeline(**body.model_dump())
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
    return PipelineResponse.model_validate(pipeline)


# -- Static routes MUST be defined before /{pipeline_id} --


@router.get("/available-skills", response_model=list[SkillResponse])
async def get_available_skills(db: AsyncSession = Depends(get_db)):
    """Return all skills with their pipeline_io metadata."""
    result = await db.execute(select(Skill).order_by(Skill.name))
    return [SkillResponse.model_validate(s) for s in result.scalars().all()]


@router.get("/templates")
async def get_pipeline_templates():
    """Return available pipeline templates."""
    from app.data.pipeline_templates import PIPELINE_TEMPLATES

    return PIPELINE_TEMPLATES


@router.get("/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(pipeline_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise NotFoundException("Pipeline", pipeline_id)
    return PipelineResponse.model_validate(pipeline)


@router.put("/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(
    pipeline_id: str, body: PipelineUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise NotFoundException("Pipeline", pipeline_id)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pipeline, key, value)

    await db.commit()
    await db.refresh(pipeline)
    return PipelineResponse.model_validate(pipeline)


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(pipeline_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise NotFoundException("Pipeline", pipeline_id)

    await db.delete(pipeline)
    await db.commit()


@router.post("/{pipeline_id}/validate")
async def validate_pipeline(
    pipeline_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Validate that all node input sources are reachable from preceding outputs."""
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise NotFoundException("Pipeline", pipeline_id)

    nodes = (pipeline.graph_data or {}).get("nodes", [])
    if not nodes:
        return {
            "valid": False,
            "errors": [{"message": "Pipeline has no nodes"}],
        }

    sorted_nodes = sorted(nodes, key=lambda n: n.get("position", 0))

    # Initial available paths
    available: set[str] = {"/document/file_content", "/document/file_name"}
    errors: list[dict] = []

    for node in sorted_nodes:
        node_id = node.get("id", "")
        node_label = node.get("label", node.get("skill_name", ""))
        ctx = node.get("context", "/document")

        for inp in node.get("inputs", []):
            source = inp.get("source", "")
            if not _source_reachable(source, available):
                errors.append(
                    {
                        "node_id": node_id,
                        "node_label": node_label,
                        "input_name": inp.get("name", ""),
                        "source": source,
                        "message": ("source path not available from preceding nodes"),
                    }
                )

        # Register outputs produced by this node
        for out in node.get("outputs", []):
            target_name = out.get("targetName", "")
            if target_name:
                output_path = f"{ctx}/{target_name}"
                available.add(output_path)

    if errors:
        return {"valid": False, "errors": errors}

    # Validation passed — update status
    pipeline.status = "validated"
    await db.commit()
    return {"valid": True, "errors": []}


def _source_reachable(source: str, available: set[str]) -> bool:
    """Check if a source path is reachable from available paths."""
    if not source:
        return False
    # Exact match
    if source in available:
        return True
    # Wildcard source: /document/chunks/*/text
    # Check if the array base path is available: /document/chunks
    if "/*/" in source:
        base = source.split("/*/")[0]
        if base in available:
            return True
    # Source ends with /*: /document/chunks/*
    if source.endswith("/*"):
        base = source[:-2]
        if base in available:
            return True
    # Check if a wildcard version of available covers this path
    # e.g., source="/document/chunks/*/text" and "/document/chunks/*/text" in available
    return False


@router.post("/{pipeline_id}/debug")
async def debug_pipeline(
    pipeline_id: str,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    """Upload a file and execute the pipeline for debugging."""
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise NotFoundException("Pipeline", pipeline_id)

    nodes = (pipeline.graph_data or {}).get("nodes", [])
    if not nodes:
        raise ValidationException("Pipeline has no nodes to execute")

    file_content = await file.read()
    file_name = file.filename or "uploaded_file"

    # Create a Run record before execution
    run = Run(
        pipeline_id=pipeline_id,
        status="running",
        mode="sync",
        total_documents=1,
        started_at=datetime.now(UTC),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    from app.services.pipeline.runner import PipelineRunner

    runner = PipelineRunner()
    timeout = get_settings().sync_execution_timeout_s

    pipeline_dict = {
        "graph_data": pipeline.graph_data,
    }

    try:
        debug_result = await asyncio.wait_for(
            runner.execute(pipeline_dict, file_content, file_name, db),
            timeout=timeout,
        )
    except TimeoutError:
        debug_result = {
            "status": "partial",
            "total_execution_time_ms": timeout * 1000,
            "enrichment_tree": {},
            "node_results": [],
            "error": f"Execution timed out after {timeout}s",
        }

    # Update Run record with execution result
    now = datetime.now(UTC)
    run_status = debug_result.get("status", "failed")
    if run_status == "success":
        run.status = "completed"
        run.processed_documents = 1
    elif run_status == "partial":
        run.status = "failed"
        run.failed_documents = 1
        run.error_message = debug_result.get("error")
    else:
        run.status = "failed"
        run.failed_documents = 1
        run.error_message = debug_result.get("error")

    run.finished_at = now
    run.metrics = {
        "total_execution_time_ms": debug_result.get("total_execution_time_ms"),
        "node_count": len(debug_result.get("node_results", [])),
    }
    await db.commit()

    debug_result["run_id"] = run.id
    return debug_result
