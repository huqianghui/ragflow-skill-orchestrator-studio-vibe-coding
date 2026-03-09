from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.workflow import Workflow
from app.schemas.common import PaginatedResponse
from app.schemas.workflow import WorkflowCreate, WorkflowResponse, WorkflowUpdate
from app.schemas.workflow_run import WorkflowRunDetailResponse
from app.utils.exceptions import NotFoundException
from app.utils.pagination import paginate, pagination_params

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("", response_model=PaginatedResponse[WorkflowResponse])
async def list_workflows(
    params: dict = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = params["page"], params["page_size"]
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(Workflow.id)))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Workflow).order_by(Workflow.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [WorkflowResponse.model_validate(w) for w in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(body: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    data = body.model_dump()
    # Convert Pydantic sub-models to dicts for JSON columns
    if data.get("routes"):
        data["routes"] = [r if isinstance(r, dict) else r for r in data["routes"]]
    if data.get("default_route") and not isinstance(data["default_route"], dict):
        data["default_route"] = dict(data["default_route"])

    workflow = Workflow(**data)
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return WorkflowResponse.model_validate(workflow)


@router.post("/{workflow_id}/run", response_model=WorkflowRunDetailResponse)
async def run_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    from app.services.workflow_executor import execute_workflow

    wf_run = await execute_workflow(workflow_id, db)

    # Load pipeline runs for detail response
    from app.models.workflow_run import PipelineRun
    from app.schemas.workflow_run import PipelineRunResponse

    pr_result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.workflow_run_id == wf_run.id)
        .order_by(PipelineRun.created_at)
    )
    pipeline_runs = [PipelineRunResponse.model_validate(pr) for pr in pr_result.scalars().all()]

    detail = WorkflowRunDetailResponse.model_validate(wf_run)
    detail.pipeline_runs = pipeline_runs
    return detail


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise NotFoundException("Workflow", workflow_id)
    return WorkflowResponse.model_validate(workflow)


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str, body: WorkflowUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise NotFoundException("Workflow", workflow_id)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(workflow, key, value)

    await db.commit()
    await db.refresh(workflow)
    return WorkflowResponse.model_validate(workflow)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise NotFoundException("Workflow", workflow_id)

    await db.delete(workflow)
    await db.commit()
