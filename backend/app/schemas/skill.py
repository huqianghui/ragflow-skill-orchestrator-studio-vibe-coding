from datetime import datetime

from pydantic import BaseModel, Field


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    skill_type: str = Field(..., pattern=r"^(builtin|web_api|config_template|python_code)$")
    config_schema: dict = Field(default_factory=dict)
    is_builtin: bool = False
    source_code: str | None = None
    additional_requirements: str | None = None
    test_input: dict | None = None
    connection_mappings: dict | None = None
    required_resource_types: list[str] | None = None


class SkillUpdate(BaseModel):
    description: str | None = None
    skill_type: str | None = Field(
        default=None, pattern=r"^(builtin|web_api|config_template|python_code)$"
    )
    config_schema: dict | None = None
    source_code: str | None = None
    additional_requirements: str | None = None
    test_input: dict | None = None
    connection_mappings: dict | None = None


class SkillConfigureRequest(BaseModel):
    """Update runtime configuration for a built-in skill."""

    config_values: dict | None = None
    bound_connection_id: str | None = None


class SkillResponse(BaseModel):
    id: str
    name: str
    description: str | None
    skill_type: str
    config_schema: dict
    is_builtin: bool
    source_code: str | None
    additional_requirements: str | None
    test_input: dict | None
    connection_mappings: dict | None
    required_resource_types: list[str] | None
    bound_connection_id: str | None
    config_values: dict | None
    pipeline_io: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
