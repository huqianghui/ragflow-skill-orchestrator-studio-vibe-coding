from datetime import datetime

from pydantic import BaseModel, Field

TARGET_TYPES = (
    "azure_ai_search",
    "azure_blob",
    "cosmosdb_gremlin",
    "neo4j",
    "mysql",
    "postgresql",
)

_TARGET_TYPE_PATTERN = r"^(" + "|".join(TARGET_TYPES) + r")$"

# Fields that contain secrets per target type
SECRET_FIELDS: dict[str, list[str]] = {
    "azure_ai_search": ["api_key"],
    "azure_blob": ["connection_string"],
    "cosmosdb_gremlin": ["primary_key"],
    "neo4j": ["password"],
    "mysql": ["password"],
    "postgresql": ["password"],
}


def mask_secret(value: str) -> str:
    if not value or len(value) <= 8:
        return "****"
    return f"{value[:4]}****{value[-4:]}"


def mask_config(config: dict, target_type: str) -> dict:
    """Replace secret fields in config with masked values."""
    fields = SECRET_FIELDS.get(target_type, [])
    masked = config.copy()
    for field in fields:
        if field in masked and masked[field]:
            masked[field] = mask_secret(masked[field])
    return masked


class TargetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    target_type: str = Field(..., pattern=_TARGET_TYPE_PATTERN)
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


class TargetTestResult(BaseModel):
    success: bool
    message: str


class TargetSchemaField(BaseModel):
    name: str
    type: str
    searchable: bool | None = None
    filterable: bool | None = None
    nullable: bool | None = None
    key: bool | None = None
    vector_config: dict | None = None


class TargetSchemaDiscovery(BaseModel):
    exists: bool
    schema_fields: list[TargetSchemaField] | None = None
    suggested_schema: list[TargetSchemaField] | None = None


class MappingValidationResult(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
