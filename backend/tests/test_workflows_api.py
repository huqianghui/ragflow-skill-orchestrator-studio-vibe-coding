import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_workflow(client: AsyncClient):
    response = await client.post(
        "/api/v1/workflows",
        json={
            "name": "HR Training Workflow",
            "description": "Process HR training materials",
            "data_source_ids": ["ds-001"],
            "routes": [
                {
                    "name": "PDF Processing",
                    "priority": 1,
                    "file_filter": {"extensions": ["pdf", "docx"]},
                    "pipeline_id": "pip-001",
                    "target_ids": ["tgt-001"],
                }
            ],
            "default_route": {
                "name": "default",
                "pipeline_id": "pip-default",
                "target_ids": ["tgt-default"],
            },
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "HR Training Workflow"
    assert data["status"] == "draft"
    assert data["data_source_ids"] == ["ds-001"]
    assert len(data["routes"]) == 1
    assert data["routes"][0]["name"] == "PDF Processing"
    assert data["default_route"]["pipeline_id"] == "pip-default"


@pytest.mark.asyncio
async def test_create_workflow_minimal(client: AsyncClient):
    response = await client.post(
        "/api/v1/workflows",
        json={"name": "Minimal Workflow"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Minimal Workflow"
    assert data["data_source_ids"] == []
    assert data["routes"] == []
    assert data["default_route"] is None


@pytest.mark.asyncio
async def test_list_workflows(client: AsyncClient):
    await client.post("/api/v1/workflows", json={"name": "Workflow A"})
    await client.post("/api/v1/workflows", json={"name": "Workflow B"})

    response = await client.get("/api/v1/workflows")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_get_workflow(client: AsyncClient):
    create_resp = await client.post("/api/v1/workflows", json={"name": "Get Test"})
    workflow_id = create_resp.json()["id"]

    response = await client.get(f"/api/v1/workflows/{workflow_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Get Test"


@pytest.mark.asyncio
async def test_get_workflow_not_found(client: AsyncClient):
    response = await client.get("/api/v1/workflows/nonexistent-id")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_workflow(client: AsyncClient):
    create_resp = await client.post("/api/v1/workflows", json={"name": "Update Test"})
    workflow_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/v1/workflows/{workflow_id}",
        json={"name": "Updated Name", "status": "active"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"
    assert response.json()["status"] == "active"


@pytest.mark.asyncio
async def test_update_workflow_routes(client: AsyncClient):
    create_resp = await client.post("/api/v1/workflows", json={"name": "Route Update Test"})
    workflow_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/v1/workflows/{workflow_id}",
        json={
            "routes": [
                {
                    "name": "New Route",
                    "priority": 0,
                    "file_filter": {"extensions": ["mp4"]},
                    "pipeline_id": "pip-video",
                    "target_ids": ["tgt-blob"],
                }
            ]
        },
    )
    assert response.status_code == 200
    assert len(response.json()["routes"]) == 1
    assert response.json()["routes"][0]["name"] == "New Route"


@pytest.mark.asyncio
async def test_delete_workflow(client: AsyncClient):
    create_resp = await client.post("/api/v1/workflows", json={"name": "Delete Test"})
    workflow_id = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/workflows/{workflow_id}")
    assert response.status_code == 204

    response = await client.get(f"/api/v1/workflows/{workflow_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_workflow_not_found(client: AsyncClient):
    response = await client.delete("/api/v1/workflows/nonexistent-id")
    assert response.status_code == 404
