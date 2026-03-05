from datetime import datetime

from pydantic import BaseModel, Field


class PipelineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    graph_data: dict = Field(default_factory=lambda: {"nodes": [], "edges": []})


class PipelineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(default=None, pattern=r"^(draft|validated|active|archived)$")
    graph_data: dict | None = None


class PipelineResponse(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    graph_data: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
