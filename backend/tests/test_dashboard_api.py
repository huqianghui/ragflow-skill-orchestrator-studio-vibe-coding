"""Tests for GET /api/v1/dashboard/stats endpoint."""

import pytest

from app.models import (
    AgentConfig,
    Connection,
    DataSource,
    Pipeline,
    Run,
    Skill,
    Target,
    Workflow,
    WorkflowRun,
)


@pytest.mark.asyncio
async def test_stats_empty_database(client):
    """Empty DB should return all zeros and empty recent runs."""
    resp = await client.get("/api/v1/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()

    assert data["counts"]["skills"] == 0
    assert data["counts"]["connections"] == 0
    assert data["counts"]["pipelines"] == 0
    assert data["counts"]["data_sources"] == 0
    assert data["counts"]["targets"] == 0
    assert data["counts"]["workflows"] == 0
    assert data["counts"]["workflow_runs"] == 0
    assert data["counts"]["runs"] == 0
    assert data["counts"]["agents"] == 0

    assert data["skill_breakdown"]["builtin"] == 0
    assert data["skill_breakdown"]["custom"] == 0
    assert data["agent_breakdown"]["available"] == 0
    assert data["agent_breakdown"]["unavailable"] == 0

    assert data["workflow_run_stats"]["success_rate"] == 0.0
    assert data["workflow_run_stats"]["completed"] == 0
    assert data["workflow_run_stats"]["failed"] == 0
    assert data["workflow_run_stats"]["running"] == 0
    assert data["workflow_run_stats"]["pending"] == 0

    assert data["recent_workflow_runs"] == []


@pytest.mark.asyncio
async def test_stats_response_structure(client):
    """Response must have all top-level keys."""
    resp = await client.get("/api/v1/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "counts" in data
    assert "skill_breakdown" in data
    assert "agent_breakdown" in data
    assert "workflow_run_stats" in data
    assert "recent_workflow_runs" in data


@pytest.mark.asyncio
async def test_stats_counts_with_data(client, db_session):
    """Counts reflect actual database rows."""
    db_session.add(Skill(name="s1", skill_type="python_code", is_builtin=False))
    db_session.add(Skill(name="s2", skill_type="builtin", is_builtin=True))
    db_session.add(Connection(name="c1", connection_type="azure_openai"))
    db_session.add(Pipeline(name="p1"))
    db_session.add(DataSource(name="ds1", source_type="local_upload"))
    db_session.add(Target(name="t1", target_type="azure_ai_search"))
    db_session.add(Workflow(name="w1"))
    db_session.add(Run(pipeline_id="fake-pip-id", status="completed"))
    await db_session.commit()

    resp = await client.get("/api/v1/dashboard/stats")
    data = resp.json()

    assert data["counts"]["skills"] == 2
    assert data["counts"]["connections"] == 1
    assert data["counts"]["pipelines"] == 1
    assert data["counts"]["data_sources"] == 1
    assert data["counts"]["targets"] == 1
    assert data["counts"]["workflows"] == 1
    assert data["counts"]["runs"] == 1


@pytest.mark.asyncio
async def test_skill_breakdown(client, db_session):
    """Skill breakdown correctly splits builtin vs custom."""
    db_session.add(Skill(name="builtin1", skill_type="builtin", is_builtin=True))
    db_session.add(Skill(name="builtin2", skill_type="builtin", is_builtin=True))
    db_session.add(Skill(name="custom1", skill_type="python_code", is_builtin=False))
    await db_session.commit()

    resp = await client.get("/api/v1/dashboard/stats")
    data = resp.json()
    assert data["skill_breakdown"]["builtin"] == 2
    assert data["skill_breakdown"]["custom"] == 1


@pytest.mark.asyncio
async def test_agent_breakdown(client, db_session):
    """Agent breakdown correctly splits available vs unavailable."""
    db_session.add(
        AgentConfig(
            name="agent1",
            display_name="A1",
            icon="a",
            available=True,
        )
    )
    db_session.add(
        AgentConfig(
            name="agent2",
            display_name="A2",
            icon="b",
            available=False,
        )
    )
    db_session.add(
        AgentConfig(
            name="agent3",
            display_name="A3",
            icon="c",
            available=True,
        )
    )
    await db_session.commit()

    resp = await client.get("/api/v1/dashboard/stats")
    data = resp.json()
    assert data["counts"]["agents"] == 3
    assert data["agent_breakdown"]["available"] == 2
    assert data["agent_breakdown"]["unavailable"] == 1


@pytest.mark.asyncio
async def test_workflow_run_stats_success_rate(client, db_session):
    """Success rate = completed / (completed + failed) * 100."""
    db_session.add(Workflow(name="wf1", id="wf-1"))
    await db_session.flush()

    for s in ["completed", "completed", "completed", "failed"]:
        db_session.add(WorkflowRun(workflow_id="wf-1", status=s))
    db_session.add(WorkflowRun(workflow_id="wf-1", status="running"))
    db_session.add(WorkflowRun(workflow_id="wf-1", status="pending"))
    await db_session.commit()

    resp = await client.get("/api/v1/dashboard/stats")
    data = resp.json()

    assert data["workflow_run_stats"]["completed"] == 3
    assert data["workflow_run_stats"]["failed"] == 1
    assert data["workflow_run_stats"]["running"] == 1
    assert data["workflow_run_stats"]["pending"] == 1
    assert data["workflow_run_stats"]["success_rate"] == 75.0


@pytest.mark.asyncio
async def test_recent_workflow_runs_limit_and_order(client, db_session):
    """Recent runs returns max 5, ordered by newest first."""
    db_session.add(Workflow(name="wf1", id="wf-1"))
    await db_session.flush()

    for i in range(8):
        db_session.add(
            WorkflowRun(
                workflow_id="wf-1",
                status="completed",
                total_files=i + 1,
                processed_files=i + 1,
            )
        )
    await db_session.commit()

    resp = await client.get("/api/v1/dashboard/stats")
    data = resp.json()

    recent = data["recent_workflow_runs"]
    assert len(recent) == 5
    # Each entry has required fields
    for entry in recent:
        assert "id" in entry
        assert "workflow_id" in entry
        assert "status" in entry
        assert "total_files" in entry
        assert "processed_files" in entry
        assert "failed_files" in entry
