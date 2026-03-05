import pytest
from httpx import AsyncClient

from app.services.skill_seeder import seed_builtin_skills
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_delete_builtin_skill_returns_204(client: AsyncClient):
    # Seed built-in skills first
    async with TestSessionLocal() as db:
        await seed_builtin_skills(db)

    # List skills to get an id
    response = await client.get("/api/v1/skills", params={"page_size": 50})
    assert response.status_code == 200
    items = response.json()["items"]
    builtin = next(s for s in items if s["is_builtin"])

    # Delete should succeed
    response = await client.delete(f"/api/v1/skills/{builtin['id']}")
    assert response.status_code == 204

    # Verify skill is gone
    response = await client.get(f"/api/v1/skills/{builtin['id']}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_builtin_skill_returns_403(client: AsyncClient):
    async with TestSessionLocal() as db:
        await seed_builtin_skills(db)

    response = await client.get("/api/v1/skills", params={"page_size": 50})
    items = response.json()["items"]
    builtin = next(s for s in items if s["is_builtin"])

    response = await client.put(
        f"/api/v1/skills/{builtin['id']}",
        json={"name": "Hacked Name"},
    )
    assert response.status_code == 403
    assert "cannot be modified" in response.json()["message"]


@pytest.mark.asyncio
async def test_delete_custom_skill_returns_204(client: AsyncClient):
    # Create a custom skill
    response = await client.post(
        "/api/v1/skills",
        json={
            "name": "CustomSkill",
            "skill_type": "web_api",
            "description": "A custom skill",
            "config_schema": {},
        },
    )
    assert response.status_code == 201
    skill_id = response.json()["id"]

    # Delete should succeed
    response = await client.delete(f"/api/v1/skills/{skill_id}")
    assert response.status_code == 204
