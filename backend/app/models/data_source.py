from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class DataSource(BaseModel):
    __tablename__ = "data_sources"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    source_type: Mapped[str] = mapped_column(String(50))  # local_upload, azure_blob
    connection_config: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, inactive, error
    file_count: Mapped[int] = mapped_column(default=0)
    total_size: Mapped[int] = mapped_column(default=0)  # bytes
    pipeline_id: Mapped[str | None] = mapped_column(ForeignKey("pipelines.id"), default=None)
