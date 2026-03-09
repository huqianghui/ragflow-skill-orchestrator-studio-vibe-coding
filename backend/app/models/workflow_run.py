from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class WorkflowRun(BaseModel):
    __tablename__ = "workflow_runs"

    workflow_id: Mapped[str] = mapped_column(String(), ForeignKey("workflows.id"), index=True)
    # pending | running | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(20), default="pending")
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    processed_files: Mapped[int] = mapped_column(Integer, default=0)
    failed_files: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    started_at: Mapped[str | None] = mapped_column(DateTime, default=None)
    finished_at: Mapped[str | None] = mapped_column(DateTime, default=None)


class PipelineRun(BaseModel):
    __tablename__ = "pipeline_runs"

    workflow_run_id: Mapped[str] = mapped_column(
        String(), ForeignKey("workflow_runs.id"), index=True
    )
    pipeline_id: Mapped[str] = mapped_column(String())
    route_name: Mapped[str] = mapped_column(String(255), default="")
    target_ids: Mapped[list] = mapped_column(JSON, default=list)
    # pending | running | completed | failed
    status: Mapped[str] = mapped_column(String(20), default="pending")
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    processed_files: Mapped[int] = mapped_column(Integer, default=0)
    failed_files: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    started_at: Mapped[str | None] = mapped_column(DateTime, default=None)
    finished_at: Mapped[str | None] = mapped_column(DateTime, default=None)
