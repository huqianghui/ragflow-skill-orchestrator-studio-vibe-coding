from datetime import datetime

from pydantic import BaseModel, Field


class DataSourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    source_type: str = Field(..., pattern=r"^(local_upload|azure_blob)$")
    connection_config: dict = Field(default_factory=dict)
    pipeline_id: str | None = None


class DataSourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    connection_config: dict | None = None
    status: str | None = Field(default=None, pattern=r"^(active|inactive|error)$")
    pipeline_id: str | None = None


class DataSourceResponse(BaseModel):
    id: str
    name: str
    description: str | None
    source_type: str
    connection_config: dict
    status: str
    file_count: int
    total_size: int
    pipeline_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
