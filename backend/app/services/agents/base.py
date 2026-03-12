"""Agent adapter base classes, data types, and shared utilities."""

import asyncio
import json
import logging
import os
import re
import shutil
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path

logger = logging.getLogger(__name__)


class AgentMode(StrEnum):
    PLAN = "plan"
    ASK = "ask"
    CODE = "code"


@dataclass
class AgentInfo:
    name: str
    display_name: str
    icon: str
    description: str
    modes: list[AgentMode]
    available: bool
    version: str | None = None
    provider: str | None = None
    model: str | None = None
    install_hint: str | None = None
    tools: list[str] = field(default_factory=list)
    mcp_servers: list[str] = field(default_factory=list)


@dataclass
class AgentContext:
    type: str = "free"  # "skill" | "pipeline" | "free"
    skill: dict | None = None
    pipeline: dict | None = None
    selected_node: str | None = None
    error_result: dict | None = None
    attachments: list[dict] = field(default_factory=list)


@dataclass
class AgentRequest:
    prompt: str
    mode: AgentMode = AgentMode.CODE
    session_id: str | None = None  # native session id for resume
    context: AgentContext | None = None


@dataclass
class AgentEvent:
    type: str  # "text" | "code" | "error" | "session_init" | "done"
    content: str = ""
    metadata: dict = field(default_factory=dict)


class BaseAgentAdapter(ABC):
    """Abstract base class for CLI agent adapters."""

    name: str
    display_name: str
    icon: str
    description: str
    modes: list[AgentMode]
    provider: str = ""
    model: str = ""
    install_hint: str = ""

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the CLI tool is installed and executable."""

    @abstractmethod
    async def get_version(self) -> str | None:
        """Return CLI version string, or None if unavailable."""

    async def get_info(self) -> AgentInfo:
        """Return complete agent info with availability and version.

        Runs all probes (availability, version, tools, MCP, config) in
        parallel to minimize wall-clock time.  Probes that depend on
        availability gracefully return defaults when the agent is missing.
        """

        async def _safe_version() -> str | None:
            try:
                return await self.get_version()
            except Exception:
                return None

        async def _safe_tools() -> list[str]:
            try:
                return await self.get_tools()
            except Exception:
                return self.default_tools

        async def _safe_mcp() -> list[str]:
            try:
                return await self.get_mcp_servers()
            except Exception:
                return []

        async def _safe_config() -> None:
            try:
                await self.get_config()
            except Exception:
                pass

        # Run all probes concurrently
        available, version, tools, mcp_servers, _ = await asyncio.gather(
            self.is_available(),
            _safe_version(),
            _safe_tools(),
            _safe_mcp(),
            _safe_config(),
        )

        # Discard results from probes that only matter when available
        if not available:
            version = None
            tools = self.default_tools
            mcp_servers = []

        return AgentInfo(
            name=self.name,
            display_name=self.display_name,
            icon=self.icon,
            description=self.description,
            modes=self.modes,
            available=available,
            version=version,
            provider=self.provider or None,
            model=self.model or None,
            install_hint=self.install_hint or None,
            tools=tools,
            mcp_servers=mcp_servers,
        )

    @property
    def default_tools(self) -> list[str]:
        """Default tool names (static fallback)."""
        return []

    async def get_tools(self) -> list[str]:
        """Return list of built-in tool names. Override for dynamic detection."""
        return self.default_tools

    async def get_mcp_servers(self) -> list[str]:
        """Return list of configured MCP server names. Override for dynamic detection."""
        return []

    async def get_config(self) -> dict:
        """Return agent's actual configuration read from its config files.

        Override in subclass. Returns dict of config sections.
        Sensitive values (tokens, keys) should be masked.
        """
        return {}

    def get_subprocess_env(self) -> dict[str, str]:
        """Return extra env vars to inject into the agent subprocess.

        Override in subclass to read CLI-specific config files and return
        env vars (e.g. API keys, base URLs) that ensure the subprocess
        can authenticate without requiring interactive ``login``.
        """
        return {}

    @abstractmethod
    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]:
        """Stream-execute the agent, yielding AgentEvent objects."""
        yield  # pragma: no cover  # type: ignore[misc]

    @abstractmethod
    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        """Extract native session id from initial output events."""


# ---------------------------------------------------------------------------
# Shared utility functions
# ---------------------------------------------------------------------------


async def _check_command(cmd: str) -> bool:
    """Check if a command exists on PATH using asyncio.to_thread."""
    return await asyncio.to_thread(shutil.which, cmd) is not None


async def _get_command_output(cmd: str, *args: str) -> str | None:
    """Execute a command and return the first line of stdout."""
    try:
        proc = await asyncio.create_subprocess_exec(
            cmd,
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        return stdout.decode().strip() if stdout else None
    except (TimeoutError, FileNotFoundError, OSError):
        return None


async def _stream_subprocess(
    cmd: list[str],
    cwd: str | None = None,
    timeout: float = 300,
    extra_env: dict[str, str] | None = None,
) -> AsyncGenerator[AgentEvent, None]:
    """Launch a subprocess and stream AgentEvent from stdout.

    - stdin=DEVNULL to prevent CLI tools waiting for input
    - stderr=PIPE to capture error messages on failure
    - stderr is drained in a background task to avoid deadlock
    - timeout via asyncio deadline
    - extra_env: additional env vars (e.g. from CLI config files) merged
      into the subprocess environment, overriding os.environ values
    """
    # Strip env vars that prevent nested CLI agent sessions (e.g. CLAUDECODE)
    clean_env = {
        k: v for k, v in os.environ.items() if k not in ("CLAUDECODE", "CLAUDE_CODE_SESSION")
    }
    if extra_env:
        clean_env.update(extra_env)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=clean_env,
        cwd=cwd,
    )

    # Drain stderr in background to avoid buffer-full deadlock
    stderr_chunks: list[bytes] = []

    async def _drain_stderr() -> None:
        if proc.stderr:
            stderr_chunks.append(await proc.stderr.read())

    stderr_task = asyncio.create_task(_drain_stderr())

    deadline = asyncio.get_event_loop().time() + timeout
    event_count = 0
    try:
        assert proc.stdout is not None
        async for line in proc.stdout:
            if asyncio.get_event_loop().time() > deadline:
                yield AgentEvent(
                    type="error",
                    content=f"Agent timed out after {timeout}s",
                )
                break
            text = line.decode("utf-8", errors="replace").rstrip()
            if not text:
                continue
            try:
                data = json.loads(text)
                event_count += 1
                yield _parse_json_event(data)
            except json.JSONDecodeError:
                event_count += 1
                yield AgentEvent(type="text", content=text)
    finally:
        if proc.returncode is None:
            proc.terminate()
        await proc.wait()
        await stderr_task

    # If process produced no stdout events and failed, report stderr.
    if event_count == 0 and proc.returncode and proc.returncode != 0:
        stderr_text = b"".join(stderr_chunks).decode("utf-8", errors="replace").strip()
        yield AgentEvent(
            type="error",
            content=(stderr_text or f"Agent process exited with code {proc.returncode}"),
        )


def _extract_text(content: object) -> str:
    """Extract plain text from Claude-style content (string, list of blocks, or other)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        # Content blocks: [{"type": "text", "text": "..."}, ...]
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "".join(parts)
    return str(content) if content else ""


def _parse_json_event(data: dict) -> AgentEvent:
    """Convert a JSON line to AgentEvent. Adapters may override."""
    event_type = data.get("type", "text")
    # Try top-level content first, then nested message.content
    raw_content = data.get("content", "")
    if not raw_content:
        msg = data.get("message")
        if isinstance(msg, dict):
            raw_content = msg.get("content", "")
        elif isinstance(msg, str):
            raw_content = msg
    return AgentEvent(type=event_type, content=_extract_text(raw_content), metadata=data)


# ---------------------------------------------------------------------------
# Config file reading helpers
# ---------------------------------------------------------------------------

_SENSITIVE_PATTERNS = re.compile(
    r"(token|key|secret|password|credential|auth)",
    re.IGNORECASE,
)


def _mask_value(key: str, value: object) -> object:
    """Mask sensitive values while preserving structure."""
    if isinstance(value, dict):
        return {k: _mask_value(k, v) for k, v in value.items()}
    if isinstance(value, list):
        return [_mask_value(key, v) for v in value]
    if isinstance(value, str) and _SENSITIVE_PATTERNS.search(key):
        if len(value) <= 8:
            return "****"
        return value[:4] + "****" + value[-4:]
    return value


def _read_json_config(path: str | Path) -> dict:
    """Read a JSON config file and return its contents with secrets masked."""
    try:
        p = Path(path).expanduser()
        if not p.is_file():
            return {}
        raw = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            return {k: _mask_value(k, v) for k, v in raw.items()}
        return {"data": raw}
    except Exception:
        logger.debug("Failed to read JSON config %s", path, exc_info=True)
        return {}


def _read_json_config_raw(path: str | Path) -> dict:
    """Read a JSON config file and return its contents **without masking**.

    Used internally to extract real env vars for subprocess injection.
    Never expose the return value in API responses.
    """
    try:
        p = Path(path).expanduser()
        if not p.is_file():
            return {}
        raw = json.loads(p.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        logger.debug("Failed to read raw JSON config %s", path, exc_info=True)
        return {}


def _read_toml_config(path: str | Path) -> dict:
    """Read a TOML config file and return its contents with secrets masked."""
    try:
        import tomllib
    except ModuleNotFoundError:
        try:
            import tomli as tomllib  # type: ignore[no-redef]
        except ModuleNotFoundError:
            return {"_error": "TOML parser not available"}
    try:
        p = Path(path).expanduser()
        if not p.is_file():
            return {}
        raw = tomllib.loads(p.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            return {k: _mask_value(k, v) for k, v in raw.items()}
        return {"data": raw}
    except Exception:
        logger.debug("Failed to read TOML config %s", path, exc_info=True)
        return {}


def _read_toml_config_raw(path: str | Path) -> dict:
    """Read a TOML config file **without masking**.

    Used internally to extract real env vars for subprocess injection.
    """
    try:
        import tomllib
    except ModuleNotFoundError:
        try:
            import tomli as tomllib  # type: ignore[no-redef]
        except ModuleNotFoundError:
            return {}
    try:
        p = Path(path).expanduser()
        if not p.is_file():
            return {}
        raw = tomllib.loads(p.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        logger.debug("Failed to read raw TOML config %s", path, exc_info=True)
        return {}
