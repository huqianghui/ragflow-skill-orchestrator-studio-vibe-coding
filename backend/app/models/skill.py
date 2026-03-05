from sqlalchemy import JSON, Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Skill(BaseModel):
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # builtin | web_api | config_template | python_code
    skill_type: Mapped[str] = mapped_column(String(50))
    config_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
