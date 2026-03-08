"""GitHub Copilot CLI adapter with streaming output.

Copilot CLI supports non-interactive mode via:
    copilot -p "prompt" --output-format json --allow-all-tools
    copilot -p "prompt" --output-format json --allow-all-tools --resume <id>

The --allow-all-tools flag is REQUIRED for non-interactive (-p) mode,
otherwise copilot waits for interactive tool approval and produces no output.
"""

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
    _stream_subprocess,
)

logger = logging.getLogger(__name__)

_COPILOT_TOOLS = ["Suggest", "Explain", "Shell", "FileRead", "FileWrite"]

_CHUNK_SIZE = 12
_CHUNK_DELAY = 0.03


class CopilotAdapter(BaseAgentAdapter):
    name = "copilot"
    display_name = "GitHub Copilot"
    icon = "copilot"
    description = "GitHub Copilot CLI coding agent"
    modes = [AgentMode.ASK, AgentMode.CODE]
    provider = "GitHub / Microsoft"
    model = "GPT-4o"
    install_hint = "gh extension install github/gh-copilot"

    @property
    def default_tools(self) -> list[str]:
        return list(_COPILOT_TOOLS)

    async def is_available(self) -> bool:
        """Check copilot CLI (standalone or gh extension)."""
        # Standalone copilot command (GitHub Copilot CLI v1.x)
        if await _check_command("copilot"):
            return True
        # Fallback: gh copilot extension
        if await _check_command("gh"):
            version = await _get_command_output("gh", "copilot", "--version")
            return version is not None
        return False

    async def get_version(self) -> str | None:
        # Try standalone first
        if await _check_command("copilot"):
            return await _get_command_output("copilot", "--version")
        # Fallback: gh copilot
        return await _get_command_output("gh", "copilot", "--version")

    async def get_tools(self) -> list[str]:
        return list(_COPILOT_TOOLS)

    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]:
        # Determine which command to use
        if await _check_command("copilot"):
            cmd = [
                "copilot",
                "-p",
                request.prompt,
                "--output-format",
                "json",
                "--allow-all-tools",
            ]
            # Resume existing session if native_session_id is available
            if request.session_id:
                cmd.extend(["--resume", request.session_id])
        elif await _check_command("gh"):
            yield AgentEvent(
                type="error",
                content=(
                    "GitHub Copilot gh-extension does not support "
                    "non-interactive mode. Please install the standalone "
                    "Copilot CLI."
                ),
            )
            return
        else:
            yield AgentEvent(type="error", content="Copilot CLI not found.")
            return

        async for event in _stream_subprocess(cmd):
            parsed = _parse_copilot_event(event)
            if parsed is None:
                continue
            # Stream text in chunks for smooth effect
            if parsed.content and len(parsed.content) > _CHUNK_SIZE:
                text = parsed.content
                for i in range(0, len(text), _CHUNK_SIZE):
                    chunk = text[i : i + _CHUNK_SIZE]
                    yield AgentEvent(type="text", content=chunk, metadata={})
                    await asyncio.sleep(_CHUNK_DELAY)
            else:
                yield parsed

    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        """Extract session ID from Copilot events."""
        for event in events:
            sid = event.metadata.get("session_id") if event.metadata else None
            if sid:
                return str(sid)
        return None


def _parse_copilot_event(event: AgentEvent) -> AgentEvent | None:
    """Transform a raw event into a Copilot-specific event.

    Copilot CLI v1.0.2 JSON event types:
    - user.message: skip (echo of user input)
    - assistant.turn_start / assistant.turn_end: lifecycle, skip
    - assistant.reasoning_delta / assistant.reasoning: reasoning, skip
    - assistant.message_delta: incremental text → data.deltaContent
    - assistant.message: complete message (skip, deltas already streamed)
    - result: session info → sessionId for session extraction
    - error: error messages
    """
    meta = event.metadata
    event_type = meta.get("type", event.type) if meta else event.type

    if event_type == "error":
        error_msg = ""
        if meta:
            error_msg = meta.get("message", "") if isinstance(meta.get("message"), str) else ""
        return AgentEvent(
            type="error",
            content=error_msg or event.content,
            metadata=meta or {},
        )

    # --- Copilot v1.0.2 event types ---

    # Incremental text content (the primary streaming event)
    if event_type == "assistant.message_delta":
        data = meta.get("data", {}) if meta else {}
        delta = data.get("deltaContent", "") if isinstance(data, dict) else ""
        if delta:
            return AgentEvent(type="text", content=delta, metadata={})
        return None

    # Complete message — skip to avoid duplicating already-streamed deltas
    if event_type == "assistant.message":
        return None

    # Result event — carries sessionId for session tracking
    if event_type == "result":
        session_id = meta.get("sessionId", "") if meta else ""
        if session_id:
            return AgentEvent(
                type="session_init",
                content="",
                metadata={"session_id": session_id},
            )
        return None

    # Skip lifecycle and reasoning events
    if event_type in (
        "user.message",
        "assistant.turn_start",
        "assistant.turn_end",
        "assistant.reasoning_delta",
        "assistant.reasoning",
    ):
        return None

    # --- Legacy event types (older Copilot versions) ---

    if event_type == "system":
        subtype = meta.get("subtype", "") if meta else ""
        if subtype == "init" and meta and meta.get("session_id"):
            return AgentEvent(
                type="session_init",
                content="",
                metadata={"session_id": meta["session_id"]},
            )
        return None

    if event_type in ("session.started", "session.ended"):
        if event_type == "session.started" and meta and meta.get("session_id"):
            return AgentEvent(
                type="session_init",
                content="",
                metadata={"session_id": meta["session_id"]},
            )
        return None

    # Pass through any event with content
    if event.content:
        return AgentEvent(type="text", content=event.content, metadata=meta or {})
    return None
