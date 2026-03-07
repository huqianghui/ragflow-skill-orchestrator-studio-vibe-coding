"""Unit tests for the target index manager."""

from app.services.target_index_manager import (
    _DEFAULT_DIMENSIONS,
    _infer_pipeline_output_fields,
    _infer_vector_dimensions,
    infer_index_schema,
)


def _make_pipeline(nodes=None):
    return {"graph_data": {"nodes": nodes or []}}


def test_infer_dimensions_default():
    """Returns default 1536 when no info available."""
    pipeline = _make_pipeline()
    assert _infer_vector_dimensions(pipeline) == _DEFAULT_DIMENSIONS


def test_infer_dimensions_from_field_mappings():
    """Priority 1: explicit vector_config.dimensions in field_mappings."""
    pipeline = _make_pipeline()
    mappings = {"mappings": [{"vector_config": {"dimensions": 768}}]}
    assert _infer_vector_dimensions(pipeline, mappings) == 768


def test_infer_dimensions_from_embedder_config():
    """Priority 2: TextEmbedder config_overrides.dimensions."""
    pipeline = _make_pipeline(
        [
            {
                "skill_name": "TextEmbedder",
                "position": 1,
                "config_overrides": {"dimensions": 512},
                "outputs": [],
            }
        ]
    )
    assert _infer_vector_dimensions(pipeline) == 512


def test_infer_dimensions_from_model_name():
    """Priority 3: model_name lookup table."""
    pipeline = _make_pipeline(
        [
            {
                "skill_name": "TextEmbedder",
                "position": 1,
                "config_overrides": {"model_name": "text-embedding-3-large"},
                "outputs": [],
            }
        ]
    )
    assert _infer_vector_dimensions(pipeline) == 3072


def test_infer_pipeline_outputs_basic():
    """Extracts output paths from pipeline nodes."""
    pipeline = _make_pipeline(
        [
            {
                "skill_name": "DocumentCracker",
                "position": 0,
                "context": "/document",
                "outputs": [{"targetName": "content"}],
                "config_overrides": {},
            },
            {
                "skill_name": "TextSplitter",
                "position": 1,
                "context": "/document/chunks/*",
                "outputs": [{"targetName": "text"}],
                "config_overrides": {},
            },
        ]
    )
    fields = _infer_pipeline_output_fields(pipeline)
    paths = [f["path"] for f in fields]
    assert "/document/content" in paths
    assert "/document/chunks/*/text" in paths
    assert "/document/file_content" in paths  # initial fields


def test_infer_pipeline_outputs_embedder():
    """TextEmbedder output is typed as vector with hint."""
    pipeline = _make_pipeline(
        [
            {
                "skill_name": "TextEmbedder",
                "position": 2,
                "context": "/document/chunks/*",
                "outputs": [{"targetName": "embedding"}],
                "config_overrides": {"model_name": "text-embedding-ada-002"},
            },
        ]
    )
    fields = _infer_pipeline_output_fields(pipeline)
    emb = next(f for f in fields if f["path"] == "/document/chunks/*/embedding")
    assert emb["type"] == "vector"
    assert emb["vector_hint"]["dimensions"] == 1536


def test_infer_index_schema_basic():
    """Generates a complete index schema with id key field."""
    pipeline = _make_pipeline(
        [
            {
                "skill_name": "DocumentCracker",
                "position": 0,
                "context": "/document",
                "outputs": [{"targetName": "content"}],
                "config_overrides": {},
            },
            {
                "skill_name": "TextEmbedder",
                "position": 1,
                "context": "/document",
                "outputs": [{"targetName": "embedding"}],
                "config_overrides": {},
            },
        ]
    )
    schema = infer_index_schema(pipeline)

    names = [s.name for s in schema]
    assert "id" in names
    assert "content" in names
    assert "embedding" in names

    # id should be key
    id_field = next(s for s in schema if s.name == "id")
    assert id_field.key is True

    # embedding should be vector
    emb_field = next(s for s in schema if s.name == "embedding")
    assert emb_field.type == "vector"
    assert emb_field.vector_config is not None
    assert emb_field.vector_config["dimensions"] == 1536
