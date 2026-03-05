from datetime import datetime

from pydantic import BaseModel, Field


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    skill_type: str = Field(..., pattern=r"^(builtin|web_api|config_template|python_code)$")
    config_schema: dict = Field(default_factory=dict)
    is_builtin: bool = False


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    skill_type: str | None = Field(
        default=None, pattern=r"^(builtin|web_api|config_template|python_code)$"
    )
    config_schema: dict | None = None


class SkillResponse(BaseModel):
    id: str
    name: str
    description: str | None
    skill_type: str
    config_schema: dict
    is_builtin: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
