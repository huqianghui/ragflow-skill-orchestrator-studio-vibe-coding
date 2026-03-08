"""AgentConfig ORM model — persisted agent availability and metadata."""

from sqlalchemy import JSON, Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class AgentConfig(BaseModel):
    __tablename__ = "agent_configs"

    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(100))
    icon: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text, default="")
    modes: Mapped[dict] = mapped_column(JSON, default=list)
    available: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    install_hint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tools: Mapped[dict] = mapped_column(JSON, default=list)
    mcp_servers: Mapped[dict] = mapped_column(JSON, default=list)
