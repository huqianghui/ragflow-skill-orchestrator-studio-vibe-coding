from datetime import datetime

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Run(BaseModel):
    __tablename__ = "runs"

    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"), index=True)
    datasource_id: Mapped[str | None] = mapped_column(ForeignKey("data_sources.id"), default=None)
    target_id: Mapped[str | None] = mapped_column(ForeignKey("targets.id"), default=None)
    # pending | running | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(20), default="pending")
    mode: Mapped[str] = mapped_column(String(10), default="sync")  # sync, async
    started_at: Mapped[datetime | None] = mapped_column(default=None)
    finished_at: Mapped[datetime | None] = mapped_column(default=None)
    total_documents: Mapped[int] = mapped_column(default=0)
    processed_documents: Mapped[int] = mapped_column(default=0)
    failed_documents: Mapped[int] = mapped_column(default=0)
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    metrics: Mapped[dict | None] = mapped_column(JSON, default=None)
