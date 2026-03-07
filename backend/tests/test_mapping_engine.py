"""Unit tests for the mapping engine."""

from app.schemas.target import TargetSchemaField
from app.services.mapping_engine import (
    apply_mapping,
    infer_pipeline_outputs,
    suggest_mappings,
    validate_mapping,
)


def _make_pipeline(nodes=None):
    return {"graph_data": {"nodes": nodes or []}}


# --- infer_pipeline_outputs ---


def test_infer_outputs_empty():
    outputs = infer_pipeline_outputs(_make_pipeline())
    # Should contain at least the initial fields
    paths = [o["path"] for o in outputs]
    assert "/document/file_content" in paths
    assert "/document/file_name" in paths


def test_infer_outputs_with_nodes():
    pipeline = _make_pipeline(
        [
            {
                "skill_name": "DocumentCracker",
                "position": 0,
                "context": "/document",
                "outputs": [{"targetName": "content"}],
                "config_overrides": {},
            },
        ]
    )
    outputs = infer_pipeline_outputs(pipeline)
    paths = [o["path"] for o in outputs]
    assert "/document/content" in paths


# --- suggest_mappings ---


def test_suggest_exact_match():
    outputs = [
        {"path": "/document/content", "type": "string", "from_skill": "DC"},
        {"path": "/document/embedding", "type": "vector", "from_skill": "TE"},
    ]
    schema = [
        TargetSchemaField(name="content", type="string"),
        TargetSchemaField(name="embedding", type="vector"),
    ]
    suggestions = suggest_mappings(outputs, schema)
    assert len(suggestions) == 2
    assert suggestions[0]["match_quality"] == "exact"


def test_suggest_case_insensitive():
    outputs = [{"path": "/doc/Title", "type": "string", "from_skill": "DC"}]
    schema = [TargetSchemaField(name="title", type="string")]
    suggestions = suggest_mappings(outputs, schema)
    assert len(suggestions) == 1
    assert suggestions[0]["match_quality"] == "case_insensitive"


def test_suggest_snake_camel():
    outputs = [{"path": "/doc/chunkText", "type": "string", "from_skill": "DC"}]
    schema = [TargetSchemaField(name="chunk_text", type="string")]
    suggestions = suggest_mappings(outputs, schema)
    assert len(suggestions) == 1
    assert suggestions[0]["match_quality"] == "name_convention"


def test_suggest_type_compat():
    outputs = [{"path": "/doc/count", "type": "string", "from_skill": "DC"}]
    schema = [TargetSchemaField(name="count", type="int")]
    suggestions = suggest_mappings(outputs, schema)
    assert len(suggestions) == 1
    assert suggestions[0]["type_compatible"] is False


# --- validate_mapping ---


def test_validate_missing_key_field():
    result = validate_mapping(
        "azure_ai_search",
        {"write_mode": "upsert", "mappings": []},
        [],
        [],
    )
    assert result.valid is False
    assert any("key_field" in e for e in result.errors)


def test_validate_vector_missing_dimensions():
    outputs = [{"path": "/doc/emb", "type": "vector", "from_skill": "TE"}]
    result = validate_mapping(
        "azure_ai_search",
        {
            "write_mode": "insert",
            "mappings": [{"source": "/doc/emb", "target": "vec", "target_type": "vector"}],
        },
        outputs,
        [],
    )
    assert result.valid is False
    assert any("dimensions" in e for e in result.errors)


def test_validate_valid_mapping():
    outputs = [
        {"path": "/doc/id", "type": "string", "from_skill": "input"},
        {"path": "/doc/content", "type": "string", "from_skill": "DC"},
    ]
    schema = [
        TargetSchemaField(name="id", type="string", key=True),
        TargetSchemaField(name="content", type="string"),
    ]
    result = validate_mapping(
        "azure_ai_search",
        {
            "write_mode": "upsert",
            "key_field": {"source": "/doc/id", "target": "id"},
            "mappings": [
                {"source": "/doc/content", "target": "content", "target_type": "string"},
            ],
        },
        outputs,
        schema,
    )
    assert result.valid is True


def test_validate_source_not_found():
    result = validate_mapping(
        "azure_ai_search",
        {
            "write_mode": "insert",
            "mappings": [
                {"source": "/doc/nonexistent", "target": "x", "target_type": "string"},
            ],
        },
        [{"path": "/doc/content", "type": "string", "from_skill": "DC"}],
        [],
    )
    assert result.valid is False
    assert any("not found" in e for e in result.errors)


# --- apply_mapping ---


def test_apply_mapping_document_level():
    data = {
        "document": {
            "metadata": {"id": "doc1"},
            "content": "Hello world",
        }
    }
    mappings = {
        "write_context": "/document",
        "key_field": {"source": "/document/metadata/id", "target": "id"},
        "mappings": [
            {"source": "/document/content", "target": "text"},
        ],
    }
    records = apply_mapping(mappings, data)
    assert len(records) == 1
    assert records[0]["text"] == "Hello world"


def test_apply_mapping_chunk_level():
    data = {
        "document": {
            "chunks": [
                {"text": "chunk1", "embedding": [0.1, 0.2]},
                {"text": "chunk2", "embedding": [0.3, 0.4]},
            ],
        }
    }
    mappings = {
        "write_context": "/document/chunks/*",
        "mappings": [
            {"source": "/document/chunks/*/text", "target": "content"},
            {"source": "/document/chunks/*/embedding", "target": "vec"},
        ],
    }
    records = apply_mapping(mappings, data)
    assert len(records) == 2
    assert records[0]["content"] == "chunk1"
    assert records[1]["vec"] == [0.3, 0.4]
