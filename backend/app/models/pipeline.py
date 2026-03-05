from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Pipeline(BaseModel):
    __tablename__ = "pipelines"

    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # draft | validated | active | archived
    status: Mapped[str] = mapped_column(String(20), default="draft")
    graph_data: Mapped[dict] = mapped_column(JSON, default=dict)  # {nodes: [], edges: []}
