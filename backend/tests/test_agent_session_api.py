"""Tests for agent session REST API endpoints."""

import pytest


@pytest.mark.asyncio
async def test_create_session(client):
    resp = await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "claude-code", "source": "playground", "mode": "code"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["agent_name"] == "claude-code"
    assert data["source"] == "playground"
    assert data["mode"] == "code"
    assert data["title"] == "New Session"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_sessions_empty(client):
    resp = await client.get("/api/v1/agents/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_sessions_with_data(client):
    # Create two sessions
    await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "claude-code"},
    )
    await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "codex"},
    )
    resp = await client.get("/api/v1/agents/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_list_sessions_filter_by_source(client):
    await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "claude-code", "source": "playground"},
    )
    await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "codex", "source": "skill-editor"},
    )
    resp = await client.get("/api/v1/agents/sessions?source=playground")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["source"] == "playground"


@pytest.mark.asyncio
async def test_get_session(client):
    create_resp = await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "claude-code"},
    )
    session_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/agents/sessions/{session_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == session_id


@pytest.mark.asyncio
async def test_get_session_not_found(client):
    resp = await client.get("/api/v1/agents/sessions/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_session(client):
    create_resp = await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "claude-code"},
    )
    session_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/agents/sessions/{session_id}")
    assert resp.status_code == 204

    # Verify deletion
    resp = await client.get(f"/api/v1/agents/sessions/{session_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_session_not_found(client):
    resp = await client.delete("/api/v1/agents/sessions/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_available_agents(client):
    resp = await client.get("/api/v1/agents/available")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    names = [a["name"] for a in data]
    assert "claude-code" in names
    assert "codex" in names
    assert "copilot" in names
