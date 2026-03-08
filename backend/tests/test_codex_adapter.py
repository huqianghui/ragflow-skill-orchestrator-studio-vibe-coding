"""Tests for the Codex CLI adapter."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.agents.adapters.codex import CodexAdapter, _parse_codex_event
from app.services.agents.base import AgentEvent, AgentMode, AgentRequest


@pytest.fixture
def adapter():
    return CodexAdapter()


class TestCodexAdapterProperties:
    def test_name_and_display(self, adapter: CodexAdapter):
        assert adapter.name == "codex"
        assert adapter.display_name == "Codex"

    def test_modes(self, adapter: CodexAdapter):
        assert AgentMode.ASK in adapter.modes
        assert AgentMode.CODE in adapter.modes

    def test_default_tools(self, adapter: CodexAdapter):
        tools = adapter.default_tools
        assert "Shell" in tools
        assert "FileRead" in tools


class TestCodexIsAvailable:
    @pytest.mark.asyncio
    async def test_available_when_codex_found(self, adapter: CodexAdapter):
        with patch(
            "app.services.agents.adapters.codex._check_command",
            new_callable=AsyncMock,
            return_value=True,
        ):
            assert await adapter.is_available() is True

    @pytest.mark.asyncio
    async def test_unavailable_when_codex_not_found(self, adapter: CodexAdapter):
        with patch(
            "app.services.agents.adapters.codex._check_command",
            new_callable=AsyncMock,
            return_value=False,
        ):
            assert await adapter.is_available() is False


class TestCodexGetVersion:
    @pytest.mark.asyncio
    async def test_returns_version_string(self, adapter: CodexAdapter):
        with patch(
            "app.services.agents.adapters.codex._get_command_output",
            new_callable=AsyncMock,
            return_value="0.1.2",
        ):
            version = await adapter.get_version()
            assert version == "0.1.2"

    @pytest.mark.asyncio
    async def test_returns_none_when_unavailable(self, adapter: CodexAdapter):
        with patch(
            "app.services.agents.adapters.codex._get_command_output",
            new_callable=AsyncMock,
            return_value=None,
        ):
            version = await adapter.get_version()
            assert version is None


class TestCodexExecuteCommand:
    @pytest.mark.asyncio
    async def test_uses_exec_json_subcommand(self, adapter: CodexAdapter):
        """Execute must use 'codex exec <prompt> --json', not 'codex --quiet'."""
        captured_cmd = None

        async def mock_stream(cmd, **_kwargs):
            nonlocal captured_cmd
            captured_cmd = cmd
            # Yield nothing — just capture the command
            return
            yield  # make it a generator  # noqa: B027

        with patch(
            "app.services.agents.adapters.codex._stream_subprocess",
            side_effect=mock_stream,
        ):
            request = AgentRequest(prompt="hello world", mode=AgentMode.CODE)
            events = [e async for e in adapter.execute(request)]  # noqa: F841

        assert captured_cmd is not None
        assert captured_cmd[0] == "codex"
        assert captured_cmd[1] == "exec"
        assert "hello world" in captured_cmd
        assert "--json" in captured_cmd
        assert "--quiet" not in captured_cmd


class TestCodexExtractSessionId:
    def test_extracts_thread_id(self, adapter: CodexAdapter):
        events = [
            AgentEvent(
                type="session_init",
                content="",
                metadata={"type": "thread.started", "thread_id": "abc-123"},
            ),
            AgentEvent(type="text", content="hello", metadata={}),
        ]
        assert adapter.extract_session_id(events) == "abc-123"

    def test_returns_none_without_thread_id(self, adapter: CodexAdapter):
        events = [
            AgentEvent(type="text", content="hello", metadata={}),
        ]
        assert adapter.extract_session_id(events) is None


class TestParseCodexEvent:
    def test_thread_started_returns_session_init(self):
        event = AgentEvent(
            type="text",
            content="",
            metadata={"type": "thread.started", "thread_id": "t-1"},
        )
        result = _parse_codex_event(event)
        assert result is not None
        assert result.type == "session_init"
        assert result.metadata["thread_id"] == "t-1"

    def test_turn_started_returns_none(self):
        event = AgentEvent(type="text", content="", metadata={"type": "turn.started"})
        assert _parse_codex_event(event) is None

    def test_error_event(self):
        event = AgentEvent(
            type="text",
            content="",
            metadata={"type": "error", "message": "something went wrong"},
        )
        result = _parse_codex_event(event)
        assert result is not None
        assert result.type == "error"
        assert "something went wrong" in result.content

    def test_turn_completed_returns_none(self):
        event = AgentEvent(type="text", content="", metadata={"type": "turn.completed"})
        assert _parse_codex_event(event) is None

    def test_turn_failed_returns_error(self):
        event = AgentEvent(
            type="text",
            content="",
            metadata={
                "type": "turn.failed",
                "error": {"message": "401 Unauthorized"},
            },
        )
        result = _parse_codex_event(event)
        assert result is not None
        assert result.type == "error"
        assert "401 Unauthorized" in result.content

    # --- v0.111.0 item.completed events ---

    def test_item_completed_agent_message(self):
        """v0.111.0: agent_message carries the response text in item.text."""
        event = AgentEvent(
            type="item.completed",
            content="",
            metadata={
                "type": "item.completed",
                "item": {
                    "id": "item_1",
                    "type": "agent_message",
                    "text": "Hello, nice to meet you.",
                },
            },
        )
        result = _parse_codex_event(event)
        assert result is not None
        assert result.type == "text"
        assert result.content == "Hello, nice to meet you."

    def test_item_completed_reasoning_skipped(self):
        """v0.111.0: reasoning items should be skipped."""
        event = AgentEvent(
            type="item.completed",
            content="",
            metadata={
                "type": "item.completed",
                "item": {
                    "id": "item_0",
                    "type": "reasoning",
                    "text": "Let me think about this...",
                },
            },
        )
        result = _parse_codex_event(event)
        assert result is None

    def test_item_completed_command_execution(self):
        """v0.111.0: command_execution shows output."""
        event = AgentEvent(
            type="item.completed",
            content="",
            metadata={
                "type": "item.completed",
                "item": {
                    "id": "item_2",
                    "type": "command_execution",
                    "command": "ls -la",
                    "aggregated_output": "file1.txt\nfile2.txt\n",
                    "exit_code": 0,
                    "status": "completed",
                },
            },
        )
        result = _parse_codex_event(event)
        assert result is not None
        assert result.type == "code"
        assert "ls -la" in result.content
        assert "file1.txt" in result.content

    def test_item_started_command_execution_skipped(self):
        """v0.111.0: in-progress command_execution should be skipped."""
        event = AgentEvent(
            type="item.started",
            content="",
            metadata={
                "type": "item.started",
                "item": {
                    "id": "item_2",
                    "type": "command_execution",
                    "command": "ls -la",
                    "status": "in_progress",
                },
            },
        )
        result = _parse_codex_event(event)
        assert result is None

    def test_item_completed_empty_agent_message(self):
        """v0.111.0: empty agent_message text returns None."""
        event = AgentEvent(
            type="item.completed",
            content="",
            metadata={
                "type": "item.completed",
                "item": {"id": "item_1", "type": "agent_message", "text": ""},
            },
        )
        result = _parse_codex_event(event)
        assert result is None

    # --- Legacy events ---

    def test_message_delta_extracts_content(self):
        event = AgentEvent(
            type="text",
            content="",
            metadata={"type": "message.delta", "delta": "Hello "},
        )
        result = _parse_codex_event(event)
        assert result is not None
        assert result.type == "text"
        assert result.content == "Hello "

    def test_empty_content_returns_none(self):
        event = AgentEvent(
            type="text",
            content="",
            metadata={"type": "message.delta"},
        )
        result = _parse_codex_event(event)
        assert result is None
