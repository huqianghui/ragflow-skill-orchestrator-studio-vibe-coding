"""Tests for WorkflowRun / PipelineRun models, route matching, and API."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.data_source_reader import FileInfo
from app.services.workflow_executor import match_file_to_route

# ---------------------------------------------------------------------------
# Route matching unit tests
# ---------------------------------------------------------------------------


class TestRouteMatching:
    def test_match_by_extension(self):
        routes = [
            {
                "name": "docs",
                "priority": 1,
                "file_filter": {"extensions": ["pdf", "docx"]},
                "pipeline_id": "p1",
            },
        ]
        fi = FileInfo(name="report.pdf", path="report.pdf", size=1024)
        result = match_file_to_route(fi, routes)
        assert result is not None
        assert result["pipeline_id"] == "p1"

    def test_no_match_returns_none(self):
        routes = [
            {
                "name": "docs",
                "priority": 1,
                "file_filter": {"extensions": ["pdf"]},
                "pipeline_id": "p1",
            },
        ]
        fi = FileInfo(name="image.png", path="image.png", size=500)
        result = match_file_to_route(fi, routes)
        assert result is None

    def test_priority_ordering(self):
        routes = [
            {
                "name": "low",
                "priority": 10,
                "file_filter": {"extensions": ["pdf"]},
                "pipeline_id": "p-low",
            },
            {
                "name": "high",
                "priority": 1,
                "file_filter": {"extensions": ["pdf"]},
                "pipeline_id": "p-high",
            },
        ]
        fi = FileInfo(name="doc.pdf", path="doc.pdf", size=100)
        result = match_file_to_route(fi, routes)
        assert result["pipeline_id"] == "p-high"

    def test_match_by_size_range(self):
        routes = [
            {
                "name": "small",
                "priority": 1,
                "file_filter": {"extensions": ["txt"], "size_range": {"max_bytes": 1000}},
                "pipeline_id": "p-small",
            },
        ]
        fi = FileInfo(name="a.txt", path="a.txt", size=500)
        assert match_file_to_route(fi, routes)["pipeline_id"] == "p-small"

        big = FileInfo(name="b.txt", path="b.txt", size=2000)
        assert match_file_to_route(big, routes) is None

    def test_match_by_path_pattern(self):
        routes = [
            {
                "name": "training",
                "priority": 1,
                "file_filter": {"path_pattern": "training/*"},
                "pipeline_id": "p-train",
            },
        ]
        fi = FileInfo(name="doc.pdf", path="training/doc.pdf", size=100)
        assert match_file_to_route(fi, routes)["pipeline_id"] == "p-train"

        fi2 = FileInfo(name="doc.pdf", path="other/doc.pdf", size=100)
        assert match_file_to_route(fi2, routes) is None

    def test_empty_filter_no_match(self):
        routes = [
            {
                "name": "empty",
                "priority": 1,
                "file_filter": {},
                "pipeline_id": "p1",
            },
        ]
        fi = FileInfo(name="a.txt", path="a.txt", size=100)
        assert match_file_to_route(fi, routes) is None

    def test_extension_case_insensitive(self):
        routes = [
            {
                "name": "docs",
                "priority": 1,
                "file_filter": {"extensions": ["PDF"]},
                "pipeline_id": "p1",
            },
        ]
        fi = FileInfo(name="report.pdf", path="report.pdf", size=100)
        assert match_file_to_route(fi, routes) is not None


# ---------------------------------------------------------------------------
# API tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_workflow_runs_empty(setup_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/workflow-runs")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_workflow_run_not_found(setup_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/workflow-runs/nonexistent")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_run_workflow_not_found(setup_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/workflows/nonexistent/run")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_run_workflow_no_data_sources(setup_db):
    """Workflow with empty data_source_ids completes with 0 files."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create workflow
        wf_resp = await client.post(
            "/api/v1/workflows",
            json={"name": "Test WF", "data_source_ids": [], "routes": []},
        )
        assert wf_resp.status_code == 201
        wf_id = wf_resp.json()["id"]

        # Run it
        run_resp = await client.post(f"/api/v1/workflows/{wf_id}/run")
        assert run_resp.status_code == 200
        data = run_resp.json()
        assert data["status"] == "completed"
        assert data["total_files"] == 0
        assert data["pipeline_runs"] == []


@pytest.mark.asyncio
async def test_run_workflow_with_files(setup_db):
    """Full execution with mocked data source and pipeline runner."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create workflow with route
        wf_resp = await client.post(
            "/api/v1/workflows",
            json={
                "name": "Test WF",
                "data_source_ids": ["ds-1"],
                "routes": [
                    {
                        "name": "docs",
                        "priority": 1,
                        "file_filter": {"extensions": ["pdf"]},
                        "pipeline_id": "pip-1",
                        "target_ids": [],
                    }
                ],
            },
        )
        assert wf_resp.status_code == 201
        wf_id = wf_resp.json()["id"]

        # Create a pipeline that routes can reference
        pip_resp = await client.post(
            "/api/v1/pipelines",
            json={
                "name": "Test Pipeline",
                "graph_data": {"nodes": []},
            },
        )
        assert pip_resp.status_code == 201
        pip_id = pip_resp.json()["id"]

        # Update workflow to use the real pipeline id
        await client.put(
            f"/api/v1/workflows/{wf_id}",
            json={
                "routes": [
                    {
                        "name": "docs",
                        "priority": 1,
                        "file_filter": {"extensions": ["pdf"]},
                        "pipeline_id": pip_id,
                        "target_ids": [],
                    }
                ],
            },
        )

        # Mock data source lookup + file listing + reading
        mock_files = [
            FileInfo(name="doc.pdf", path="doc.pdf", size=1024),
        ]

        with (
            patch(
                "app.services.workflow_executor.list_files",
                new_callable=AsyncMock,
                return_value=mock_files,
            ),
            patch(
                "app.services.workflow_executor.read_file",
                new_callable=AsyncMock,
                return_value=b"fake pdf content",
            ),
            patch(
                "app.services.workflow_executor.PipelineRunner.execute",
                new_callable=AsyncMock,
                return_value={"status": "success", "total_execution_time_ms": 10},
            ),
        ):
            # We need a real DataSource record for the executor to find
            from app.models.data_source import DataSource
            from tests.conftest import TestSessionLocal

            async with TestSessionLocal() as db:
                ds = DataSource(
                    id="ds-1",
                    name="Test DS",
                    source_type="local_upload",
                    connection_config={},
                    status="active",
                    file_count=1,
                    total_size=1024,
                )
                db.add(ds)
                await db.commit()

            run_resp = await client.post(f"/api/v1/workflows/{wf_id}/run")
            assert run_resp.status_code == 200
            data = run_resp.json()
            assert data["status"] == "completed"
            assert data["total_files"] == 1
            assert data["processed_files"] == 1
            assert len(data["pipeline_runs"]) == 1
            assert data["pipeline_runs"][0]["status"] == "completed"


@pytest.mark.asyncio
async def test_list_workflow_runs_with_filter(setup_db):
    """After running a workflow, list by workflow_id filter."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        wf_resp = await client.post(
            "/api/v1/workflows",
            json={"name": "WF Filter", "data_source_ids": [], "routes": []},
        )
        wf_id = wf_resp.json()["id"]

        # Run it
        await client.post(f"/api/v1/workflows/{wf_id}/run")

        # List with filter
        resp = await client.get(f"/api/v1/workflow-runs?workflow_id={wf_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["workflow_id"] == wf_id


@pytest.mark.asyncio
async def test_get_workflow_run_detail(setup_db):
    """Get detail of a specific workflow run."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        wf_resp = await client.post(
            "/api/v1/workflows",
            json={"name": "WF Detail", "data_source_ids": [], "routes": []},
        )
        wf_id = wf_resp.json()["id"]

        run_resp = await client.post(f"/api/v1/workflows/{wf_id}/run")
        run_id = run_resp.json()["id"]

        detail_resp = await client.get(f"/api/v1/workflow-runs/{run_id}")
        assert detail_resp.status_code == 200
        data = detail_resp.json()
        assert data["id"] == run_id
        assert "pipeline_runs" in data
