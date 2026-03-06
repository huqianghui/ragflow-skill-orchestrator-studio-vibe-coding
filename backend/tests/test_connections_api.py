import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_connection(client: AsyncClient):
    response = await client.post(
        "/api/v1/connections",
        json={
            "name": "test-openai",
            "connection_type": "openai",
            "description": "Test OpenAI connection",
            "config": {"api_key": "sk-test-1234567890abcdef"},
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test-openai"
    assert data["connection_type"] == "openai"
    # Secret should be masked
    assert "****" in data["config"]["api_key"]
    assert "sk-test-1234567890abcdef" not in data["config"]["api_key"]


@pytest.mark.asyncio
async def test_list_connections(client: AsyncClient):
    # Create two connections
    await client.post(
        "/api/v1/connections",
        json={
            "name": "conn-1",
            "connection_type": "openai",
            "config": {"api_key": "sk-key1"},
        },
    )
    await client.post(
        "/api/v1/connections",
        json={
            "name": "conn-2",
            "connection_type": "azure_openai",
            "config": {"endpoint": "https://test.openai.azure.com", "api_key": "key2"},
        },
    )

    response = await client.get("/api/v1/connections")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_get_connection(client: AsyncClient):
    create_resp = await client.post(
        "/api/v1/connections",
        json={
            "name": "get-test",
            "connection_type": "openai",
            "config": {"api_key": "sk-secret"},
        },
    )
    conn_id = create_resp.json()["id"]

    response = await client.get(f"/api/v1/connections/{conn_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "get-test"
    assert "****" in response.json()["config"]["api_key"]


@pytest.mark.asyncio
async def test_get_connection_not_found(client: AsyncClient):
    response = await client.get("/api/v1/connections/nonexistent-id")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_connection(client: AsyncClient):
    create_resp = await client.post(
        "/api/v1/connections",
        json={
            "name": "update-test",
            "connection_type": "openai",
            "config": {"api_key": "sk-original"},
        },
    )
    conn_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/v1/connections/{conn_id}",
        json={"name": "updated-name"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "updated-name"


@pytest.mark.asyncio
async def test_delete_connection(client: AsyncClient):
    create_resp = await client.post(
        "/api/v1/connections",
        json={
            "name": "delete-test",
            "connection_type": "openai",
            "config": {"api_key": "sk-delete"},
        },
    )
    conn_id = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/connections/{conn_id}")
    assert response.status_code == 204

    response = await client.get(f"/api/v1/connections/{conn_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_connection_not_found(client: AsyncClient):
    response = await client.delete("/api/v1/connections/nonexistent-id")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_test_connection_not_found(client: AsyncClient):
    response = await client.post("/api/v1/connections/nonexistent-id/test")
    assert response.status_code == 404
