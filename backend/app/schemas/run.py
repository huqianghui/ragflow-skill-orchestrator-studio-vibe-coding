from datetime import datetime

from pydantic import BaseModel, Field


class RunCreate(BaseModel):
    pipeline_id: str
    datasource_id: str | None = None
    target_id: str | None = None
    mode: str = Field(default="sync", pattern=r"^(sync|async)$")


class RunResponse(BaseModel):
    id: str
    pipeline_id: str
    datasource_id: str | None
    target_id: str | None
    status: str
    mode: str
    started_at: datetime | None
    finished_at: datetime | None
    total_documents: int
    processed_documents: int
    failed_documents: int
    error_message: str | None
    metrics: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
