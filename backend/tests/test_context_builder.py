"""Tests for ContextBuilder — skill, pipeline, error, free context assembly."""

import json

import pytest

from app.services.agents.context_builder import ContextBuilder


@pytest.fixture
def builder():
    return ContextBuilder()


def test_free_context_returns_prompt_only(builder):
    result = builder.build(None, "hello")
    assert result == "hello"


def test_free_type_returns_prompt_only(builder):
    result = builder.build({"type": "free"}, "hello")
    assert result == "hello"


def test_skill_context(builder):
    ctx = {
        "type": "skill",
        "skill": {
            "name": "data_cleaner",
            "skill_type": "python",
            "description": "Cleans data",
            "source_code": "def run(df): return df.dropna()",
            "test_input": {"col": "value"},
        },
    }
    result = builder.build(ctx, "fix the bug")
    assert "## Current Skill Context" in result
    assert "data_cleaner" in result
    assert "def run(df)" in result
    assert json.dumps({"col": "value"}, indent=2) in result
    assert "## User Request" in result
    assert "fix the bug" in result


def test_pipeline_context(builder):
    ctx = {
        "type": "pipeline",
        "pipeline": {
            "name": "my_pipeline",
            "status": "draft",
            "graph_data": {
                "nodes": [
                    {"position": 1, "label": "Extract"},
                    {"position": 2, "label": "Transform"},
                ]
            },
        },
    }
    result = builder.build(ctx, "add a new node")
    assert "## Current Pipeline Context" in result
    assert "my_pipeline" in result
    assert "Extract" in result
    assert "Transform" in result
    assert "## User Request" in result


def test_error_context(builder):
    ctx = {
        "type": "skill",
        "skill": {"name": "test_skill"},
        "error_result": {
            "message": "IndexError: list index",
            "traceback": "File line 10\n  IndexError",
        },
    }
    result = builder.build(ctx, "fix this")
    assert "## Error Context" in result
    assert "IndexError" in result


def test_attachments_context(builder):
    ctx = {
        "type": "skill",
        "skill": {"name": "test_skill"},
        "attachments": [
            {"type": "text", "content": "Some reference doc"},
            {"type": "code", "content": "import os"},
        ],
    }
    result = builder.build(ctx, "help me")
    assert "## Additional Context" in result
    assert "Some reference doc" in result
    assert "import os" in result


def test_skill_without_optional_fields(builder):
    ctx = {
        "type": "skill",
        "skill": {"name": "minimal"},
    }
    result = builder.build(ctx, "do something")
    assert "## Current Skill Context" in result
    assert "minimal" in result
    assert "## User Request" in result
