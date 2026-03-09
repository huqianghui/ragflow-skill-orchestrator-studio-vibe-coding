from datetime import datetime

from pydantic import BaseModel


class PipelineRunResponse(BaseModel):
    id: str
    workflow_run_id: str
    pipeline_id: str
    route_name: str
    target_ids: list
    status: str
    total_files: int
    processed_files: int
    failed_files: int
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowRunResponse(BaseModel):
    id: str
    workflow_id: str
    status: str
    total_files: int
    processed_files: int
    failed_files: int
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowRunDetailResponse(WorkflowRunResponse):
    """WorkflowRun with nested PipelineRun records."""

    pipeline_runs: list[PipelineRunResponse] = []
