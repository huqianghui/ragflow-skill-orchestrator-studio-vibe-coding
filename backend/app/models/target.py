from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Target(BaseModel):
    __tablename__ = "targets"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # azure_ai_search | azure_blob | cosmosdb_gremlin | neo4j | mysql | postgresql
    target_type: Mapped[str] = mapped_column(String(50))
    connection_config: Mapped[dict] = mapped_column(JSON, default=dict)
    field_mappings: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, inactive, error
    # Deprecated: use Workflow routes instead. Column kept for data compatibility.
    pipeline_id: Mapped[str | None] = mapped_column(String(), default=None)
