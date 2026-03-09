"""Dashboard aggregation API — single endpoint returning all stats."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    AgentConfig,
    Connection,
    DataSource,
    Pipeline,
    Run,
    Skill,
    Target,
    Workflow,
    WorkflowRun,
)
from app.schemas.dashboard import (
    AgentBreakdown,
    DashboardStats,
    RecentWorkflowRun,
    ResourceCounts,
    SkillBreakdown,
    WorkflowRunStats,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
) -> DashboardStats:
    """Return aggregated dashboard statistics in a single response."""

    # --- Resource counts ---
    skills_total = (await db.execute(select(func.count()).select_from(Skill))).scalar() or 0
    connections_total = (
        await db.execute(select(func.count()).select_from(Connection))
    ).scalar() or 0
    pipelines_total = (await db.execute(select(func.count()).select_from(Pipeline))).scalar() or 0
    ds_total = (await db.execute(select(func.count()).select_from(DataSource))).scalar() or 0
    targets_total = (await db.execute(select(func.count()).select_from(Target))).scalar() or 0
    workflows_total = (await db.execute(select(func.count()).select_from(Workflow))).scalar() or 0
    wr_total = (await db.execute(select(func.count()).select_from(WorkflowRun))).scalar() or 0
    runs_total = (await db.execute(select(func.count()).select_from(Run))).scalar() or 0
    agents_total = (await db.execute(select(func.count()).select_from(AgentConfig))).scalar() or 0

    counts = ResourceCounts(
        skills=skills_total,
        connections=connections_total,
        pipelines=pipelines_total,
        data_sources=ds_total,
        targets=targets_total,
        workflows=workflows_total,
        workflow_runs=wr_total,
        runs=runs_total,
        agents=agents_total,
    )

    # --- Skill breakdown ---
    builtin_count = (
        await db.execute(select(func.count()).select_from(Skill).where(Skill.is_builtin.is_(True)))
    ).scalar() or 0
    skill_breakdown = SkillBreakdown(
        builtin=builtin_count,
        custom=skills_total - builtin_count,
    )

    # --- Agent breakdown ---
    available_count = (
        await db.execute(
            select(func.count()).select_from(AgentConfig).where(AgentConfig.available.is_(True))
        )
    ).scalar() or 0
    agent_breakdown = AgentBreakdown(
        available=available_count,
        unavailable=agents_total - available_count,
    )

    # --- WorkflowRun stats ---
    completed_count = (
        await db.execute(
            select(func.count()).select_from(WorkflowRun).where(WorkflowRun.status == "completed")
        )
    ).scalar() or 0
    failed_count = (
        await db.execute(
            select(func.count()).select_from(WorkflowRun).where(WorkflowRun.status == "failed")
        )
    ).scalar() or 0
    running_count = (
        await db.execute(
            select(func.count()).select_from(WorkflowRun).where(WorkflowRun.status == "running")
        )
    ).scalar() or 0
    pending_count = (
        await db.execute(
            select(func.count()).select_from(WorkflowRun).where(WorkflowRun.status == "pending")
        )
    ).scalar() or 0

    finished_total = completed_count + failed_count
    success_rate = round(completed_count / finished_total * 100, 1) if finished_total > 0 else 0.0

    workflow_run_stats = WorkflowRunStats(
        success_rate=success_rate,
        completed=completed_count,
        failed=failed_count,
        running=running_count,
        pending=pending_count,
    )

    # --- Recent workflow runs (last 5) ---
    recent_rows = (
        (await db.execute(select(WorkflowRun).order_by(WorkflowRun.created_at.desc()).limit(5)))
        .scalars()
        .all()
    )

    recent_workflow_runs = [
        RecentWorkflowRun(
            id=r.id,
            workflow_id=r.workflow_id,
            status=r.status,
            total_files=r.total_files,
            processed_files=r.processed_files,
            failed_files=r.failed_files,
            started_at=str(r.started_at) if r.started_at else None,
            finished_at=str(r.finished_at) if r.finished_at else None,
        )
        for r in recent_rows
    ]

    return DashboardStats(
        counts=counts,
        skill_breakdown=skill_breakdown,
        agent_breakdown=agent_breakdown,
        workflow_run_stats=workflow_run_stats,
        recent_workflow_runs=recent_workflow_runs,
    )
