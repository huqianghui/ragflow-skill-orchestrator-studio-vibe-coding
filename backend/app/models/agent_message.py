"""AgentMessage ORM model — persists chat messages for session history."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class AgentMessage(BaseModel):
    __tablename__ = "agent_messages"

    session_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(10), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, default="")
