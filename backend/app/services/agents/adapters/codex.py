"""OpenAI Codex CLI adapter with streaming text output."""

import asyncio
from collections.abc import AsyncGenerator

from app.services.agents.base import (
    AgentEvent,
    AgentMode,
    AgentRequest,
    BaseAgentAdapter,
    _check_command,
    _get_command_output,
    _read_toml_config,
    _stream_subprocess,
)

_CODEX_TOOLS = ["Shell", "FileRead", "FileWrite", "FileEdit"]

_CHUNK_SIZE = 12
_CHUNK_DELAY = 0.03


class CodexAdapter(BaseAgentAdapter):
    name = "codex"
    display_name = "Codex"
    icon = "codex"
    description = "OpenAI Codex CLI coding agent"
    modes = [AgentMode.ASK, AgentMode.CODE]
    provider = "OpenAI"
    model = "Codex"
    install_hint = "npm install -g @openai/codex"

    @property
    def default_tools(self) -> list[str]:
        return list(_CODEX_TOOLS)

    async def is_available(self) -> bool:
        return await _check_command("codex")

    async def get_version(self) -> str | None:
        return await _get_command_output("codex", "--version")

    async def get_tools(self) -> list[str]:
        return list(_CODEX_TOOLS)

    async def get_config(self) -> dict:
        """Read Codex config from ~/.codex/config.toml."""
        config = _read_toml_config("~/.codex/config.toml")
        # Update model/provider from actual config
        if config.get("model"):
            self.model = str(config["model"])
        if config.get("model_provider"):
            self.provider = f"OpenAI ({config['model_provider']})"
        providers = config.get("model_providers", {})
        if isinstance(providers, dict):
            for prov_cfg in providers.values():
                if isinstance(prov_cfg, dict) and prov_cfg.get("name"):
                    self.provider = str(prov_cfg["name"])
                    break
        return config

    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]:
        cmd = ["codex", "--quiet", request.prompt]
        async for event in _stream_subprocess(cmd):
            # Stream text in chunks for streaming effect
            if event.content and len(event.content) > _CHUNK_SIZE:
                text = event.content
                for i in range(0, len(text), _CHUNK_SIZE):
                    chunk = text[i : i + _CHUNK_SIZE]
                    yield AgentEvent(type="text", content=chunk, metadata={})
                    await asyncio.sleep(_CHUNK_DELAY)
            else:
                yield event

    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        return None
