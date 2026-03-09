"""Dashboard stats response schema."""

from pydantic import BaseModel


class ResourceCounts(BaseModel):
    skills: int = 0
    connections: int = 0
    pipelines: int = 0
    data_sources: int = 0
    targets: int = 0
    workflows: int = 0
    workflow_runs: int = 0
    runs: int = 0
    agents: int = 0


class SkillBreakdown(BaseModel):
    builtin: int = 0
    custom: int = 0


class AgentBreakdown(BaseModel):
    available: int = 0
    unavailable: int = 0


class WorkflowRunStats(BaseModel):
    success_rate: float = 0.0
    completed: int = 0
    failed: int = 0
    running: int = 0
    pending: int = 0


class RecentWorkflowRun(BaseModel):
    id: str
    workflow_id: str
    status: str
    total_files: int
    processed_files: int
    failed_files: int
    started_at: str | None = None
    finished_at: str | None = None


class DashboardStats(BaseModel):
    counts: ResourceCounts
    skill_breakdown: SkillBreakdown
    agent_breakdown: AgentBreakdown
    workflow_run_stats: WorkflowRunStats
    recent_workflow_runs: list[RecentWorkflowRun]
