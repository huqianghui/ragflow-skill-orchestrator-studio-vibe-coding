from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.workflow_run import PipelineRun, WorkflowRun
from app.schemas.common import PaginatedResponse
from app.schemas.workflow_run import (
    PipelineRunResponse,
    WorkflowRunDetailResponse,
    WorkflowRunResponse,
)
from app.utils.exceptions import NotFoundException
from app.utils.pagination import paginate, pagination_params

router = APIRouter(prefix="/workflow-runs", tags=["workflow-runs"])


@router.get("", response_model=PaginatedResponse[WorkflowRunResponse])
async def list_workflow_runs(
    workflow_id: str | None = None,
    params: dict = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = params["page"], params["page_size"]
    offset = (page - 1) * page_size

    query = select(WorkflowRun)
    count_query = select(func.count(WorkflowRun.id))
    if workflow_id:
        query = query.where(WorkflowRun.workflow_id == workflow_id)
        count_query = count_query.where(WorkflowRun.workflow_id == workflow_id)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    result = await db.execute(
        query.order_by(WorkflowRun.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [WorkflowRunResponse.model_validate(r) for r in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.get("/{run_id}", response_model=WorkflowRunDetailResponse)
async def get_workflow_run(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
    wf_run = result.scalar_one_or_none()
    if not wf_run:
        raise NotFoundException("WorkflowRun", run_id)

    # Load pipeline runs
    pr_result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.workflow_run_id == run_id)
        .order_by(PipelineRun.created_at)
    )
    pipeline_runs = [PipelineRunResponse.model_validate(pr) for pr in pr_result.scalars().all()]

    detail = WorkflowRunDetailResponse.model_validate(wf_run)
    detail.pipeline_runs = pipeline_runs
    return detail
