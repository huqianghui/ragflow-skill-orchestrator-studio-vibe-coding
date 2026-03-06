from sqlalchemy import JSON, Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Connection(BaseModel):
    __tablename__ = "connections"

    name: Mapped[str] = mapped_column(String(255), index=True, unique=True)
    connection_type: Mapped[str] = mapped_column(String(50))
    # azure_openai | openai | azure_doc_intelligence |
    # azure_content_understanding | azure_ai_foundry | http_api
    description: Mapped[str | None] = mapped_column(Text, default=None)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    # Encrypted storage; contains endpoint, api_key, api_version, etc.
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
