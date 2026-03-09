"""Workflow execution engine — route matching + pipeline orchestration."""

from __future__ import annotations

import asyncio
import fnmatch
import logging
import mimetypes
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.data_source import DataSource
from app.models.pipeline import Pipeline
from app.models.workflow import Workflow
from app.models.workflow_run import PipelineRun, WorkflowRun
from app.services.data_source_reader import FileInfo, list_files, read_file
from app.services.pipeline.runner import PipelineRunner

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Route matching
# ---------------------------------------------------------------------------


def match_file_to_route(
    file_info: FileInfo,
    routes: list[dict],
) -> dict | None:
    """Match a file against routes sorted by priority. Returns the first match or None."""
    sorted_routes = sorted(routes, key=lambda r: r.get("priority", 0))

    for route in sorted_routes:
        ff = route.get("file_filter", {})
        if _matches_filter(file_info, ff):
            return route

    return None


def _matches_filter(file_info: FileInfo, ff: dict) -> bool:
    """Check if a file matches a single file_filter definition."""
    extensions = ff.get("extensions")
    mime_types = ff.get("mime_types")
    size_range = ff.get("size_range")
    path_pattern = ff.get("path_pattern")

    # At least one filter must be defined
    has_any_filter = extensions or mime_types or size_range or path_pattern
    if not has_any_filter:
        return False

    # Extension check
    if extensions:
        ext = file_info.name.rsplit(".", 1)[-1].lower() if "." in file_info.name else ""
        if ext not in [e.lower().lstrip(".") for e in extensions]:
            return False

    # MIME type check
    if mime_types:
        file_mime = file_info.mime_type or mimetypes.guess_type(file_info.name)[0] or ""
        if file_mime not in mime_types:
            return False

    # Size range check
    if size_range:
        min_bytes = size_range.get("min_bytes", 0)
        max_bytes = size_range.get("max_bytes")
        if file_info.size < min_bytes:
            return False
        if max_bytes is not None and file_info.size > max_bytes:
            return False

    # Path pattern check (glob-style)
    if path_pattern:
        if not fnmatch.fnmatch(file_info.path, path_pattern):
            return False

    return True


# ---------------------------------------------------------------------------
# Workflow executor
# ---------------------------------------------------------------------------


async def execute_workflow(workflow_id: str, db: AsyncSession) -> WorkflowRun:
    """Execute a workflow synchronously. Returns the completed WorkflowRun."""
    settings = get_settings()
    timeout = settings.sync_execution_timeout_s

    # Load workflow
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        from app.utils.exceptions import NotFoundException

        raise NotFoundException("Workflow", workflow_id)

    # Create WorkflowRun
    wf_run = WorkflowRun(
        workflow_id=workflow_id,
        status="running",
        started_at=datetime.now(UTC),
    )
    db.add(wf_run)
    await db.commit()
    await db.refresh(wf_run)

    try:
        result = await asyncio.wait_for(
            _execute_workflow_inner(workflow, wf_run, db),
            timeout=timeout,
        )
        return result
    except TimeoutError:
        wf_run.status = "failed"
        wf_run.error_message = f"Execution timed out after {timeout}s"
        wf_run.finished_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(wf_run)
        return wf_run
    except Exception as exc:
        wf_run.status = "failed"
        wf_run.error_message = str(exc)
        wf_run.finished_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(wf_run)
        return wf_run


async def _execute_workflow_inner(
    workflow: Workflow,
    wf_run: WorkflowRun,
    db: AsyncSession,
) -> WorkflowRun:
    """Inner execution logic — collect files, route, execute pipelines."""
    routes = workflow.routes or []
    default_route = workflow.default_route
    data_source_ids = workflow.data_source_ids or []

    # Step 1: Collect files from all data sources
    all_files: list[tuple[FileInfo, DataSource]] = []
    for ds_id in data_source_ids:
        ds_result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
        ds = ds_result.scalar_one_or_none()
        if not ds:
            logger.warning("DataSource %s not found, skipping", ds_id)
            continue
        try:
            files = await list_files(ds.source_type, ds.connection_config, ds.id)
            for f in files:
                all_files.append((f, ds))
        except Exception as exc:
            logger.error("Failed to list files from DataSource %s: %s", ds_id, exc)

    wf_run.total_files = len(all_files)
    await db.commit()

    # Step 2: Route files to pipelines
    # Key: (pipeline_id, route_name, target_ids_tuple) -> list of (file_info, ds)
    pipeline_groups: dict[tuple, list[tuple[FileInfo, DataSource]]] = {}

    for file_info, ds in all_files:
        matched_route = match_file_to_route(file_info, routes)
        if matched_route:
            key = (
                matched_route["pipeline_id"],
                matched_route.get("name", ""),
                tuple(matched_route.get("target_ids", [])),
            )
            pipeline_groups.setdefault(key, []).append((file_info, ds))
        elif default_route:
            key = (
                default_route["pipeline_id"],
                default_route.get("name", "default"),
                tuple(default_route.get("target_ids", [])),
            )
            pipeline_groups.setdefault(key, []).append((file_info, ds))
        else:
            logger.warning("File %s did not match any route and no default_route", file_info.path)
            wf_run.failed_files += 1

    # Step 3: Create PipelineRun records and execute
    total_processed = 0
    total_failed = wf_run.failed_files  # Start with unrouted files

    for (pipeline_id, route_name, target_ids_tuple), file_group in pipeline_groups.items():
        pr = PipelineRun(
            workflow_run_id=wf_run.id,
            pipeline_id=pipeline_id,
            route_name=route_name,
            target_ids=list(target_ids_tuple),
            status="running",
            total_files=len(file_group),
            started_at=datetime.now(UTC),
        )
        db.add(pr)
        await db.commit()
        await db.refresh(pr)

        # Load pipeline
        pipe_result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
        pipeline = pipe_result.scalar_one_or_none()
        if not pipeline:
            pr.status = "failed"
            pr.error_message = f"Pipeline {pipeline_id} not found"
            pr.failed_files = pr.total_files
            pr.finished_at = datetime.now(UTC)
            total_failed += pr.total_files
            await db.commit()
            continue

        # Execute each file through the pipeline
        runner = PipelineRunner()
        pr_processed = 0
        pr_failed = 0

        for file_info, ds in file_group:
            try:
                file_content = await read_file(
                    ds.source_type, ds.connection_config, ds.id, file_info.path
                )
                pipeline_dict = {"graph_data": pipeline.graph_data}
                result = await runner.execute(pipeline_dict, file_content, file_info.name, db)

                if result["status"] in ("success", "partial"):
                    pr_processed += 1
                else:
                    pr_failed += 1
            except Exception as exc:
                logger.error("Failed to process file %s: %s", file_info.path, exc)
                pr_failed += 1

        pr.processed_files = pr_processed
        pr.failed_files = pr_failed
        pr.status = (
            "completed" if pr_failed == 0 else ("failed" if pr_processed == 0 else "completed")
        )
        pr.finished_at = datetime.now(UTC)
        await db.commit()

        total_processed += pr_processed
        total_failed += pr_failed

    # Step 4: Finalize WorkflowRun
    wf_run.processed_files = total_processed
    wf_run.failed_files = total_failed
    wf_run.status = (
        "completed" if total_failed == 0 else ("failed" if total_processed == 0 else "completed")
    )
    wf_run.finished_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(wf_run)
    return wf_run
