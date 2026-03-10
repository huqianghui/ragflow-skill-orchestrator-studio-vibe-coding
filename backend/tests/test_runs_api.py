"""Tests for Run CRUD API endpoints (/api/v1/runs)."""

import pytest

from app.models.pipeline import Pipeline
from app.models.run import Run

# --------------- POST /api/v1/runs ---------------


@pytest.mark.asyncio
async def test_create_run_minimal(client, db_session):
    """POST with only pipeline_id creates run with defaults."""
    p = Pipeline(name="Test Pipeline")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.post("/api/v1/runs", json={"pipeline_id": p.id})
    assert resp.status_code == 201
    data = resp.json()
    assert data["pipeline_id"] == p.id
    assert data["status"] == "pending"
    assert data["mode"] == "sync"
    assert data["total_documents"] == 0
    assert data["processed_documents"] == 0
    assert data["failed_documents"] == 0
    assert data["datasource_id"] is None
    assert data["target_id"] is None
    assert data["error_message"] is None
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_run_with_mode(client, db_session):
    """POST with mode=async sets it correctly."""
    p = Pipeline(name="Async Pipeline")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.post("/api/v1/runs", json={"pipeline_id": p.id, "mode": "async"})
    assert resp.status_code == 201
    assert resp.json()["mode"] == "async"


@pytest.mark.asyncio
async def test_create_run_invalid_mode(client, db_session):
    """POST with invalid mode returns 422."""
    p = Pipeline(name="P")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.post("/api/v1/runs", json={"pipeline_id": p.id, "mode": "invalid"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_run_missing_pipeline_id(client):
    """POST without pipeline_id returns 422."""
    resp = await client.post("/api/v1/runs", json={})
    assert resp.status_code == 422


# --------------- GET /api/v1/runs ---------------


@pytest.mark.asyncio
async def test_list_runs_empty(client):
    """GET list returns empty page when no runs exist."""
    resp = await client.get("/api/v1/runs")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_list_runs_pagination(client, db_session):
    """GET list respects page and page_size params."""
    p = Pipeline(name="P")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    for _ in range(5):
        db_session.add(Run(pipeline_id=p.id))
    await db_session.commit()

    resp = await client.get("/api/v1/runs?page=1&page_size=2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 2


@pytest.mark.asyncio
async def test_list_runs_ordered_by_created_at_desc(client, db_session):
    """Runs are returned newest first."""
    from datetime import datetime

    p = Pipeline(name="P")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    r1 = Run(pipeline_id=p.id, status="completed")
    r1.created_at = datetime(2024, 1, 1, 0, 0, 0)
    db_session.add(r1)
    r2 = Run(pipeline_id=p.id, status="failed")
    r2.created_at = datetime(2024, 1, 2, 0, 0, 0)
    db_session.add(r2)
    await db_session.commit()

    resp = await client.get("/api/v1/runs")
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["items"][0]["status"] == "failed"
    assert data["items"][1]["status"] == "completed"


# --------------- GET /api/v1/runs/{id} ---------------


@pytest.mark.asyncio
async def test_get_run_by_id(client, db_session):
    """GET by ID returns the correct run."""
    p = Pipeline(name="P")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    r = Run(pipeline_id=p.id, status="running", total_documents=10)
    db_session.add(r)
    await db_session.commit()
    await db_session.refresh(r)

    resp = await client.get(f"/api/v1/runs/{r.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == r.id
    assert data["pipeline_id"] == p.id
    assert data["status"] == "running"
    assert data["total_documents"] == 10


@pytest.mark.asyncio
async def test_get_run_not_found(client):
    """GET with non-existent ID returns 404."""
    resp = await client.get("/api/v1/runs/nonexistent-id")
    assert resp.status_code == 404
