"""Tests for agent base module: _parse_json_event, _extract_text, utilities."""

import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest

from app.services.agents.base import (
    _extract_text,
    _parse_json_event,
    _read_json_config_raw,
    _read_toml_config_raw,
    _stream_subprocess,
)


class TestExtractText:
    def test_string_input(self):
        assert _extract_text("hello") == "hello"

    def test_list_of_text_blocks(self):
        blocks = [
            {"type": "text", "text": "part1"},
            {"type": "text", "text": "part2"},
        ]
        assert _extract_text(blocks) == "part1part2"

    def test_list_skips_non_text_blocks(self):
        blocks = [
            {"type": "image", "url": "..."},
            {"type": "text", "text": "visible"},
        ]
        assert _extract_text(blocks) == "visible"

    def test_empty_string(self):
        assert _extract_text("") == ""

    def test_none_input(self):
        assert _extract_text(None) == ""

    def test_number_input(self):
        assert _extract_text(42) == "42"


class TestParseJsonEvent:
    def test_simple_text_event(self):
        data = {"type": "text", "content": "hello world"}
        event = _parse_json_event(data)
        assert event.type == "text"
        assert event.content == "hello world"

    def test_content_from_message_dict(self):
        """When content is empty, falls back to message.content (dict)."""
        data = {"type": "text", "message": {"content": "from message dict"}}
        event = _parse_json_event(data)
        assert event.content == "from message dict"

    def test_content_from_message_string(self):
        """CRITICAL: message can be a string, not just a dict.

        This was the root cause of the Codex 'str has no attribute get' crash.
        """
        data = {"type": "error", "message": "something went wrong"}
        event = _parse_json_event(data)
        assert event.content == "something went wrong"
        assert event.type == "error"

    def test_top_level_content_takes_priority(self):
        """Top-level content should be used over message field."""
        data = {
            "type": "text",
            "content": "top level",
            "message": {"content": "nested"},
        }
        event = _parse_json_event(data)
        assert event.content == "top level"

    def test_metadata_is_full_data(self):
        data = {"type": "text", "content": "hi", "extra": "field"}
        event = _parse_json_event(data)
        assert event.metadata == data

    def test_defaults_type_to_text(self):
        data = {"content": "no explicit type"}
        event = _parse_json_event(data)
        assert event.type == "text"

    def test_empty_content_and_no_message(self):
        data = {"type": "text"}
        event = _parse_json_event(data)
        assert event.content == ""

    def test_claude_style_content_blocks(self):
        data = {
            "type": "text",
            "content": [
                {"type": "text", "text": "block1"},
                {"type": "text", "text": "block2"},
            ],
        }
        event = _parse_json_event(data)
        assert event.content == "block1block2"


# ---------------------------------------------------------------------------
# _stream_subprocess extra_env tests
# ---------------------------------------------------------------------------


class TestStreamSubprocessExtraEnv:
    """Verify that extra_env is merged into the subprocess environment."""

    @pytest.mark.asyncio
    async def test_extra_env_is_passed_to_subprocess(self):
        """Subprocess should see vars from extra_env."""
        events = []
        async for event in _stream_subprocess(
            # printenv prints all env vars; we grep for our marker
            ["bash", "-c", "echo $__TEST_AGENT_TOKEN"],
            extra_env={"__TEST_AGENT_TOKEN": "secret123"},
        ):
            events.append(event)
        # Should contain the echoed value
        text = "".join(e.content for e in events)
        assert "secret123" in text

    @pytest.mark.asyncio
    async def test_extra_env_overrides_os_environ(self):
        """extra_env should override values from os.environ."""
        with patch.dict(os.environ, {"__TEST_OVERRIDE": "old_value"}):
            events = []
            async for event in _stream_subprocess(
                ["bash", "-c", "echo $__TEST_OVERRIDE"],
                extra_env={"__TEST_OVERRIDE": "new_value"},
            ):
                events.append(event)
            text = "".join(e.content for e in events)
            assert "new_value" in text
            assert "old_value" not in text

    @pytest.mark.asyncio
    async def test_no_extra_env_uses_os_environ(self):
        """Without extra_env, subprocess inherits os.environ."""
        with patch.dict(os.environ, {"__TEST_INHERIT": "inherited"}):
            events = []
            async for event in _stream_subprocess(
                ["bash", "-c", "echo $__TEST_INHERIT"],
            ):
                events.append(event)
            text = "".join(e.content for e in events)
            assert "inherited" in text

    @pytest.mark.asyncio
    async def test_claudecode_env_vars_stripped(self):
        """CLAUDECODE and CLAUDE_CODE_SESSION should be stripped."""
        with patch.dict(
            os.environ,
            {"CLAUDECODE": "yes", "CLAUDE_CODE_SESSION": "sid"},
        ):
            events = []
            async for event in _stream_subprocess(
                ["bash", "-c", "echo CC=$CLAUDECODE CCS=$CLAUDE_CODE_SESSION"],
            ):
                events.append(event)
            text = "".join(e.content for e in events)
            assert "CC= " in text or "CC=" in text
            # Both should be empty
            assert "yes" not in text
            assert "sid" not in text


# ---------------------------------------------------------------------------
# _read_json_config_raw / _read_toml_config_raw tests
# ---------------------------------------------------------------------------


class TestReadJsonConfigRaw:
    def test_reads_env_section_unmasked(self, tmp_path: Path):
        """Should return actual values, not masked."""
        config = {
            "env": {
                "ANTHROPIC_AUTH_TOKEN": "dapi1234567890",
                "ANTHROPIC_BASE_URL": "https://example.com",
            },
            "permissions": {"allow": []},
        }
        f = tmp_path / "settings.json"
        f.write_text(json.dumps(config))
        result = _read_json_config_raw(str(f))
        assert result["env"]["ANTHROPIC_AUTH_TOKEN"] == "dapi1234567890"
        assert result["env"]["ANTHROPIC_BASE_URL"] == "https://example.com"

    def test_missing_file_returns_empty(self, tmp_path: Path):
        result = _read_json_config_raw(str(tmp_path / "nonexistent.json"))
        assert result == {}

    def test_invalid_json_returns_empty(self, tmp_path: Path):
        f = tmp_path / "bad.json"
        f.write_text("not json")
        result = _read_json_config_raw(str(f))
        assert result == {}


class TestReadTomlConfigRaw:
    def test_reads_env_section_unmasked(self, tmp_path: Path):
        toml_content = '[env]\nOPENAI_API_KEY = "sk-test123"\n'
        f = tmp_path / "config.toml"
        f.write_text(toml_content)
        result = _read_toml_config_raw(str(f))
        assert result["env"]["OPENAI_API_KEY"] == "sk-test123"

    def test_missing_file_returns_empty(self, tmp_path: Path):
        result = _read_toml_config_raw(str(tmp_path / "nonexistent.toml"))
        assert result == {}


# ---------------------------------------------------------------------------
# Adapter get_subprocess_env tests
# ---------------------------------------------------------------------------


class TestClaudeCodeAdapterSubprocessEnv:
    def test_returns_env_from_settings(self, tmp_path: Path):
        """get_subprocess_env should return unmasked env from settings.json."""
        from app.services.agents.adapters.claude_code import ClaudeCodeAdapter

        config = {
            "env": {
                "ANTHROPIC_AUTH_TOKEN": "dapi-real-token",
                "ANTHROPIC_BASE_URL": "https://databricks.example.com",
                "ANTHROPIC_MODEL": "databricks-claude-opus-4-6",
            }
        }
        settings_file = tmp_path / "settings.json"
        settings_file.write_text(json.dumps(config))

        adapter = ClaudeCodeAdapter()
        with patch(
            "app.services.agents.adapters.claude_code._read_json_config_raw",
            return_value=config,
        ):
            env = adapter.get_subprocess_env()

        assert env["ANTHROPIC_AUTH_TOKEN"] == "dapi-real-token"
        assert env["ANTHROPIC_BASE_URL"] == "https://databricks.example.com"
        assert env["ANTHROPIC_MODEL"] == "databricks-claude-opus-4-6"

    def test_returns_empty_when_no_env_section(self):
        from app.services.agents.adapters.claude_code import ClaudeCodeAdapter

        adapter = ClaudeCodeAdapter()
        with patch(
            "app.services.agents.adapters.claude_code._read_json_config_raw",
            return_value={"permissions": {"allow": []}},
        ):
            env = adapter.get_subprocess_env()
        assert env == {}

    def test_returns_empty_when_file_missing(self):
        from app.services.agents.adapters.claude_code import ClaudeCodeAdapter

        adapter = ClaudeCodeAdapter()
        with patch(
            "app.services.agents.adapters.claude_code._read_json_config_raw",
            return_value={},
        ):
            env = adapter.get_subprocess_env()
        assert env == {}

    def test_skips_none_values(self):
        from app.services.agents.adapters.claude_code import ClaudeCodeAdapter

        adapter = ClaudeCodeAdapter()
        with patch(
            "app.services.agents.adapters.claude_code._read_json_config_raw",
            return_value={"env": {"KEY": "val", "EMPTY": None}},
        ):
            env = adapter.get_subprocess_env()
        assert env == {"KEY": "val"}


class TestCodexAdapterSubprocessEnv:
    def test_returns_env_from_config(self):
        from app.services.agents.adapters.codex import CodexAdapter

        adapter = CodexAdapter()
        with patch(
            "app.services.agents.adapters.codex._read_toml_config_raw",
            return_value={"env": {"OPENAI_API_KEY": "sk-test"}},
        ):
            env = adapter.get_subprocess_env()
        assert env == {"OPENAI_API_KEY": "sk-test"}

    def test_returns_empty_when_no_env_section(self):
        from app.services.agents.adapters.codex import CodexAdapter

        adapter = CodexAdapter()
        with patch(
            "app.services.agents.adapters.codex._read_toml_config_raw",
            return_value={"model": "gpt-4o"},
        ):
            env = adapter.get_subprocess_env()
        assert env == {}


class TestCopilotAdapterSubprocessEnv:
    def test_base_returns_empty(self):
        """Copilot has no config-based env; base method returns {}."""
        from app.services.agents.adapters.copilot import CopilotAdapter

        adapter = CopilotAdapter()
        env = adapter.get_subprocess_env()
        assert env == {}
