"""Tests for built-in skill configuration and default connection APIs."""

import pytest
from httpx import AsyncClient

from app.services.skill_seeder import seed_builtin_skills
from tests.conftest import TestSessionLocal


async def _seed_and_get_builtin(client: AsyncClient, skill_name: str) -> dict:
    """Seed builtin skills and return the named skill."""
    async with TestSessionLocal() as db:
        await seed_builtin_skills(db)
    resp = await client.get("/api/v1/skills", params={"page_size": 50})
    items = resp.json()["items"]
    return next(s for s in items if s["name"] == skill_name)


@pytest.mark.asyncio
async def test_configure_builtin_skill_config_values(client: AsyncClient):
    """PUT /skills/{id}/configure updates config_values."""
    skill = await _seed_and_get_builtin(client, "TextSplitter")

    resp = await client.put(
        f"/api/v1/skills/{skill['id']}/configure",
        json={"config_values": {"chunk_size": 500, "split_method": "sentence"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["config_values"]["chunk_size"] == 500
    assert data["config_values"]["split_method"] == "sentence"


@pytest.mark.asyncio
async def test_configure_builtin_skill_bind_connection(client: AsyncClient):
    """PUT /skills/{id}/configure can bind a connection."""
    skill = await _seed_and_get_builtin(client, "EntityRecognizer")

    # Create a compatible connection
    conn_resp = await client.post(
        "/api/v1/connections",
        json={
            "name": "ai-foundry-conn",
            "connection_type": "azure_ai_foundry",
            "config": {"endpoint": "https://test.cognitiveservices.azure.com", "api_key": "key"},
        },
    )
    assert conn_resp.status_code == 201
    conn_id = conn_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/skills/{skill['id']}/configure",
        json={"bound_connection_id": conn_id},
    )
    assert resp.status_code == 200
    assert resp.json()["bound_connection_id"] == conn_id


@pytest.mark.asyncio
async def test_configure_builtin_incompatible_connection(client: AsyncClient):
    """Binding an incompatible connection type returns 422."""
    skill = await _seed_and_get_builtin(client, "TextEmbedder")

    # Create an incompatible connection
    conn_resp = await client.post(
        "/api/v1/connections",
        json={
            "name": "wrong-type-conn",
            "connection_type": "azure_ai_foundry",
            "config": {"endpoint": "https://test.com", "api_key": "key"},
        },
    )
    conn_id = conn_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/skills/{skill['id']}/configure",
        json={"bound_connection_id": conn_id},
    )
    assert resp.status_code == 422
    assert "not compatible" in resp.json()["message"]


@pytest.mark.asyncio
async def test_configure_nonbuiltin_skill_returns_403(client: AsyncClient):
    """Configuring a non-builtin skill via configure endpoint returns 403."""
    create_resp = await client.post(
        "/api/v1/skills",
        json={
            "name": "CustomSkill",
            "skill_type": "python_code",
            "source_code": "def process(data, context):\n    pass\n",
        },
    )
    skill_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/skills/{skill_id}/configure",
        json={"config_values": {"key": "val"}},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_configure_nonexistent_connection_returns_422(client: AsyncClient):
    """Binding a nonexistent connection returns 422."""
    skill = await _seed_and_get_builtin(client, "TextSplitter")

    resp = await client.put(
        f"/api/v1/skills/{skill['id']}/configure",
        json={"bound_connection_id": "nonexistent-id"},
    )
    assert resp.status_code == 422
    assert "not found" in resp.json()["message"]


@pytest.mark.asyncio
async def test_builtin_skill_has_required_resource_types(client: AsyncClient):
    """Built-in skills should expose required_resource_types in response."""
    skill = await _seed_and_get_builtin(client, "EntityRecognizer")
    assert skill["required_resource_types"] == ["azure_ai_foundry"]


@pytest.mark.asyncio
async def test_utility_skill_no_resource_types(client: AsyncClient):
    """Utility skills like TextSplitter have null required_resource_types."""
    skill = await _seed_and_get_builtin(client, "TextSplitter")
    assert skill["required_resource_types"] is None


# --- Default Connection Tests ---


@pytest.mark.asyncio
async def test_set_default_connection(client: AsyncClient):
    """PUT /connections/{id}/set-default sets is_default=True."""
    resp = await client.post(
        "/api/v1/connections",
        json={
            "name": "default-conn",
            "connection_type": "azure_openai",
            "config": {"endpoint": "https://test.openai.azure.com", "api_key": "key"},
        },
    )
    conn_id = resp.json()["id"]

    set_resp = await client.put(f"/api/v1/connections/{conn_id}/set-default")
    assert set_resp.status_code == 200
    assert set_resp.json()["is_default"] is True


@pytest.mark.asyncio
async def test_set_default_clears_other_defaults(client: AsyncClient):
    """Setting one connection as default clears other defaults of the same type."""
    resp1 = await client.post(
        "/api/v1/connections",
        json={
            "name": "conn-a",
            "connection_type": "azure_openai",
            "config": {"endpoint": "https://a.openai.azure.com", "api_key": "key-a"},
        },
    )
    conn_a_id = resp1.json()["id"]

    resp2 = await client.post(
        "/api/v1/connections",
        json={
            "name": "conn-b",
            "connection_type": "azure_openai",
            "config": {"endpoint": "https://b.openai.azure.com", "api_key": "key-b"},
        },
    )
    conn_b_id = resp2.json()["id"]

    # Set A as default
    await client.put(f"/api/v1/connections/{conn_a_id}/set-default")

    # Set B as default — A should lose default
    await client.put(f"/api/v1/connections/{conn_b_id}/set-default")

    # Check A is no longer default
    get_a = await client.get(f"/api/v1/connections/{conn_a_id}")
    assert get_a.json()["is_default"] is False

    get_b = await client.get(f"/api/v1/connections/{conn_b_id}")
    assert get_b.json()["is_default"] is True


@pytest.mark.asyncio
async def test_get_defaults(client: AsyncClient):
    """GET /connections/defaults returns default connections per type."""
    # Create two connections of different types
    resp1 = await client.post(
        "/api/v1/connections",
        json={
            "name": "openai-default",
            "connection_type": "azure_openai",
            "config": {"endpoint": "https://test.openai.azure.com", "api_key": "key"},
        },
    )
    conn1_id = resp1.json()["id"]
    await client.put(f"/api/v1/connections/{conn1_id}/set-default")

    resp2 = await client.post(
        "/api/v1/connections",
        json={
            "name": "foundry-default",
            "connection_type": "azure_ai_foundry",
            "config": {"endpoint": "https://test.cognitiveservices.azure.com", "api_key": "key"},
        },
    )
    conn2_id = resp2.json()["id"]
    await client.put(f"/api/v1/connections/{conn2_id}/set-default")

    defaults_resp = await client.get("/api/v1/connections/defaults")
    assert defaults_resp.status_code == 200
    defaults = defaults_resp.json()
    assert "azure_openai" in defaults
    assert "azure_ai_foundry" in defaults


@pytest.mark.asyncio
async def test_genai_prompt_skill_seeded(client: AsyncClient):
    """GenAIPrompt skill is seeded as a builtin with correct resource types."""
    skill = await _seed_and_get_builtin(client, "GenAIPrompt")
    assert skill["skill_type"] == "builtin"
    assert skill["is_builtin"] is True
    assert skill["required_resource_types"] == ["azure_openai"]
    assert "system_prompt" in skill["config_schema"]["properties"]
