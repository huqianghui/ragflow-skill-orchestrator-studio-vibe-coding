"""Tests for GET /api/v1/pipeline-runs unified endpoint."""

import pytest

from app.models import Pipeline, PipelineRun, Run, Workflow, WorkflowRun


@pytest.mark.asyncio
async def test_empty_database(client):
    """Empty DB returns empty items list."""
    resp = await client.get("/api/v1/pipeline-runs")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_standalone_runs(client, db_session):
    """Standalone runs from `runs` table appear with source=standalone."""
    db_session.add(Pipeline(id="pip-1", name="Doc Pipeline"))
    await db_session.flush()
    db_session.add(Run(pipeline_id="pip-1", status="completed", total_documents=5))
    await db_session.commit()

    resp = await client.get("/api/v1/pipeline-runs")
    data = resp.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["source"] == "standalone"
    assert item["pipeline_name"] == "Doc Pipeline"
    assert item["total_files"] == 5


@pytest.mark.asyncio
async def test_workflow_pipeline_runs(client, db_session):
    """Pipeline runs from `pipeline_runs` table appear with source=workflow."""
    db_session.add(Pipeline(id="pip-2", name="Video Pipeline"))
    db_session.add(Workflow(id="wf-1", name="WF1"))
    await db_session.flush()
    db_session.add(WorkflowRun(id="wr-1", workflow_id="wf-1", status="completed"))
    await db_session.flush()
    db_session.add(
        PipelineRun(
            workflow_run_id="wr-1",
            pipeline_id="pip-2",
            status="completed",
            total_files=10,
            processed_files=8,
            failed_files=2,
        )
    )
    await db_session.commit()

    resp = await client.get("/api/v1/pipeline-runs")
    data = resp.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["source"] == "workflow"
    assert item["pipeline_name"] == "Video Pipeline"
    assert item["workflow_run_id"] == "wr-1"
    assert item["total_files"] == 10


@pytest.mark.asyncio
async def test_mixed_results(client, db_session):
    """Both sources appear in combined results."""
    db_session.add(Pipeline(id="pip-1", name="P1"))
    db_session.add(Workflow(id="wf-1", name="W1"))
    await db_session.flush()
    db_session.add(Run(pipeline_id="pip-1", status="completed"))
    db_session.add(WorkflowRun(id="wr-1", workflow_id="wf-1", status="completed"))
    await db_session.flush()
    db_session.add(PipelineRun(workflow_run_id="wr-1", pipeline_id="pip-1", status="failed"))
    await db_session.commit()

    resp = await client.get("/api/v1/pipeline-runs")
    data = resp.json()
    assert data["total"] == 2
    sources = {item["source"] for item in data["items"]}
    assert sources == {"standalone", "workflow"}


@pytest.mark.asyncio
async def test_source_filter_standalone(client, db_session):
    """source=standalone only returns runs table data."""
    db_session.add(Pipeline(id="pip-1", name="P1"))
    db_session.add(Workflow(id="wf-1", name="W1"))
    await db_session.flush()
    db_session.add(Run(pipeline_id="pip-1", status="completed"))
    db_session.add(WorkflowRun(id="wr-1", workflow_id="wf-1", status="completed"))
    await db_session.flush()
    db_session.add(PipelineRun(workflow_run_id="wr-1", pipeline_id="pip-1", status="failed"))
    await db_session.commit()

    resp = await client.get("/api/v1/pipeline-runs?source=standalone")
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["source"] == "standalone"


@pytest.mark.asyncio
async def test_source_filter_workflow(client, db_session):
    """source=workflow only returns pipeline_runs table data."""
    db_session.add(Pipeline(id="pip-1", name="P1"))
    db_session.add(Workflow(id="wf-1", name="W1"))
    await db_session.flush()
    db_session.add(Run(pipeline_id="pip-1", status="completed"))
    db_session.add(WorkflowRun(id="wr-1", workflow_id="wf-1", status="completed"))
    await db_session.flush()
    db_session.add(PipelineRun(workflow_run_id="wr-1", pipeline_id="pip-1", status="failed"))
    await db_session.commit()

    resp = await client.get("/api/v1/pipeline-runs?source=workflow")
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["source"] == "workflow"


@pytest.mark.asyncio
async def test_pagination(client, db_session):
    """Pagination returns correct page_size items."""
    db_session.add(Pipeline(id="pip-1", name="P1"))
    await db_session.flush()
    for _ in range(5):
        db_session.add(Run(pipeline_id="pip-1", status="completed"))
    await db_session.commit()

    resp = await client.get("/api/v1/pipeline-runs?page=1&page_size=2")
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert data["total_pages"] == 3


@pytest.mark.asyncio
async def test_response_structure(client):
    """Response has correct paginated structure."""
    resp = await client.get("/api/v1/pipeline-runs")
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data
