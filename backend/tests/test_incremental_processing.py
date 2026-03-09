"""Tests for incremental processing and ProcessedFile model."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.data_source_reader import FileInfo


@pytest.mark.asyncio
async def test_processed_file_model(setup_db, db_session):
    """ProcessedFile can be created and queried."""
    from datetime import UTC, datetime

    from app.models.processed_file import ProcessedFile

    pf = ProcessedFile(
        workflow_id="wf-1",
        data_source_id="ds-1",
        file_path="doc.pdf",
        file_etag="abc123",
        processed_at=datetime.now(UTC),
    )
    db_session.add(pf)
    await db_session.commit()
    await db_session.refresh(pf)

    assert pf.id is not None
    assert pf.file_etag == "abc123"
    assert pf.workflow_id == "wf-1"


@pytest.mark.asyncio
async def test_incremental_skips_processed_files(setup_db):
    """Second run of same workflow should skip already-processed files."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create pipeline
        pip_resp = await client.post(
            "/api/v1/pipelines",
            json={"name": "Inc Pipeline", "graph_data": {"nodes": []}},
        )
        pip_id = pip_resp.json()["id"]

        # Create workflow
        wf_resp = await client.post(
            "/api/v1/workflows",
            json={
                "name": "Inc WF",
                "data_source_ids": ["ds-inc"],
                "routes": [
                    {
                        "name": "all",
                        "priority": 1,
                        "file_filter": {"extensions": ["pdf"]},
                        "pipeline_id": pip_id,
                        "target_ids": [],
                    }
                ],
            },
        )
        wf_id = wf_resp.json()["id"]

        # Create DataSource
        from app.models.data_source import DataSource
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as db:
            ds = DataSource(
                id="ds-inc",
                name="Inc DS",
                source_type="local_upload",
                connection_config={},
                status="active",
                file_count=1,
                total_size=1024,
            )
            db.add(ds)
            await db.commit()

        mock_files = [
            FileInfo(name="doc.pdf", path="doc.pdf", size=1024, etag="v1"),
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
                return_value=b"pdf content",
            ),
            patch(
                "app.services.workflow_executor.PipelineRunner.execute",
                new_callable=AsyncMock,
                return_value={"status": "success", "total_execution_time_ms": 5},
            ),
        ):
            # First run — should process 1 file
            r1 = await client.post(f"/api/v1/workflows/{wf_id}/run")
            assert r1.status_code == 200
            d1 = r1.json()
            assert d1["total_files"] == 1
            assert d1["processed_files"] == 1

            # Second run — same etag, should skip (0 files to process)
            r2 = await client.post(f"/api/v1/workflows/{wf_id}/run")
            assert r2.status_code == 200
            d2 = r2.json()
            assert d2["total_files"] == 0
            assert d2["processed_files"] == 0

        # Third run with changed etag — should process again
        mock_files_v2 = [
            FileInfo(name="doc.pdf", path="doc.pdf", size=2048, etag="v2"),
        ]
        with (
            patch(
                "app.services.workflow_executor.list_files",
                new_callable=AsyncMock,
                return_value=mock_files_v2,
            ),
            patch(
                "app.services.workflow_executor.read_file",
                new_callable=AsyncMock,
                return_value=b"updated pdf content",
            ),
            patch(
                "app.services.workflow_executor.PipelineRunner.execute",
                new_callable=AsyncMock,
                return_value={"status": "success", "total_execution_time_ms": 5},
            ),
        ):
            r3 = await client.post(f"/api/v1/workflows/{wf_id}/run")
            assert r3.status_code == 200
            d3 = r3.json()
            assert d3["total_files"] == 1
            assert d3["processed_files"] == 1


@pytest.mark.asyncio
async def test_data_source_pipeline_id_deprecated(setup_db):
    """DataSource.pipeline_id should still work but without FK constraint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a data source with pipeline_id set to a non-existent pipeline
        # This should work now since FK is removed
        resp = await client.post(
            "/api/v1/data-sources",
            json={
                "name": "Test DS No FK",
                "source_type": "local_upload",
                "connection_config": {},
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["pipeline_id"] is None


@pytest.mark.asyncio
async def test_target_pipeline_id_deprecated(setup_db):
    """Target.pipeline_id should still work but without FK constraint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/targets",
            json={
                "name": "Test Tgt No FK",
                "target_type": "azure_ai_search",
                "connection_config": {},
                "field_mappings": {},
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["pipeline_id"] is None
