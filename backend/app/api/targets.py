from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.pipeline import Pipeline
from app.models.target import Target
from app.schemas.common import PaginatedResponse
from app.schemas.target import (
    SECRET_FIELDS,
    MappingValidationResult,
    TargetCreate,
    TargetResponse,
    TargetSchemaDiscovery,
    TargetSchemaField,
    TargetTestResult,
    TargetUpdate,
    mask_config,
)
from app.services.mapping_engine import apply_mapping, infer_pipeline_outputs, validate_mapping
from app.services.target_index_manager import create_search_index, infer_index_schema
from app.services.target_schema_discovery import discover_schema
from app.services.target_tester import run_target_test
from app.services.target_writer import write_to_target
from app.utils.exceptions import NotFoundException
from app.utils.pagination import paginate, pagination_params

router = APIRouter(prefix="/targets", tags=["targets"])


def _mask_response(t: Target) -> TargetResponse:
    """Build a response with secrets masked."""
    resp = TargetResponse.model_validate(t)
    resp.connection_config = mask_config(resp.connection_config, resp.target_type)
    return resp


def _preserve_secrets(new_config: dict, old_config: dict, target_type: str) -> dict:
    """Keep old secret values when the update sends masked placeholders."""
    secret_names = SECRET_FIELDS.get(target_type, [])
    merged = new_config.copy()
    for field in secret_names:
        val = merged.get(field, "")
        if not val or "****" in str(val):
            if field in old_config:
                merged[field] = old_config[field]
    return merged


# ── Standard CRUD ──


@router.get("", response_model=PaginatedResponse[TargetResponse])
async def list_targets(
    params: dict = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = params["page"], params["page_size"]
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(Target.id)))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Target).order_by(Target.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [_mask_response(t) for t in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.post("", response_model=TargetResponse, status_code=status.HTTP_201_CREATED)
async def create_target(body: TargetCreate, db: AsyncSession = Depends(get_db)):
    target = Target(**body.model_dump())
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return _mask_response(target)


@router.get("/{target_id}", response_model=TargetResponse)
async def get_target(target_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)
    return _mask_response(target)


@router.put("/{target_id}", response_model=TargetResponse)
async def update_target(target_id: str, body: TargetUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)

    update_data = body.model_dump(exclude_unset=True)

    # Preserve secrets that were masked in the response
    if "connection_config" in update_data and update_data["connection_config"]:
        update_data["connection_config"] = _preserve_secrets(
            update_data["connection_config"],
            target.connection_config or {},
            target.target_type,
        )

    for key, value in update_data.items():
        setattr(target, key, value)

    await db.commit()
    await db.refresh(target)
    return _mask_response(target)


@router.get("/{target_id}/discover-schema", response_model=TargetSchemaDiscovery)
async def discover_target_schema(target_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)

    discovery = await discover_schema(target.target_type, target.connection_config or {})

    # For AI Search: if index not found and pipeline_id is set, infer suggested schema
    if target.target_type == "azure_ai_search" and not discovery.exists and target.pipeline_id:
        pipe_result = await db.execute(select(Pipeline).where(Pipeline.id == target.pipeline_id))
        pipeline = pipe_result.scalar_one_or_none()
        if pipeline:
            pipeline_dict = {"graph_data": pipeline.graph_data or {}}
            discovery.suggested_schema = infer_index_schema(pipeline_dict, target.field_mappings)

    return discovery


class CreateIndexBody(BaseModel):
    index_definition: list[TargetSchemaField] | None = Field(default=None)


@router.post("/{target_id}/create-index")
async def create_target_index(
    target_id: str,
    body: CreateIndexBody | None = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)

    schema = body.index_definition if body and body.index_definition else None

    # If no schema provided, infer from pipeline
    if not schema and target.pipeline_id:
        pipe_result = await db.execute(select(Pipeline).where(Pipeline.id == target.pipeline_id))
        pipeline = pipe_result.scalar_one_or_none()
        if pipeline:
            pipeline_dict = {"graph_data": pipeline.graph_data or {}}
            schema = infer_index_schema(pipeline_dict, target.field_mappings)

    if not schema:
        return {"error": "No index definition provided and no pipeline to infer from"}

    index_result = await create_search_index(target.connection_config or {}, schema)
    return index_result


@router.get("/{target_id}/pipeline-outputs")
async def get_pipeline_outputs(
    target_id: str,
    pipeline_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)

    pid = pipeline_id or target.pipeline_id
    if not pid:
        return {"outputs": [], "message": "No pipeline_id provided"}

    pipe_result = await db.execute(select(Pipeline).where(Pipeline.id == pid))
    pipeline = pipe_result.scalar_one_or_none()
    if not pipeline:
        return {"outputs": [], "message": f"Pipeline '{pid}' not found"}

    outputs = infer_pipeline_outputs({"graph_data": pipeline.graph_data or {}})
    return {"outputs": outputs}


class ValidateMappingBody(BaseModel):
    field_mappings: dict
    pipeline_id: str | None = None


@router.post("/{target_id}/validate-mapping", response_model=MappingValidationResult)
async def validate_target_mapping(
    target_id: str,
    body: ValidateMappingBody,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)

    # Get pipeline outputs
    pipeline_outputs: list[dict] = []
    pid = body.pipeline_id or target.pipeline_id
    if pid:
        pipe_result = await db.execute(select(Pipeline).where(Pipeline.id == pid))
        pipeline = pipe_result.scalar_one_or_none()
        if pipeline:
            pipeline_outputs = infer_pipeline_outputs({"graph_data": pipeline.graph_data or {}})

    # Get target schema
    discovery = await discover_schema(target.target_type, target.connection_config or {})
    target_schema = discovery.schema_fields or []

    return validate_mapping(
        target.target_type,
        body.field_mappings,
        pipeline_outputs,
        target_schema,
    )


class WriteBody(BaseModel):
    pipeline_id: str | None = None
    records: list[dict] | None = None
    data: dict | None = None


@router.post("/{target_id}/write")
async def write_to_target_endpoint(
    target_id: str,
    body: WriteBody,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)

    fm = target.field_mappings or {}

    if body.records:
        records = body.records
    elif body.data:
        records = apply_mapping(fm, body.data)
    else:
        return {"error": "Provide either 'records' or 'data'"}

    write_result = await write_to_target(
        target.target_type, target.connection_config or {}, fm, records
    )
    return {
        "success": write_result.success,
        "records_written": write_result.records_written,
        "errors": write_result.errors,
    }


@router.post("/{target_id}/test", response_model=TargetTestResult)
async def test_target(target_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)
    test_result = await run_target_test(target.target_type, target.connection_config or {})
    return TargetTestResult(success=test_result.success, message=test_result.message)


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_target(target_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)

    await db.delete(target)
    await db.commit()
