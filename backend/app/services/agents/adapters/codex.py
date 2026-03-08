"""OpenAI Codex CLI adapter with JSONL streaming output."""

import asyncio
import logging
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

logger = logging.getLogger(__name__)

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
        cmd = ["codex", "exec", request.prompt, "--json"]
        async for event in _stream_subprocess(cmd):
            parsed = _parse_codex_event(event)
            if parsed is None:
                continue
            # Stream text in chunks for streaming effect
            if parsed.content and len(parsed.content) > _CHUNK_SIZE:
                text = parsed.content
                for i in range(0, len(text), _CHUNK_SIZE):
                    chunk = text[i : i + _CHUNK_SIZE]
                    yield AgentEvent(type="text", content=chunk, metadata={})
                    await asyncio.sleep(_CHUNK_DELAY)
            else:
                yield parsed

    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        """Extract thread_id from Codex JSONL events."""
        for event in events:
            thread_id = event.metadata.get("thread_id")
            if thread_id:
                return str(thread_id)
        return None


def _parse_codex_event(event: AgentEvent) -> AgentEvent | None:
    """Transform a raw _stream_subprocess event into a Codex-specific event.

    Codex CLI v0.111.0 JSONL event types:
    - thread.started: contains thread_id (top-level)
    - turn.started / turn.completed: lifecycle markers (skip)
    - turn.failed: error with error.message
    - item.completed + item.type=agent_message: response text in item.text
    - item.completed + item.type=reasoning: reasoning text (skip)
    - item.completed + item.type=command_execution: tool output in item.aggregated_output
    - item.started + item.type=command_execution: tool command (skip, wait for completed)
    - error: error messages with message field
    - Legacy: message.delta / message.completed / exec.output (older versions)
    """
    meta = event.metadata
    event_type = meta.get("type", event.type) if meta else event.type

    # --- thread lifecycle ---

    if event_type == "thread.started":
        thread_id = meta.get("thread_id", "") if meta else ""
        if thread_id:
            return AgentEvent(type="session_init", content="", metadata=meta)
        return None

    if event_type in ("turn.started", "turn.completed"):
        return None

    if event_type == "turn.failed":
        error_obj = meta.get("error", {}) if meta else {}
        error_msg = error_obj.get("message", "") if isinstance(error_obj, dict) else ""
        return AgentEvent(
            type="error",
            content=error_msg or "Agent turn failed",
            metadata=meta or {},
        )

    # --- error ---

    if event_type == "error":
        error_msg = meta.get("message", "") if meta else ""
        return AgentEvent(
            type="error",
            content=error_msg or event.content,
            metadata=meta or {},
        )

    # --- item events (v0.111.0) ---

    if event_type in ("item.completed", "item.started"):
        item = meta.get("item", {}) if meta else {}
        if not isinstance(item, dict):
            return None
        item_type = item.get("type", "")

        # Agent's response text
        if item_type == "agent_message":
            text = item.get("text", "")
            if text:
                return AgentEvent(type="text", content=text, metadata={})
            return None

        # Command execution output
        if item_type == "command_execution" and event_type == "item.completed":
            output = item.get("aggregated_output", "")
            cmd = item.get("command", "")
            if output:
                prefix = f"$ {cmd}\n" if cmd else ""
                return AgentEvent(type="code", content=prefix + output, metadata={})
            return None

        # Skip reasoning, tool_call, and in-progress items
        return None

    # --- Legacy event types (older Codex versions) ---

    if event_type in ("message.delta", "message.completed"):
        content = ""
        if meta:
            content = meta.get("response", {}).get("output_text", "")
            if not content:
                content = meta.get("delta", "")
            if not content:
                content = meta.get("content", "")
        if not content:
            content = event.content
        if content:
            return AgentEvent(type="text", content=content, metadata=meta or {})
        return None

    if event_type == "exec.output":
        output = meta.get("output", "") if meta else ""
        return AgentEvent(type="code", content=output or event.content, metadata=meta or {})

    # Fallback: pass through any event with content
    if event.content:
        return AgentEvent(type="text", content=event.content, metadata=meta or {})
    return None
