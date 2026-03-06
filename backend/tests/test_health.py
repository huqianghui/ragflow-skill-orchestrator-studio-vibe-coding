import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_api_docs_available(client: AsyncClient):
    response = await client.get("/docs")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_skills_crud(client: AsyncClient):
    # Create
    response = await client.post(
        "/api/v1/skills",
        json={
            "name": "Test Skill",
            "skill_type": "builtin",
            "description": "A test skill",
            "config_schema": {"param1": "string"},
        },
    )
    assert response.status_code == 201
    skill = response.json()
    assert skill["name"] == "Test Skill"
    skill_id = skill["id"]

    # Read
    response = await client.get(f"/api/v1/skills/{skill_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Test Skill"

    # List
    response = await client.get("/api/v1/skills")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1

    # Update (name is read-only, update description instead)
    response = await client.put(
        f"/api/v1/skills/{skill_id}",
        json={"description": "Updated description"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Test Skill"
    assert response.json()["description"] == "Updated description"

    # Delete
    response = await client.delete(f"/api/v1/skills/{skill_id}")
    assert response.status_code == 204

    # Verify deleted
    response = await client.get(f"/api/v1/skills/{skill_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_pipelines_crud(client: AsyncClient):
    response = await client.post(
        "/api/v1/pipelines",
        json={"name": "Test Pipeline", "description": "Test"},
    )
    assert response.status_code == 201
    pipeline = response.json()
    assert pipeline["status"] == "draft"
    assert pipeline["graph_data"] == {"nodes": [], "edges": []}

    response = await client.get("/api/v1/pipelines")
    assert response.status_code == 200
    assert response.json()["total"] == 1


@pytest.mark.asyncio
async def test_not_found(client: AsyncClient):
    response = await client.get("/api/v1/skills/nonexistent-id")
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "NOT_FOUND"
