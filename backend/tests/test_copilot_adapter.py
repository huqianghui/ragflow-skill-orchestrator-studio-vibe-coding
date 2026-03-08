"""Tests for the GitHub Copilot CLI adapter."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.agents.adapters.copilot import CopilotAdapter, _parse_copilot_event
from app.services.agents.base import AgentEvent, AgentMode, AgentRequest


@pytest.fixture
def adapter():
    return CopilotAdapter()


class TestCopilotAdapterProperties:
    def test_name_and_display(self, adapter: CopilotAdapter):
        assert adapter.name == "copilot"
        assert adapter.display_name == "GitHub Copilot"

    def test_modes(self, adapter: CopilotAdapter):
        assert AgentMode.ASK in adapter.modes
        assert AgentMode.CODE in adapter.modes

    def test_install_hint(self, adapter: CopilotAdapter):
        assert "gh extension install" in adapter.install_hint

    def test_default_tools(self, adapter: CopilotAdapter):
        tools = adapter.default_tools
        assert "Suggest" in tools
        assert "Explain" in tools


class TestCopilotIsAvailable:
    @pytest.mark.asyncio
    async def test_available_when_standalone_copilot_found(self, adapter: CopilotAdapter):
        """Standalone `copilot` command is detected first."""
        with patch(
            "app.services.agents.adapters.copilot._check_command",
            new_callable=AsyncMock,
            side_effect=lambda cmd: cmd == "copilot",
        ):
            assert await adapter.is_available() is True

    @pytest.mark.asyncio
    async def test_available_via_gh_extension_fallback(self, adapter: CopilotAdapter):
        """Falls back to `gh copilot` when standalone not found."""
        with (
            patch(
                "app.services.agents.adapters.copilot._check_command",
                new_callable=AsyncMock,
                side_effect=lambda cmd: cmd == "gh",
            ),
            patch(
                "app.services.agents.adapters.copilot._get_command_output",
                new_callable=AsyncMock,
                return_value="1.0.0",
            ),
        ):
            assert await adapter.is_available() is True

    @pytest.mark.asyncio
    async def test_unavailable_when_neither_found(self, adapter: CopilotAdapter):
        with patch(
            "app.services.agents.adapters.copilot._check_command",
            new_callable=AsyncMock,
            return_value=False,
        ):
            assert await adapter.is_available() is False

    @pytest.mark.asyncio
    async def test_unavailable_when_gh_but_no_copilot_extension(self, adapter: CopilotAdapter):
        """gh exists but copilot extension not installed."""
        with (
            patch(
                "app.services.agents.adapters.copilot._check_command",
                new_callable=AsyncMock,
                side_effect=lambda cmd: cmd == "gh",
            ),
            patch(
                "app.services.agents.adapters.copilot._get_command_output",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            assert await adapter.is_available() is False


class TestCopilotGetVersion:
    @pytest.mark.asyncio
    async def test_returns_version_from_standalone(self, adapter: CopilotAdapter):
        with (
            patch(
                "app.services.agents.adapters.copilot._check_command",
                new_callable=AsyncMock,
                side_effect=lambda cmd: cmd == "copilot",
            ),
            patch(
                "app.services.agents.adapters.copilot._get_command_output",
                new_callable=AsyncMock,
                return_value="1.0.2",
            ) as mock,
        ):
            version = await adapter.get_version()
            assert version == "1.0.2"
            mock.assert_called_once_with("copilot", "--version")

    @pytest.mark.asyncio
    async def test_returns_version_from_gh_copilot(self, adapter: CopilotAdapter):
        with (
            patch(
                "app.services.agents.adapters.copilot._check_command",
                new_callable=AsyncMock,
                return_value=False,
            ),
            patch(
                "app.services.agents.adapters.copilot._get_command_output",
                new_callable=AsyncMock,
                return_value="0.5.4-beta",
            ) as mock,
        ):
            version = await adapter.get_version()
            assert version == "0.5.4-beta"
            mock.assert_called_once_with("gh", "copilot", "--version")


class TestCopilotExecute:
    @pytest.mark.asyncio
    async def test_standalone_includes_allow_all_tools(self, adapter: CopilotAdapter):
        """CRITICAL: --allow-all-tools is REQUIRED for non-interactive mode.

        Without it, copilot waits for interactive tool approval and
        produces no output (stdin=DEVNULL).
        """
        captured_cmd = None

        async def mock_stream(cmd, **_kwargs):
            nonlocal captured_cmd
            captured_cmd = cmd
            yield AgentEvent(type="text", content="result", metadata={})

        with (
            patch(
                "app.services.agents.adapters.copilot._check_command",
                new_callable=AsyncMock,
                side_effect=lambda cmd: cmd == "copilot",
            ),
            patch(
                "app.services.agents.adapters.copilot._stream_subprocess",
                side_effect=mock_stream,
            ),
        ):
            request = AgentRequest(prompt="test prompt", mode=AgentMode.ASK)
            events = [e async for e in adapter.execute(request)]

        assert captured_cmd is not None
        assert captured_cmd[0] == "copilot"
        assert "-p" in captured_cmd
        assert "test prompt" in captured_cmd
        assert "--output-format" in captured_cmd
        assert "json" in captured_cmd
        assert "--allow-all-tools" in captured_cmd
        assert len(events) == 1
        assert events[0].content == "result"

    @pytest.mark.asyncio
    async def test_standalone_adds_resume_when_session_id_present(self, adapter: CopilotAdapter):
        """Session resume should use --resume <id>."""
        captured_cmd = None

        async def mock_stream(cmd, **_kwargs):
            nonlocal captured_cmd
            captured_cmd = cmd
            yield AgentEvent(type="text", content="ok", metadata={})

        with (
            patch(
                "app.services.agents.adapters.copilot._check_command",
                new_callable=AsyncMock,
                side_effect=lambda cmd: cmd == "copilot",
            ),
            patch(
                "app.services.agents.adapters.copilot._stream_subprocess",
                side_effect=mock_stream,
            ),
        ):
            request = AgentRequest(prompt="continue", mode=AgentMode.CODE, session_id="ses-abc")
            [e async for e in adapter.execute(request)]

        assert captured_cmd is not None
        assert "--resume" in captured_cmd
        assert "ses-abc" in captured_cmd

    @pytest.mark.asyncio
    async def test_gh_extension_returns_error(self, adapter: CopilotAdapter):
        """gh copilot extension returns error (non-interactive not supported)."""
        with patch(
            "app.services.agents.adapters.copilot._check_command",
            new_callable=AsyncMock,
            side_effect=lambda cmd: cmd == "gh",
        ):
            request = AgentRequest(prompt="test", mode=AgentMode.ASK)
            events = [e async for e in adapter.execute(request)]
            assert len(events) == 1
            assert events[0].type == "error"
            assert "non-interactive" in events[0].content.lower()

    @pytest.mark.asyncio
    async def test_no_cli_returns_error(self, adapter: CopilotAdapter):
        """Neither copilot nor gh available."""
        with patch(
            "app.services.agents.adapters.copilot._check_command",
            new_callable=AsyncMock,
            return_value=False,
        ):
            request = AgentRequest(prompt="test", mode=AgentMode.ASK)
            events = [e async for e in adapter.execute(request)]
            assert len(events) == 1
            assert events[0].type == "error"
            assert "not found" in events[0].content.lower()


class TestCopilotExtractSessionId:
    def test_extracts_session_id_from_metadata(self, adapter: CopilotAdapter):
        events = [
            AgentEvent(type="session_init", content="", metadata={"session_id": "abc123"}),
            AgentEvent(type="text", content="hello", metadata={}),
        ]
        assert adapter.extract_session_id(events) == "abc123"

    def test_returns_none_when_no_session_id(self, adapter: CopilotAdapter):
        events = [AgentEvent(type="text", content="hello", metadata={})]
        assert adapter.extract_session_id(events) is None

    def test_returns_none_for_empty_events(self, adapter: CopilotAdapter):
        assert adapter.extract_session_id([]) is None


class TestParseCopilotEvent:
    def test_error_event(self):
        event = AgentEvent(
            type="text",
            content="something",
            metadata={"type": "error", "message": "bad request"},
        )
        result = _parse_copilot_event(event)
        assert result is not None
        assert result.type == "error"
        assert result.content == "bad request"

    def test_system_init_with_session_id(self):
        """Copilot system init event extracts session_id (same as Claude Code)."""
        event = AgentEvent(
            type="text",
            content="",
            metadata={"type": "system", "subtype": "init", "session_id": "s123"},
        )
        result = _parse_copilot_event(event)
        assert result is not None
        assert result.type == "session_init"
        assert result.metadata["session_id"] == "s123"

    def test_system_event_without_init_skipped(self):
        event = AgentEvent(
            type="text",
            content="",
            metadata={"type": "system", "subtype": "other"},
        )
        result = _parse_copilot_event(event)
        assert result is None

    def test_session_started_with_id(self):
        event = AgentEvent(
            type="text",
            content="",
            metadata={"type": "session.started", "session_id": "s123"},
        )
        result = _parse_copilot_event(event)
        assert result is not None
        assert result.type == "session_init"

    def test_session_ended_skipped(self):
        event = AgentEvent(
            type="text",
            content="",
            metadata={"type": "session.ended"},
        )
        result = _parse_copilot_event(event)
        assert result is None

    def test_result_event_without_session_id_skipped(self):
        """Result events without sessionId should be skipped."""
        event = AgentEvent(
            type="text",
            content="final answer",
            metadata={"type": "result"},
        )
        result = _parse_copilot_event(event)
        assert result is None

    def test_text_content_passed_through(self):
        event = AgentEvent(type="text", content="hello world", metadata={})
        result = _parse_copilot_event(event)
        assert result is not None
        assert result.type == "text"
        assert result.content == "hello world"

    def test_empty_content_skipped(self):
        event = AgentEvent(type="text", content="", metadata={})
        result = _parse_copilot_event(event)
        assert result is None

    # --- Copilot v1.0.2 event format tests ---

    def test_message_delta_extracts_text(self):
        """v1.0.2: assistant.message_delta carries text in data.deltaContent."""
        event = AgentEvent(
            type="assistant.message_delta",
            content="",
            metadata={
                "type": "assistant.message_delta",
                "data": {"messageId": "msg-1", "deltaContent": "Hello!"},
            },
        )
        result = _parse_copilot_event(event)
        assert result is not None
        assert result.type == "text"
        assert result.content == "Hello!"

    def test_message_delta_empty_skipped(self):
        """v1.0.2: empty deltaContent should be skipped."""
        event = AgentEvent(
            type="assistant.message_delta",
            content="",
            metadata={
                "type": "assistant.message_delta",
                "data": {"messageId": "msg-1", "deltaContent": ""},
            },
        )
        result = _parse_copilot_event(event)
        assert result is None

    def test_assistant_message_skipped(self):
        """v1.0.2: complete assistant.message is skipped (deltas already streamed)."""
        event = AgentEvent(
            type="assistant.message",
            content="",
            metadata={
                "type": "assistant.message",
                "data": {"content": "Full text here"},
            },
        )
        result = _parse_copilot_event(event)
        assert result is None

    def test_result_with_session_id(self):
        """v1.0.2: result event with sessionId extracts session_init."""
        event = AgentEvent(
            type="result",
            content="",
            metadata={
                "type": "result",
                "sessionId": "28391eb3-4e0b-4e2a-9076-0e89b18bd6f8",
                "exitCode": 0,
            },
        )
        result = _parse_copilot_event(event)
        assert result is not None
        assert result.type == "session_init"
        assert result.metadata["session_id"] == "28391eb3-4e0b-4e2a-9076-0e89b18bd6f8"

    def test_user_message_skipped(self):
        """v1.0.2: user.message is echoed input, skip."""
        event = AgentEvent(
            type="user.message",
            content="",
            metadata={"type": "user.message", "data": {"content": "hello"}},
        )
        result = _parse_copilot_event(event)
        assert result is None

    def test_reasoning_delta_skipped(self):
        """v1.0.2: reasoning deltas are ephemeral, skip."""
        event = AgentEvent(
            type="assistant.reasoning_delta",
            content="",
            metadata={
                "type": "assistant.reasoning_delta",
                "data": {"deltaContent": "thinking..."},
            },
        )
        result = _parse_copilot_event(event)
        assert result is None

    def test_turn_lifecycle_skipped(self):
        """v1.0.2: turn start/end are lifecycle, skip."""
        for event_type in ("assistant.turn_start", "assistant.turn_end"):
            event = AgentEvent(
                type=event_type,
                content="",
                metadata={"type": event_type, "data": {"turnId": "0"}},
            )
            result = _parse_copilot_event(event)
            assert result is None, f"{event_type} should be skipped"
