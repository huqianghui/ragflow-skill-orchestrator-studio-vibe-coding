from datetime import datetime

from pydantic import BaseModel, Field


class TargetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    target_type: str = Field(..., pattern=r"^(azure_ai_search|mysql|postgresql|cosmosdb|neo4j)$")
    connection_config: dict = Field(default_factory=dict)
    field_mappings: dict = Field(default_factory=dict)
    pipeline_id: str | None = None


class TargetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    connection_config: dict | None = None
    field_mappings: dict | None = None
    status: str | None = Field(default=None, pattern=r"^(active|inactive|error)$")
    pipeline_id: str | None = None


class TargetResponse(BaseModel):
    id: str
    name: str
    description: str | None
    target_type: str
    connection_config: dict
    field_mappings: dict
    status: str
    pipeline_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
