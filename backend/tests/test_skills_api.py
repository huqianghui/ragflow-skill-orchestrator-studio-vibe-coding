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


@pytest.mark.asyncio
async def test_create_python_skill_with_all_fields(client: AsyncClient):
    """Create a python_code skill with all new fields."""
    response = await client.post(
        "/api/v1/skills",
        json={
            "name": "FullPythonSkill",
            "skill_type": "python_code",
            "description": "A complete python skill",
            "source_code": "def process(data, context):\n    return data\n",
            "additional_requirements": "pandas>=2.0\nnumpy",
            "test_input": {"values": [{"recordId": "1", "data": {"text": "hi"}}]},
            "connection_mappings": {"llm": "some-conn-id"},
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "FullPythonSkill"
    assert data["skill_type"] == "python_code"
    assert data["source_code"] == "def process(data, context):\n    return data\n"
    assert data["additional_requirements"] == "pandas>=2.0\nnumpy"
    assert data["test_input"] == {"values": [{"recordId": "1", "data": {"text": "hi"}}]}
    assert data["connection_mappings"] == {"llm": "some-conn-id"}


@pytest.mark.asyncio
async def test_update_python_skill_fields(client: AsyncClient):
    """Update source_code and additional_requirements on an existing skill."""
    create_resp = await client.post(
        "/api/v1/skills",
        json={
            "name": "UpdateFieldsSkill",
            "skill_type": "python_code",
            "source_code": "def process(data, context):\n    return data\n",
        },
    )
    assert create_resp.status_code == 201
    skill_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/v1/skills/{skill_id}",
        json={
            "source_code": "def process(data, context):\n    return {'v': 2}\n",
            "additional_requirements": "requests>=2.31",
        },
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["source_code"] == "def process(data, context):\n    return {'v': 2}\n"
    assert update_resp.json()["additional_requirements"] == "requests>=2.31"

    # Verify via GET
    get_resp = await client.get(f"/api/v1/skills/{skill_id}")
    assert get_resp.json()["source_code"] == "def process(data, context):\n    return {'v': 2}\n"


@pytest.mark.asyncio
async def test_list_skills_returns_python_code_fields(client: AsyncClient):
    """Listing skills should include new python_code fields."""
    await client.post(
        "/api/v1/skills",
        json={
            "name": "ListTestSkill",
            "skill_type": "python_code",
            "source_code": "def process(data, context):\n    pass\n",
        },
    )
    response = await client.get("/api/v1/skills")
    assert response.status_code == 200
    items = response.json()["items"]
    skill = next(s for s in items if s["name"] == "ListTestSkill")
    assert "source_code" in skill
    assert skill["source_code"] == "def process(data, context):\n    pass\n"


@pytest.mark.asyncio
async def test_get_preloaded_imports(client: AsyncClient):
    """GET /skills/preloaded-imports returns standard_library and third_party lists."""
    response = await client.get("/api/v1/skills/preloaded-imports")
    assert response.status_code == 200
    data = response.json()
    assert "standard_library" in data
    assert "third_party" in data
    assert any("import re" in item for item in data["standard_library"])
    assert any("openai" in item.lower() for item in data["third_party"])


@pytest.mark.asyncio
async def test_create_duplicate_name_returns_409(client: AsyncClient):
    """Creating a skill with a duplicate name returns 409 CONFLICT."""
    payload = {"name": "DuplicateSkill", "skill_type": "web_api"}
    response1 = await client.post("/api/v1/skills", json=payload)
    assert response1.status_code == 201

    response2 = await client.post("/api/v1/skills", json=payload)
    assert response2.status_code == 409
    assert "already exists" in response2.json()["message"]


@pytest.mark.asyncio
async def test_update_skill_does_not_accept_name(client: AsyncClient):
    """PUT /skills/{id} ignores name field (not in SkillUpdate schema)."""
    create_resp = await client.post(
        "/api/v1/skills",
        json={"name": "OriginalName", "skill_type": "web_api"},
    )
    assert create_resp.status_code == 201
    skill_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/v1/skills/{skill_id}",
        json={"name": "NewName", "description": "updated desc"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "OriginalName"
    assert update_resp.json()["description"] == "updated desc"
