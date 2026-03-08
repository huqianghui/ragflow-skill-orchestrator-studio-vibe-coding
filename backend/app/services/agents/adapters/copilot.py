"""GitHub Copilot CLI adapter (stub — non-interactive mode TBD)."""

from collections.abc import AsyncGenerator

from app.services.agents.base import (
    AgentEvent,
    AgentMode,
    AgentRequest,
    BaseAgentAdapter,
    _check_command,
    _get_command_output,
)

_COPILOT_TOOLS = ["Suggest", "Explain"]


class CopilotAdapter(BaseAgentAdapter):
    name = "copilot"
    display_name = "GitHub Copilot"
    icon = "copilot"
    description = "GitHub Copilot CLI coding agent (non-interactive mode TBD)"
    modes = [AgentMode.ASK, AgentMode.CODE]
    provider = "GitHub / Microsoft"
    model = "GPT-4o"
    install_hint = "gh extension install github/gh-copilot"

    @property
    def default_tools(self) -> list[str]:
        return list(_COPILOT_TOOLS)

    async def is_available(self) -> bool:
        return await _check_command("copilot")

    async def get_version(self) -> str | None:
        return await _get_command_output("copilot", "--version")

    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]:
        # TODO: Copilot CLI non-interactive mode parameters TBD
        yield AgentEvent(
            type="error",
            content="Copilot adapter is not yet implemented. Non-interactive CLI mode TBD.",
        )

    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        return None
