from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ProcessedFile(BaseModel):
    __tablename__ = "processed_files"
    __table_args__ = (
        UniqueConstraint("workflow_id", "data_source_id", "file_path", name="uq_processed_file"),
    )

    workflow_id: Mapped[str] = mapped_column(String(), ForeignKey("workflows.id"), index=True)
    data_source_id: Mapped[str] = mapped_column(String(), index=True)
    file_path: Mapped[str] = mapped_column(String())
    file_etag: Mapped[str | None] = mapped_column(String(), default=None)
    processed_at: Mapped[str | None] = mapped_column(DateTime, default=None)
