"""Tests for Pipeline CRUD API endpoints."""

from unittest.mock import AsyncMock, patch

import pytest

from app.models.pipeline import Pipeline
from app.models.skill import Skill

# --------------- POST /api/v1/pipelines ---------------


@pytest.mark.asyncio
async def test_create_pipeline_minimal(client):
    """POST with only name creates pipeline with defaults."""
    resp = await client.post("/api/v1/pipelines", json={"name": "Test Pipeline"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Pipeline"
    assert data["status"] == "draft"
    assert data["description"] is None
    assert data["graph_data"] == {"nodes": [], "edges": []}
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_pipeline_with_all_fields(client):
    """POST with all fields sets them correctly."""
    body = {
        "name": "Full Pipeline",
        "description": "A test pipeline",
        "graph_data": {
            "nodes": [
                {
                    "id": "n1",
                    "skill_name": "TextSplitter",
                    "label": "Split",
                    "position": 0,
                    "context": "/document",
                    "inputs": [{"name": "text", "source": "/document/content"}],
                    "outputs": [{"name": "chunks", "targetName": "chunks"}],
                    "config_overrides": {},
                }
            ]
        },
    }
    resp = await client.post("/api/v1/pipelines", json=body)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Full Pipeline"
    assert data["description"] == "A test pipeline"
    assert len(data["graph_data"]["nodes"]) == 1


@pytest.mark.asyncio
async def test_create_pipeline_name_required(client):
    """POST without name returns 422."""
    resp = await client.post("/api/v1/pipelines", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_pipeline_empty_name(client):
    """POST with empty name returns 422."""
    resp = await client.post("/api/v1/pipelines", json={"name": ""})
    assert resp.status_code == 422


# --------------- GET /api/v1/pipelines ---------------


@pytest.mark.asyncio
async def test_list_pipelines_empty(client):
    """GET list returns empty page when no pipelines exist."""
    resp = await client.get("/api/v1/pipelines")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_list_pipelines_pagination(client, db_session):
    """GET list respects page and page_size params."""
    for i in range(5):
        db_session.add(Pipeline(name=f"Pipeline {i}"))
    await db_session.commit()

    resp = await client.get("/api/v1/pipelines?page=1&page_size=2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 2


@pytest.mark.asyncio
async def test_list_pipelines_ordered_by_created_at_desc(client, db_session):
    """Pipelines are returned newest first."""
    from datetime import datetime

    p1 = Pipeline(name="First")
    p1.created_at = datetime(2024, 1, 1, 0, 0, 0)
    db_session.add(p1)
    p2 = Pipeline(name="Second")
    p2.created_at = datetime(2024, 1, 2, 0, 0, 0)
    db_session.add(p2)
    await db_session.commit()

    resp = await client.get("/api/v1/pipelines")
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["items"][0]["name"] == "Second"
    assert data["items"][1]["name"] == "First"


# --------------- GET /api/v1/pipelines/{id} ---------------


@pytest.mark.asyncio
async def test_get_pipeline_by_id(client, db_session):
    """GET by ID returns the correct pipeline."""
    p = Pipeline(name="My Pipeline", description="desc")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.get(f"/api/v1/pipelines/{p.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == p.id
    assert data["name"] == "My Pipeline"
    assert data["description"] == "desc"


@pytest.mark.asyncio
async def test_get_pipeline_not_found(client):
    """GET with non-existent ID returns 404."""
    resp = await client.get("/api/v1/pipelines/nonexistent-id")
    assert resp.status_code == 404


# --------------- PUT /api/v1/pipelines/{id} ---------------


@pytest.mark.asyncio
async def test_update_pipeline_name(client, db_session):
    """PUT updates the name field."""
    p = Pipeline(name="Original")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.put(f"/api/v1/pipelines/{p.id}", json={"name": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"


@pytest.mark.asyncio
async def test_update_pipeline_status(client, db_session):
    """PUT updates status field."""
    p = Pipeline(name="P1")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.put(f"/api/v1/pipelines/{p.id}", json={"status": "validated"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "validated"


@pytest.mark.asyncio
async def test_update_pipeline_invalid_status(client, db_session):
    """PUT with invalid status returns 422."""
    p = Pipeline(name="P1")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.put(f"/api/v1/pipelines/{p.id}", json={"status": "invalid"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_pipeline_graph_data(client, db_session):
    """PUT updates graph_data."""
    p = Pipeline(name="P1")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    new_graph = {"nodes": [{"id": "n1", "skill_name": "TextSplitter"}]}
    resp = await client.put(f"/api/v1/pipelines/{p.id}", json={"graph_data": new_graph})
    assert resp.status_code == 200
    assert resp.json()["graph_data"]["nodes"][0]["skill_name"] == "TextSplitter"


@pytest.mark.asyncio
async def test_update_pipeline_not_found(client):
    """PUT with non-existent ID returns 404."""
    resp = await client.put("/api/v1/pipelines/nonexistent-id", json={"name": "X"})
    assert resp.status_code == 404


# --------------- DELETE /api/v1/pipelines/{id} ---------------


@pytest.mark.asyncio
async def test_delete_pipeline(client, db_session):
    """DELETE removes the pipeline and returns 204."""
    p = Pipeline(name="To Delete")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.delete(f"/api/v1/pipelines/{p.id}")
    assert resp.status_code == 204

    # Confirm deleted
    resp = await client.get(f"/api/v1/pipelines/{p.id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_pipeline_not_found(client):
    """DELETE with non-existent ID returns 404."""
    resp = await client.delete("/api/v1/pipelines/nonexistent-id")
    assert resp.status_code == 404


# --------------- GET /api/v1/pipelines/available-skills ---------------


@pytest.mark.asyncio
async def test_available_skills_empty(client):
    """Returns empty list when no skills exist."""
    resp = await client.get("/api/v1/pipelines/available-skills")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_available_skills_returns_all(client, db_session):
    """Returns all skills sorted by name."""
    db_session.add(Skill(name="Zebra", skill_type="builtin", is_builtin=True))
    db_session.add(Skill(name="Alpha", skill_type="python_code", is_builtin=False))
    await db_session.commit()

    resp = await client.get("/api/v1/pipelines/available-skills")
    assert resp.status_code == 200
    skills = resp.json()
    assert len(skills) == 2
    assert skills[0]["name"] == "Alpha"
    assert skills[1]["name"] == "Zebra"


# --------------- GET /api/v1/pipelines/templates ---------------


@pytest.mark.asyncio
async def test_templates_returns_list(client):
    """Returns a non-empty list of templates with required fields."""
    resp = await client.get("/api/v1/pipelines/templates")
    assert resp.status_code == 200
    templates = resp.json()
    assert isinstance(templates, list)
    assert len(templates) >= 1
    for t in templates:
        assert "name" in t
        assert "description" in t
        assert "nodes" in t
        assert isinstance(t["nodes"], list)


# --------------- POST /api/v1/pipelines/{id}/debug ---------------


@pytest.mark.asyncio
async def test_debug_pipeline_success(client, db_session):
    """Debug executes the pipeline and returns results."""
    graph = {
        "nodes": [
            {
                "id": "n1",
                "skill_name": "Conditional",
                "label": "Test",
                "position": 0,
                "context": "/document",
                "inputs": [{"name": "data", "source": "/document/file_content"}],
                "outputs": [{"name": "result", "targetName": "result"}],
                "config_overrides": {},
            }
        ]
    }
    p = Pipeline(name="Debug Pipeline", graph_data=graph)
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    mock_result = {
        "status": "success",
        "enrichment_tree": {"/document/file_content": "hello"},
        "node_results": [{"node_id": "n1", "status": "success"}],
        "total_execution_time_ms": 42,
    }

    with patch("app.services.pipeline.runner.PipelineRunner") as MockRunner:
        instance = MockRunner.return_value
        instance.execute = AsyncMock(return_value=mock_result)

        resp = await client.post(
            f"/api/v1/pipelines/{p.id}/debug",
            files={"file": ("test.txt", b"hello world", "text/plain")},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["total_execution_time_ms"] == 42
    # Debug should create a Run record
    assert "run_id" in data

    # Verify Run record exists in DB via API
    run_resp = await client.get(f"/api/v1/runs/{data['run_id']}")
    assert run_resp.status_code == 200
    run_data = run_resp.json()
    assert run_data["pipeline_id"] == p.id
    assert run_data["status"] == "completed"
    assert run_data["total_documents"] == 1
    assert run_data["processed_documents"] == 1

    # Verify Run record shows up in unified pipeline-runs
    pr_resp = await client.get("/api/v1/pipeline-runs?source=standalone")
    pr_data = pr_resp.json()
    run_ids = [item["id"] for item in pr_data["items"]]
    assert data["run_id"] in run_ids


@pytest.mark.asyncio
async def test_debug_pipeline_not_found(client):
    """Debug with non-existent pipeline returns 404."""
    resp = await client.post(
        "/api/v1/pipelines/nonexistent-id/debug",
        files={"file": ("test.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_debug_pipeline_no_nodes(client, db_session):
    """Debug pipeline with no nodes returns 422."""
    p = Pipeline(name="Empty Pipeline", graph_data={"nodes": []})
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.post(
        f"/api/v1/pipelines/{p.id}/debug",
        files={"file": ("test.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 422


# --------------- POST /api/v1/pipelines/{id}/validate ---------------


@pytest.mark.asyncio
async def test_validate_pipeline_success(client, db_session):
    """Valid pipeline: all sources reachable. Status updated to validated."""
    graph = {
        "nodes": [
            {
                "id": "n1",
                "skill_name": "DocumentCracker",
                "label": "Crack",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {"name": "file_content", "source": "/document/file_content"},
                    {"name": "file_name", "source": "/document/file_name"},
                ],
                "outputs": [
                    {"name": "content", "targetName": "content"},
                ],
                "config_overrides": {},
            },
            {
                "id": "n2",
                "skill_name": "TextSplitter",
                "label": "Split",
                "position": 1,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/content"},
                ],
                "outputs": [
                    {"name": "chunks", "targetName": "chunks"},
                ],
                "config_overrides": {},
            },
        ]
    }
    p = Pipeline(name="Valid Pipeline", graph_data=graph)
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.post(f"/api/v1/pipelines/{p.id}/validate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["errors"] == []

    # Status should be updated
    get_resp = await client.get(f"/api/v1/pipelines/{p.id}")
    assert get_resp.json()["status"] == "validated"


@pytest.mark.asyncio
async def test_validate_pipeline_source_not_available(client, db_session):
    """Source path not produced by any preceding node."""
    graph = {
        "nodes": [
            {
                "id": "n1",
                "skill_name": "TextSplitter",
                "label": "Split",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/nonexistent"},
                ],
                "outputs": [],
                "config_overrides": {},
            },
        ]
    }
    p = Pipeline(name="Bad Pipeline", graph_data=graph)
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.post(f"/api/v1/pipelines/{p.id}/validate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert len(data["errors"]) == 1
    err = data["errors"][0]
    assert err["node_id"] == "n1"
    assert err["input_name"] == "text"
    assert err["source"] == "/document/nonexistent"


@pytest.mark.asyncio
async def test_validate_pipeline_empty_nodes(client, db_session):
    """Pipeline with no nodes fails validation."""
    p = Pipeline(name="Empty", graph_data={"nodes": []})
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.post(f"/api/v1/pipelines/{p.id}/validate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert data["errors"][0]["message"] == "Pipeline has no nodes"


@pytest.mark.asyncio
async def test_validate_pipeline_wildcard_path(client, db_session):
    """Wildcard source resolves from array output of preceding node."""
    graph = {
        "nodes": [
            {
                "id": "n1",
                "skill_name": "TextSplitter",
                "label": "Split",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/file_content"},
                ],
                "outputs": [
                    {"name": "chunks", "targetName": "chunks"},
                ],
                "config_overrides": {},
            },
            {
                "id": "n2",
                "skill_name": "TextEmbedder",
                "label": "Embed",
                "position": 1,
                "context": "/document/chunks/*",
                "inputs": [
                    {"name": "text", "source": "/document/chunks/*/text"},
                ],
                "outputs": [
                    {"name": "embedding", "targetName": "embedding"},
                ],
                "config_overrides": {},
            },
        ]
    }
    p = Pipeline(name="Wildcard Pipeline", graph_data=graph)
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.post(f"/api/v1/pipelines/{p.id}/validate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["errors"] == []


@pytest.mark.asyncio
async def test_validate_pipeline_not_found(client):
    """Validate non-existent pipeline returns 404."""
    resp = await client.post("/api/v1/pipelines/nonexistent-id/validate")
    assert resp.status_code == 404
