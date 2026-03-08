"""AgentSession ORM model — thin proxy for CLI agent sessions."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class AgentSession(BaseModel):
    __tablename__ = "agent_sessions"

    agent_name: Mapped[str] = mapped_column(String(50), nullable=False)
    native_session_id: Mapped[str | None] = mapped_column(String(255), default=None)
    title: Mapped[str] = mapped_column(String(255), default="New Session")
    mode: Mapped[str] = mapped_column(String(20), default="code")
    source: Mapped[str] = mapped_column(String(50), default="playground")
    # source values: "playground" | "skill-editor" | "pipeline-editor" | "builtin-skill-editor"
