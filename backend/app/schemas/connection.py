from datetime import datetime

from pydantic import BaseModel, Field

CONNECTION_TYPES = (
    "azure_openai",
    "openai",
    "azure_doc_intelligence",
    "azure_content_understanding",
    "azure_ai_foundry",
    "http_api",
)

# Fields that contain secrets per connection type
SECRET_FIELDS: dict[str, list[str]] = {
    "azure_openai": ["api_key"],
    "openai": ["api_key"],
    "azure_doc_intelligence": ["api_key"],
    "azure_content_understanding": ["api_key"],
    "azure_ai_foundry": ["api_key"],
    "http_api": ["auth_value"],
}


def mask_secret(value: str) -> str:
    if not value or len(value) <= 8:
        return "****"
    return f"{value[:4]}****{value[-4:]}"


def mask_config(config: dict, connection_type: str) -> dict:
    """Replace secret fields in config with masked values."""
    fields = SECRET_FIELDS.get(connection_type, [])
    masked = config.copy()
    for field in fields:
        if field in masked and masked[field]:
            masked[field] = mask_secret(masked[field])
    return masked


class ConnectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    connection_type: str = Field(
        ...,
        pattern=r"^(azure_openai|openai|azure_doc_intelligence"
        r"|azure_content_understanding|azure_ai_foundry|http_api)$",
    )
    description: str | None = None
    config: dict = Field(default_factory=dict)


class ConnectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    config: dict | None = None


class ConnectionResponse(BaseModel):
    id: str
    name: str
    connection_type: str
    description: str | None
    config: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
