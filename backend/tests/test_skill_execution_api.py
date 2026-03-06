import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_test_code_endpoint(client: AsyncClient):
    """Test unsaved code via POST /api/v1/skills/test-code."""
    response = await client.post(
        "/api/v1/skills/test-code",
        json={
            "source_code": (
                "def process(data, context):\n    return {'greeting': 'Hello ' + data['name']}\n"
            ),
            "test_input": {"values": [{"recordId": "1", "data": {"name": "World"}}]},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["values"][0]["data"]["greeting"] == "Hello World"
    assert data["values"][0]["errors"] == []
    assert "execution_time_ms" in data


@pytest.mark.asyncio
async def test_test_code_with_error(client: AsyncClient):
    """Test code that raises an error."""
    response = await client.post(
        "/api/v1/skills/test-code",
        json={
            "source_code": "def process(data, context):\n    raise ValueError('test error')\n",
            "test_input": {"values": [{"recordId": "1", "data": {}}]},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["values"][0]["errors"][0]["message"] == "test error"


@pytest.mark.asyncio
async def test_test_code_missing_process(client: AsyncClient):
    """Test code without process function."""
    response = await client.post(
        "/api/v1/skills/test-code",
        json={
            "source_code": "def other(data):\n    pass\n",
            "test_input": {"values": []},
        },
    )
    assert response.status_code == 422
    assert "process" in response.json()["message"]


@pytest.mark.asyncio
async def test_test_saved_skill(client: AsyncClient):
    """Test a saved python_code skill via POST /api/v1/skills/{id}/test."""
    # Create a python_code skill
    create_resp = await client.post(
        "/api/v1/skills",
        json={
            "name": "TestPythonSkill",
            "skill_type": "python_code",
            "source_code": (
                "def process(data, context):\n    return {'reversed': data['text'][::-1]}\n"
            ),
        },
    )
    assert create_resp.status_code == 201
    skill_id = create_resp.json()["id"]

    # Test the skill
    response = await client.post(
        f"/api/v1/skills/{skill_id}/test",
        json={"test_input": {"values": [{"recordId": "1", "data": {"text": "hello"}}]}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["values"][0]["data"]["reversed"] == "olleh"


@pytest.mark.asyncio
async def test_test_non_python_skill_rejected(client: AsyncClient):
    """Testing a non-python_code skill should fail."""
    create_resp = await client.post(
        "/api/v1/skills",
        json={
            "name": "WebApiSkill",
            "skill_type": "web_api",
        },
    )
    skill_id = create_resp.json()["id"]

    response = await client.post(
        f"/api/v1/skills/{skill_id}/test",
        json={"test_input": {"values": []}},
    )
    assert response.status_code == 422
