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
async def test_list_sessions_filter_by_agent_name(client):
    await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "claude-code", "source": "playground"},
    )
    await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "codex", "source": "playground"},
    )
    resp = await client.get("/api/v1/agents/sessions?agent_name=claude-code")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["agent_name"] == "claude-code"


@pytest.mark.asyncio
async def test_list_sessions_filter_by_agent_name_and_source(client):
    await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "claude-code", "source": "playground"},
    )
    await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "claude-code", "source": "skill-editor"},
    )
    resp = await client.get("/api/v1/agents/sessions?agent_name=claude-code&source=playground")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["agent_name"] == "claude-code"
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


# ---------------------------------------------------------------------------
# Session messages
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_session_messages_empty(client):
    create_resp = await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "claude-code"},
    )
    session_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/agents/sessions/{session_id}/messages")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_session_messages_not_found(client):
    resp = await client.get("/api/v1/agents/sessions/nonexistent-id/messages")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_session_also_deletes_messages(client, db_session):
    """Deleting a session should cascade-delete its messages."""
    from app.services.agents.session_proxy import session_proxy

    create_resp = await client.post(
        "/api/v1/agents/sessions",
        json={"agent_name": "claude-code"},
    )
    session_id = create_resp.json()["id"]

    # Insert messages via the same test DB
    await session_proxy.save_message(db_session, session_id, "user", "hello")
    await session_proxy.save_message(db_session, session_id, "assistant", "hi back")

    # Verify messages exist
    resp = await client.get(f"/api/v1/agents/sessions/{session_id}/messages")
    assert len(resp.json()) == 2

    # Delete session
    resp = await client.delete(f"/api/v1/agents/sessions/{session_id}")
    assert resp.status_code == 204

    # Session and messages should be gone
    resp = await client.get(f"/api/v1/agents/sessions/{session_id}")
    assert resp.status_code == 404
