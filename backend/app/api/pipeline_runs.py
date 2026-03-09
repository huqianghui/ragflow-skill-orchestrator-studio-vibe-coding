"""Unified Pipeline Runs API — merges runs + pipeline_runs tables."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Pipeline, PipelineRun, Run
from app.schemas.pipeline_runs import UnifiedPipelineRun

router = APIRouter(prefix="/pipeline-runs", tags=["pipeline-runs"])


@router.get("")
async def list_pipeline_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: str | None = Query(None, pattern="^(standalone|workflow)$"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List pipeline runs from both runs and pipeline_runs tables."""

    # Sub-query: standalone runs from `runs` table
    standalone_q = select(
        Run.id.label("id"),
        Run.pipeline_id.label("pipeline_id"),
        Run.status.label("status"),
        literal("standalone").label("source"),
        Run.total_documents.label("total_files"),
        Run.processed_documents.label("processed_files"),
        Run.failed_documents.label("failed_files"),
        literal(None).label("workflow_run_id"),
        Run.error_message.label("error_message"),
        Run.started_at.label("started_at"),
        Run.finished_at.label("finished_at"),
        Run.created_at.label("created_at"),
    )

    # Sub-query: workflow pipeline runs from `pipeline_runs` table
    workflow_q = select(
        PipelineRun.id.label("id"),
        PipelineRun.pipeline_id.label("pipeline_id"),
        PipelineRun.status.label("status"),
        literal("workflow").label("source"),
        PipelineRun.total_files.label("total_files"),
        PipelineRun.processed_files.label("processed_files"),
        PipelineRun.failed_files.label("failed_files"),
        PipelineRun.workflow_run_id.label("workflow_run_id"),
        PipelineRun.error_message.label("error_message"),
        PipelineRun.started_at.label("started_at"),
        PipelineRun.finished_at.label("finished_at"),
        PipelineRun.created_at.label("created_at"),
    )

    # Apply source filter
    if source == "standalone":
        combined = standalone_q.subquery()
    elif source == "workflow":
        combined = workflow_q.subquery()
    else:
        combined = union_all(standalone_q, workflow_q).subquery()

    # Count total
    count_result = await db.execute(select(func.count()).select_from(combined))
    total = count_result.scalar() or 0

    # Paginated query with Pipeline name join
    offset = (page - 1) * page_size
    rows_q = (
        select(combined, Pipeline.name.label("pipeline_name"))
        .outerjoin(Pipeline, combined.c.pipeline_id == Pipeline.id)
        .order_by(combined.c.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(rows_q)
    rows = result.all()

    items = [
        UnifiedPipelineRun(
            id=str(r.id),
            pipeline_id=str(r.pipeline_id),
            pipeline_name=r.pipeline_name,
            status=r.status,
            source=r.source,
            total_files=r.total_files or 0,
            processed_files=r.processed_files or 0,
            failed_files=r.failed_files or 0,
            workflow_run_id=str(r.workflow_run_id) if r.workflow_run_id else None,
            error_message=r.error_message,
            started_at=str(r.started_at) if r.started_at else None,
            finished_at=str(r.finished_at) if r.finished_at else None,
            created_at=str(r.created_at),
        )
        for r in rows
    ]

    total_pages = (total + page_size - 1) // page_size
    return {
        "items": [item.model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }
