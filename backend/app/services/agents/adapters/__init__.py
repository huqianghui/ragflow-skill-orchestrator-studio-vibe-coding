"""Auto-register all agent adapters into the global registry."""

from app.services.agents.adapters.claude_code import ClaudeCodeAdapter
from app.services.agents.adapters.codex import CodexAdapter
from app.services.agents.adapters.copilot import CopilotAdapter
from app.services.agents.registry import registry

registry.register(ClaudeCodeAdapter)
registry.register(CodexAdapter)
registry.register(CopilotAdapter)
