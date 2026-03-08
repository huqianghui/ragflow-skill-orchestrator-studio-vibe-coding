"""Pydantic schemas for the Agent module."""

from datetime import datetime

from pydantic import BaseModel, Field


class AgentInfoResponse(BaseModel):
    name: str
    display_name: str
    icon: str
    description: str
    modes: list[str]
    available: bool
    version: str | None = None
    provider: str | None = None
    model: str | None = None
    install_hint: str | None = None
    tools: list[str] = []
    mcp_servers: list[str] = []


class CreateSessionRequest(BaseModel):
    agent_name: str
    source: str = "playground"
    mode: str = "code"


class AgentSessionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    agent_name: str
    native_session_id: str | None
    title: str
    mode: str
    source: str
    created_at: datetime
    updated_at: datetime


class AgentChatMessage(BaseModel):
    """Schema for WebSocket client messages."""

    type: str = "message"
    content: str
    mode: str = "code"
    context: dict | None = None


class AgentEventResponse(BaseModel):
    type: str
    content: str = ""
    metadata: dict = Field(default_factory=dict)
