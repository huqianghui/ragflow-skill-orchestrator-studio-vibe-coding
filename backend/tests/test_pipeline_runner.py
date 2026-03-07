"""Unit tests for PipelineRunner — uses only local skills (no connection needed)."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.data.builtin_skills import BUILTIN_SKILLS
from app.models.base import BaseModel as AppBase
from app.models.skill import Skill
from app.services.pipeline.runner import PipelineRunner


@pytest_asyncio.fixture
async def db():
    """In-memory SQLite session with all built-in skills seeded."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(AppBase.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        for skill_def in BUILTIN_SKILLS:
            session.add(Skill(**skill_def))
        await session.commit()
        yield session

    await engine.dispose()


def _make_pipeline(nodes: list[dict]) -> dict:
    return {"graph_data": {"nodes": nodes}}


@pytest.mark.asyncio
async def test_single_node_conditional(db):
    """Single Conditional node succeeds without connection."""
    pipeline = _make_pipeline(
        [
            {
                "id": "n1",
                "skill_name": "Conditional",
                "position": 0,
                "context": "/document",
                "inputs": [],
                "outputs": [
                    {"name": "matches", "targetName": "conditionResult"},
                ],
                "config_overrides": {
                    "condition_field": "file_name",
                    "operator": "contains",
                    "condition_value": ".pdf",
                },
            },
        ]
    )

    runner = PipelineRunner()
    result = await runner.execute(pipeline, b"content", "report.pdf", db)

    assert result["status"] == "success"
    assert len(result["node_results"]) == 1
    assert result["node_results"][0]["status"] == "success"
    assert result["total_execution_time_ms"] >= 0


@pytest.mark.asyncio
async def test_two_node_local_pipeline(db):
    """TextSplitter → TextMerger using tree to chain data."""
    # TextSplitter reads /document/content. We pre-populate it by encoding text
    # as file_content and passing file_name. But TextSplitter needs /document/content
    # not /document/file_content. So we manually set content via the runner.
    # Better: use a Shaper node to copy file_content to content.
    #
    # Simplest: just use TextSplitter which reads "text" from data — if we
    # set up the source as /document/file_name it reads the filename string.
    #
    # Actually, let's create a proper test by using the runner's tree directly.
    # We'll subclass PipelineRunner for test to seed the tree.

    runner = PipelineRunner()

    # We'll test by making TextSplitter read from /document/file_name
    # which is set to a long string that can be split.
    long_name = "word " * 100  # 500 chars
    pipeline = _make_pipeline(
        [
            {
                "id": "n1",
                "skill_name": "TextSplitter",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/file_name"},
                ],
                "outputs": [
                    {"name": "chunks", "targetName": "chunks"},
                    {"name": "totalChunks", "targetName": "totalChunks"},
                ],
                "config_overrides": {"chunk_size": 100, "chunk_overlap": 10},
            },
            {
                "id": "n2",
                "skill_name": "TextMerger",
                "position": 1,
                "context": "/document",
                "inputs": [
                    {"name": "texts", "source": "/document/chunks"},
                ],
                "outputs": [
                    {"name": "text", "targetName": "mergedText"},
                    {"name": "sourceCount", "targetName": "mergeSourceCount"},
                ],
                "config_overrides": {"separator": " | "},
            },
        ]
    )

    result = await runner.execute(pipeline, b"bytes", long_name, db)

    assert result["status"] == "success"
    assert len(result["node_results"]) == 2
    assert result["node_results"][0]["skill_name"] == "TextSplitter"
    assert result["node_results"][0]["status"] == "success"
    assert result["node_results"][1]["skill_name"] == "TextMerger"
    assert result["node_results"][1]["status"] == "success"

    tree = result["enrichment_tree"]
    assert "chunks" in tree["document"]
    assert "mergedText" in tree["document"]
    assert "mergeSourceCount" in tree["document"]


@pytest.mark.asyncio
async def test_fan_out_per_chunk(db):
    """TextSplitter → Conditional with fan-out over chunks."""
    long_text = "hello world " * 50
    pipeline = _make_pipeline(
        [
            {
                "id": "n1",
                "skill_name": "TextSplitter",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/file_name"},
                ],
                "outputs": [
                    {"name": "chunks", "targetName": "chunks"},
                    {"name": "totalChunks", "targetName": "totalChunks"},
                ],
                "config_overrides": {"chunk_size": 100, "chunk_overlap": 0},
            },
            {
                "id": "n2",
                "skill_name": "Conditional",
                "position": 1,
                "context": "/document/chunks/*",
                "inputs": [],
                "outputs": [
                    {"name": "matches", "targetName": "conditionResult"},
                ],
                "config_overrides": {
                    "condition_field": "text",
                    "operator": "contains",
                    "condition_value": "hello",
                },
            },
        ]
    )

    runner = PipelineRunner()
    result = await runner.execute(pipeline, b"data", long_text, db)

    assert result["status"] == "success"
    assert len(result["node_results"]) == 2
    fan_out = result["node_results"][1]
    assert fan_out["records_processed"] >= 2  # Multiple chunks processed


@pytest.mark.asyncio
async def test_error_on_node_returns_partial(db):
    """Missing skill causes error; later nodes are skipped."""
    pipeline = _make_pipeline(
        [
            {
                "id": "n1",
                "skill_name": "Conditional",
                "position": 0,
                "context": "/document",
                "inputs": [],
                "outputs": [
                    {"name": "matches", "targetName": "conditionResult"},
                ],
                "config_overrides": {
                    "condition_field": "file_name",
                    "operator": "equals",
                    "condition_value": "test.txt",
                },
            },
            {
                "id": "n2",
                "skill_name": "DoesNotExist",
                "position": 1,
                "context": "/document",
                "inputs": [],
                "outputs": [],
                "config_overrides": {},
            },
            {
                "id": "n3",
                "skill_name": "Conditional",
                "position": 2,
                "context": "/document",
                "inputs": [],
                "outputs": [],
                "config_overrides": {},
            },
        ]
    )

    runner = PipelineRunner()
    result = await runner.execute(pipeline, b"test", "test.txt", db)

    assert result["status"] == "partial"
    # n1 succeeds, n2 errors, n3 never runs
    assert len(result["node_results"]) == 2
    assert result["node_results"][0]["status"] == "success"
    assert result["node_results"][1]["status"] == "error"
    assert len(result["node_results"][1]["errors"]) > 0


@pytest.mark.asyncio
async def test_snapshots_recorded(db):
    """Node results contain input/output snapshots."""
    pipeline = _make_pipeline(
        [
            {
                "id": "n1",
                "skill_name": "Conditional",
                "position": 0,
                "context": "/document",
                "inputs": [],
                "outputs": [
                    {"name": "matches", "targetName": "conditionResult"},
                ],
                "config_overrides": {
                    "condition_field": "file_name",
                    "operator": "equals",
                    "condition_value": "test.pdf",
                },
            },
        ]
    )

    runner = PipelineRunner()
    result = await runner.execute(pipeline, b"pdf bytes", "test.pdf", db)

    nr = result["node_results"][0]
    assert nr["records_processed"] == 1
    assert len(nr["input_snapshots"]) == 1
    assert len(nr["output_snapshots"]) == 1
    # Output should contain "matches" key
    assert "matches" in nr["output_snapshots"][0]


@pytest.mark.asyncio
async def test_connection_resolution_fails_for_remote_skill(db):
    """Skills requiring a connection fail gracefully when none exists."""
    pipeline = _make_pipeline(
        [
            {
                "id": "n1",
                "skill_name": "TextEmbedder",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/file_name"},
                ],
                "outputs": [
                    {"name": "embedding", "targetName": "embedding"},
                ],
                "config_overrides": {},
            },
        ]
    )

    runner = PipelineRunner()
    result = await runner.execute(pipeline, b"data", "test.txt", db)

    assert result["status"] == "partial"
    assert result["node_results"][0]["status"] == "error"
    assert "No connection available" in result["node_results"][0]["errors"][0]["message"]
