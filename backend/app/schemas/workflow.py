from datetime import datetime

from pydantic import BaseModel, Field


class FileFilter(BaseModel):
    extensions: list[str] | None = None
    mime_types: list[str] | None = None
    size_range: dict | None = None  # {min_bytes: int, max_bytes: int}
    path_pattern: str | None = None


class RouteRule(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    priority: int = Field(default=0, ge=0)
    file_filter: FileFilter = Field(default_factory=FileFilter)
    pipeline_id: str = Field(..., min_length=1)
    target_ids: list[str] = Field(default_factory=list)


class DefaultRoute(BaseModel):
    name: str = Field(default="default", max_length=255)
    pipeline_id: str = Field(..., min_length=1)
    target_ids: list[str] = Field(default_factory=list)


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    data_source_ids: list[str] = Field(default_factory=list)
    routes: list[RouteRule] = Field(default_factory=list)
    default_route: DefaultRoute | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(default=None, pattern=r"^(draft|active|archived)$")
    data_source_ids: list[str] | None = None
    routes: list[RouteRule] | None = None
    default_route: DefaultRoute | None = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    data_source_ids: list
    routes: list
    default_route: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
