"""Unified Pipeline Runs response schema — merges `runs` and `pipeline_runs` tables."""

from pydantic import BaseModel


class UnifiedPipelineRun(BaseModel):
    id: str
    pipeline_id: str
    pipeline_name: str | None = None
    status: str
    source: str  # "standalone" or "workflow"
    total_files: int = 0
    processed_files: int = 0
    failed_files: int = 0
    workflow_run_id: str | None = None
    error_message: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    created_at: str
