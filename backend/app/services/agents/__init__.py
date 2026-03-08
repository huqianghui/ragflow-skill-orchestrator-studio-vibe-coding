"""Agent service — public API for the agents module."""

import app.services.agents.adapters  # noqa: F401  # trigger auto-registration
from app.services.agents.base import (
    AgentContext,
    AgentEvent,
    AgentMode,
    AgentRequest,
    BaseAgentAdapter,
)
from app.services.agents.registry import registry

__all__ = [
    "AgentContext",
    "AgentEvent",
    "AgentMode",
    "AgentRequest",
    "BaseAgentAdapter",
    "registry",
]
