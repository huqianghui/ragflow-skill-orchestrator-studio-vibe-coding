"""Claude Code CLI adapter with streaming text output."""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from app.services.agents.base import (
    AgentEvent,
    AgentMode,
    AgentRequest,
    BaseAgentAdapter,
    _check_command,
    _get_command_output,
    _read_json_config,
    _read_json_config_raw,
    _stream_subprocess,
)

logger = logging.getLogger(__name__)

_CLAUDE_CODE_TOOLS = [
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Glob",
    "Grep",
    "WebSearch",
    "WebFetch",
    "Agent",
    "NotebookEdit",
]

# Streaming chunk parameters
_CHUNK_SIZE = 12  # characters per chunk (good for both CJK and Latin)
_CHUNK_DELAY = 0.03  # seconds between chunks (~33 chunks/sec, ~400 chars/sec)


class ClaudeCodeAdapter(BaseAgentAdapter):
    name = "claude-code"
    display_name = "Claude Code"
    icon = "claude-code"
    description = "Anthropic official CLI coding agent"
    modes = [AgentMode.PLAN, AgentMode.ASK, AgentMode.CODE]
    provider = "Anthropic"
    model = "Claude Sonnet 4"
    install_hint = "npm install -g @anthropic-ai/claude-code"

    @property
    def default_tools(self) -> list[str]:
        return list(_CLAUDE_CODE_TOOLS)

    async def is_available(self) -> bool:
        return await _check_command("claude")

    async def get_version(self) -> str | None:
        return await _get_command_output("claude", "--version")

    async def get_tools(self) -> list[str]:
        return list(_CLAUDE_CODE_TOOLS)

    async def get_config(self) -> dict:
        """Read Claude Code settings from ~/.claude/settings.json."""
        config: dict = {}
        settings = _read_json_config("~/.claude/settings.json")
        if settings:
            config["settings"] = settings
        local = _read_json_config("~/.claude/settings.local.json")
        if local:
            config["settings_local"] = local
        # Override model from actual env/settings
        env = settings.get("env", {})
        if isinstance(env, dict) and env.get("ANTHROPIC_MODEL"):
            self.model = str(env["ANTHROPIC_MODEL"])
        return config

    def get_subprocess_env(self) -> dict[str, str]:
        """Inject env vars from ~/.claude/settings.json into subprocess.

        This ensures ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, etc. are
        available even when ``claude login`` session has expired, preventing
        the "Not logged in · Please run /login" error.
        """
        raw = _read_json_config_raw("~/.claude/settings.json")
        env_section = raw.get("env", {})
        if isinstance(env_section, dict):
            return {k: str(v) for k, v in env_section.items() if v is not None}
        return {}

    async def get_mcp_servers(self) -> list[str]:
        """Detect configured MCP servers via `claude mcp list`."""
        try:
            raw = await _get_command_output("claude", "mcp", "list")
            if not raw:
                return []
            # Try JSON parse first
            try:
                data = json.loads(raw)
                if isinstance(data, list):
                    return [s.get("name", str(s)) if isinstance(s, dict) else str(s) for s in data]
            except json.JSONDecodeError:
                pass
            # Fallback: parse text lines (each line = server name or "name - scope")
            servers = []
            for line in raw.strip().splitlines():
                line = line.strip()
                if line and not line.startswith(("─", "No MCP")):
                    # "server-name  local" → take first token
                    name = line.split()[0] if line.split() else line
                    servers.append(name)
            return servers
        except Exception:
            logger.debug("Failed to detect MCP servers", exc_info=True)
            return []

    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]:
        cmd = [
            "claude",
            "-p",
            request.prompt,
            "--output-format",
            "stream-json",
            "--verbose",
        ]
        if request.session_id:
            cmd.extend(["--resume", request.session_id])

        async for event in _stream_subprocess(cmd, extra_env=self.get_subprocess_env()):
            meta = event.metadata
            event_type = meta.get("type", "")

            # 1) system init → extract session_id
            if event_type == "system" and meta.get("subtype") == "init":
                sid = meta.get("session_id", "")
                yield AgentEvent(
                    type="session_init",
                    content="",
                    metadata={"session_id": sid},
                )
                continue

            # 2) result → skip (duplicate text already sent via assistant)
            if event_type == "result":
                continue

            # 3) assistant / text with content → stream in chunks
            if event.content:
                text = event.content
                if len(text) <= _CHUNK_SIZE:
                    yield AgentEvent(type="text", content=text, metadata={})
                else:
                    for i in range(0, len(text), _CHUNK_SIZE):
                        chunk = text[i : i + _CHUNK_SIZE]
                        yield AgentEvent(type="text", content=chunk, metadata={})
                        await asyncio.sleep(_CHUNK_DELAY)
                continue

            # 4) other events (error, etc.) → pass through
            if event.content or event.type == "error":
                yield event

    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        for e in events:
            if e.type == "session_init" and "session_id" in e.metadata:
                return e.metadata["session_id"]
        return None
