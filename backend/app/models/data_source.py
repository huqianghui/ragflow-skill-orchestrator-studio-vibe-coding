from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class DataSource(BaseModel):
    __tablename__ = "data_sources"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # local_upload | azure_blob | azure_adls_gen2 | azure_cosmos_db | azure_sql
    # | azure_table | microsoft_onelake | sharepoint | onedrive | onedrive_business
    # | azure_file_storage | azure_queues | service_bus | amazon_s3 | dropbox | sftp_ssh
    source_type: Mapped[str] = mapped_column(String(50))
    connection_config: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, inactive, error
    file_count: Mapped[int] = mapped_column(default=0)
    total_size: Mapped[int] = mapped_column(default=0)  # bytes
    pipeline_id: Mapped[str | None] = mapped_column(ForeignKey("pipelines.id"), default=None)
