"""Tests for agent base module: _parse_json_event, _extract_text, utilities."""

from app.services.agents.base import _extract_text, _parse_json_event


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
