"""End-to-end tests for the full skill development workflow."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_e2e_create_connection_create_skill_test_execute(client: AsyncClient):
    """E2E: Create Connection -> Create Python Skill (with connection) -> Test -> Verify output."""
    # 1. Create a connection (http_api type, no real external call needed)
    conn_resp = await client.post(
        "/api/v1/connections",
        json={
            "name": "test-http",
            "connection_type": "http_api",
            "description": "Test HTTP connection",
            "config": {"base_url": "https://example.com", "headers": {}},
        },
    )
    assert conn_resp.status_code == 201
    conn_id = conn_resp.json()["id"]

    # 2. Create a python_code skill that references the connection
    skill_resp = await client.post(
        "/api/v1/skills",
        json={
            "name": "E2E-Skill",
            "skill_type": "python_code",
            "source_code": (
                "def process(data, context):\n"
                "    # Just verify context is available\n"
                "    return {'processed': True, 'input_text': data.get('text', '')}\n"
            ),
            "connection_mappings": {"api": conn_id},
            "test_input": {
                "values": [{"recordId": "1", "data": {"text": "hello"}}],
            },
        },
    )
    assert skill_resp.status_code == 201
    skill_id = skill_resp.json()["id"]
    assert skill_resp.json()["connection_mappings"] == {"api": conn_id}

    # 3. Test the saved skill
    test_resp = await client.post(
        f"/api/v1/skills/{skill_id}/test",
        json={
            "test_input": {
                "values": [{"recordId": "1", "data": {"text": "hello"}}],
            },
        },
    )
    assert test_resp.status_code == 200
    result = test_resp.json()
    assert len(result["values"]) == 1
    assert result["values"][0]["data"]["processed"] is True
    assert result["values"][0]["data"]["input_text"] == "hello"
    assert result["values"][0]["errors"] == []
    assert result["execution_time_ms"] >= 0


@pytest.mark.asyncio
async def test_e2e_modify_source_code_retest(client: AsyncClient):
    """E2E: Create skill -> Test -> Modify source_code -> Re-test -> Verify updated output."""
    # 1. Create skill with initial code
    create_resp = await client.post(
        "/api/v1/skills",
        json={
            "name": "ModifySkill",
            "skill_type": "python_code",
            "source_code": "def process(data, context):\n    return {'version': 1}\n",
        },
    )
    assert create_resp.status_code == 201
    skill_id = create_resp.json()["id"]

    # 2. Test initial version
    test1 = await client.post(
        f"/api/v1/skills/{skill_id}/test",
        json={"test_input": {"values": [{"recordId": "1", "data": {}}]}},
    )
    assert test1.status_code == 200
    assert test1.json()["values"][0]["data"]["version"] == 1

    # 3. Update source code
    update_resp = await client.put(
        f"/api/v1/skills/{skill_id}",
        json={
            "source_code": "def process(data, context):\n    return {'version': 2}\n",
        },
    )
    assert update_resp.status_code == 200

    # 4. Re-test — should reflect updated code
    test2 = await client.post(
        f"/api/v1/skills/{skill_id}/test",
        json={"test_input": {"values": [{"recordId": "1", "data": {}}]}},
    )
    assert test2.status_code == 200
    assert test2.json()["values"][0]["data"]["version"] == 2


@pytest.mark.asyncio
async def test_e2e_additional_requirements_saved(client: AsyncClient):
    """E2E: Create skill with additional_requirements -> Verify saved -> Update."""
    create_resp = await client.post(
        "/api/v1/skills",
        json={
            "name": "ReqSkill",
            "skill_type": "python_code",
            "source_code": "def process(data, context):\n    return data\n",
            "additional_requirements": "beautifulsoup4==4.12.0\nlxml",
        },
    )
    assert create_resp.status_code == 201
    skill_id = create_resp.json()["id"]
    assert create_resp.json()["additional_requirements"] == "beautifulsoup4==4.12.0\nlxml"

    # Verify via GET
    get_resp = await client.get(f"/api/v1/skills/{skill_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["additional_requirements"] == "beautifulsoup4==4.12.0\nlxml"

    # Update requirements
    update_resp = await client.put(
        f"/api/v1/skills/{skill_id}",
        json={"additional_requirements": "pandas>=2.0"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["additional_requirements"] == "pandas>=2.0"


@pytest.mark.asyncio
async def test_error_invalid_code(client: AsyncClient):
    """Error scenario: syntax error in source code."""
    response = await client.post(
        "/api/v1/skills/test-code",
        json={
            "source_code": "def process(data, context):\n    return {invalid syntax!!\n",
            "test_input": {"values": [{"recordId": "1", "data": {}}]},
        },
    )
    # Should fail at compile time with validation error
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_error_missing_process_function(client: AsyncClient):
    """Error scenario: code without process function."""
    response = await client.post(
        "/api/v1/skills/test-code",
        json={
            "source_code": "def helper(x):\n    return x\n",
            "test_input": {"values": []},
        },
    )
    assert response.status_code == 422
    assert "process" in response.json()["message"]


@pytest.mark.asyncio
async def test_error_connection_not_found(client: AsyncClient):
    """Error scenario: skill references a non-existent connection."""
    create_resp = await client.post(
        "/api/v1/skills",
        json={
            "name": "BadConnSkill",
            "skill_type": "python_code",
            "source_code": "def process(data, context):\n    return data\n",
            "connection_mappings": {"llm": "nonexistent-conn-id"},
        },
    )
    assert create_resp.status_code == 201
    skill_id = create_resp.json()["id"]

    test_resp = await client.post(
        f"/api/v1/skills/{skill_id}/test",
        json={"test_input": {"values": [{"recordId": "1", "data": {}}]}},
    )
    assert test_resp.status_code == 422
    assert "not found" in test_resp.json()["message"].lower()


@pytest.mark.asyncio
async def test_error_runtime_exception_per_record(client: AsyncClient):
    """Error scenario: runtime exception is captured per-record without failing others."""
    response = await client.post(
        "/api/v1/skills/test-code",
        json={
            "source_code": (
                "def process(data, context):\n"
                "    if data.get('fail'):\n"
                "        raise RuntimeError('boom')\n"
                "    return {'ok': True}\n"
            ),
            "test_input": {
                "values": [
                    {"recordId": "1", "data": {"fail": False}},
                    {"recordId": "2", "data": {"fail": True}},
                    {"recordId": "3", "data": {"fail": False}},
                ],
            },
        },
    )
    assert response.status_code == 200
    vals = response.json()["values"]
    assert len(vals) == 3
    # Record 1 succeeds
    assert vals[0]["data"]["ok"] is True
    assert vals[0]["errors"] == []
    # Record 2 fails
    assert vals[1]["errors"][0]["message"] == "boom"
    # Record 3 succeeds
    assert vals[2]["data"]["ok"] is True
    assert vals[2]["errors"] == []
