"""Tests for BuiltinSkillRunner — utility skills that need no external client."""

from app.services.builtin_skills.runner import BuiltinSkillRunner


def test_text_splitter_fixed_size():
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "TextSplitter",
        {"values": [{"recordId": "1", "data": {"text": "a" * 100}}]},
        {"chunk_size": 30, "chunk_overlap": 10, "split_method": "fixed_size"},
        None,
    )
    assert len(result["values"]) == 1
    chunks = result["values"][0]["data"]["chunks"]
    assert len(chunks) > 1
    assert result["values"][0]["errors"] == []


def test_text_splitter_recursive():
    runner = BuiltinSkillRunner()
    text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
    result = runner.execute(
        "TextSplitter",
        {"values": [{"recordId": "1", "data": {"text": text}}]},
        {"chunk_size": 30, "split_method": "recursive"},
        None,
    )
    chunks = result["values"][0]["data"]["chunks"]
    assert len(chunks) >= 2
    assert result["values"][0]["data"]["totalChunks"] == len(chunks)


def test_text_merger():
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "TextMerger",
        {"values": [{"recordId": "1", "data": {"texts": ["Hello", "World"]}}]},
        {"separator": " "},
        None,
    )
    assert result["values"][0]["data"]["text"] == "Hello World"
    assert result["values"][0]["data"]["sourceCount"] == 2


def test_text_merger_max_length():
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "TextMerger",
        {"values": [{"recordId": "1", "data": {"texts": ["Hello", "World"]}}]},
        {"separator": " ", "max_length": 7},
        None,
    )
    assert result["values"][0]["data"]["text"] == "Hello W"


def test_shaper():
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "Shaper",
        {
            "values": [
                {
                    "recordId": "1",
                    "data": {"nested": {"value": 42}, "name": "test"},
                }
            ]
        },
        {
            "field_mappings": [
                {"source": "nested.value", "target": "output_val"},
                {"source": "name", "target": "output_name"},
                {"source": "missing", "target": "fallback", "default_value": "N/A"},
            ]
        },
        None,
    )
    data = result["values"][0]["data"]
    assert data["output_val"] == 42
    assert data["output_name"] == "test"
    assert data["fallback"] == "N/A"


def test_conditional_equals():
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "Conditional",
        {"values": [{"recordId": "1", "data": {"status": "active"}}]},
        {"condition_field": "status", "operator": "equals", "condition_value": "active"},
        None,
    )
    assert result["values"][0]["data"]["matches"] is True


def test_conditional_not_equals():
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "Conditional",
        {"values": [{"recordId": "1", "data": {"status": "inactive"}}]},
        {"condition_field": "status", "operator": "equals", "condition_value": "active"},
        None,
    )
    assert result["values"][0]["data"]["matches"] is False


def test_conditional_contains():
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "Conditional",
        {"values": [{"recordId": "1", "data": {"text": "hello world"}}]},
        {"condition_field": "text", "operator": "contains", "condition_value": "world"},
        None,
    )
    assert result["values"][0]["data"]["matches"] is True


def test_conditional_greater_than():
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "Conditional",
        {"values": [{"recordId": "1", "data": {"score": 85}}]},
        {"condition_field": "score", "operator": "greater_than", "condition_value": 70},
        None,
    )
    assert result["values"][0]["data"]["matches"] is True


def test_conditional_regex():
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "Conditional",
        {"values": [{"recordId": "1", "data": {"email": "test@example.com"}}]},
        {"condition_field": "email", "operator": "regex_match", "condition_value": r"@\w+\.com$"},
        None,
    )
    assert result["values"][0]["data"]["matches"] is True


def test_unknown_skill_raises():
    runner = BuiltinSkillRunner()
    try:
        runner.execute("NonExistentSkill", {"values": []}, {}, None)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "Unknown built-in skill" in str(e)


def test_multiple_records():
    """BuiltinSkillRunner processes multiple records, errors per-record."""
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "TextMerger",
        {
            "values": [
                {"recordId": "1", "data": {"texts": ["a", "b"]}},
                {"recordId": "2", "data": {"texts": ["c", "d", "e"]}},
            ]
        },
        {"separator": ","},
        None,
    )
    assert len(result["values"]) == 2
    assert result["values"][0]["data"]["text"] == "a,b"
    assert result["values"][1]["data"]["text"] == "c,d,e"
    assert "execution_time_ms" in result


def test_per_record_error_handling():
    """If one record causes an error, other records still succeed."""
    runner = BuiltinSkillRunner()
    # TextMerger expects data["texts"] to be a list; giving it None should cause an error
    result = runner.execute(
        "Shaper",
        {
            "values": [
                {"recordId": "1", "data": {"x": 1}},
                {"recordId": "2", "data": {"x": 2}},
            ]
        },
        {"field_mappings": [{"source": "x", "target": "out"}]},
        None,
    )
    # Both should succeed
    assert result["values"][0]["data"]["out"] == 1
    assert result["values"][1]["data"]["out"] == 2


def test_auto_record_id():
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "TextMerger",
        {"values": [{"data": {"texts": ["a"]}}]},
        {},
        None,
    )
    assert result["values"][0]["recordId"] == "record_0"


def test_ocr_text_passthrough():
    """OCR returns text as-is when no image is provided."""
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "OCR",
        {"values": [{"recordId": "1", "data": {"text": "already extracted text"}}]},
        {},
        None,
    )
    assert result["values"][0]["data"]["text"] == "already extracted text"


def test_document_cracker_text_passthrough():
    """DocumentCracker passes through text when no file_content."""
    runner = BuiltinSkillRunner()
    result = runner.execute(
        "DocumentCracker",
        {"values": [{"recordId": "1", "data": {"text": "plain text"}}]},
        {},
        None,
    )
    assert result["values"][0]["data"]["text"] == "plain text"
