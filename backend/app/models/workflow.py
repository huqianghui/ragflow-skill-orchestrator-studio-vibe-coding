from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Workflow(BaseModel):
    __tablename__ = "workflows"

    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # draft | active | archived
    status: Mapped[str] = mapped_column(String(20), default="draft")
    data_source_ids: Mapped[list] = mapped_column(JSON, default=list)
    routes: Mapped[list] = mapped_column(JSON, default=list)
    default_route: Mapped[dict | None] = mapped_column(JSON, default=None)
