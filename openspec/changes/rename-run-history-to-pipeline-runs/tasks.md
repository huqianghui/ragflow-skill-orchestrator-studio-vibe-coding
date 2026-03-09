## 1. Backend — Unified Pipeline Runs API

- [x] 1.1 Create `backend/app/schemas/pipeline_runs.py` with `UnifiedPipelineRun` response schema (id, pipeline_id, pipeline_name, status, source, total_files, processed_files, failed_files, workflow_run_id, started_at, finished_at, created_at)
- [x] 1.2 Create `backend/app/api/pipeline_runs.py` with `GET /api/v1/pipeline-runs` endpoint that unions `runs` and `pipeline_runs` tables, joins Pipeline for name, supports pagination and optional `source` filter
- [x] 1.3 Register pipeline_runs router in `backend/app/api/router.py`

## 2. Backend — Tests

- [x] 2.1 Create `backend/tests/test_pipeline_runs_api.py` with tests: empty response, standalone runs, workflow pipeline runs, mixed results ordering, source filter, pagination

## 3. Frontend — Types & API

- [x] 3.1 Add `UnifiedPipelineRun` TypeScript type to `frontend/src/types/index.ts`
- [x] 3.2 Add `pipelineRunsApi.list()` to `frontend/src/services/api.ts`

## 4. Frontend — Page Rename & Enhancement

- [x] 4.1 Rename `frontend/src/pages/RunHistory.tsx` to `frontend/src/pages/PipelineRuns.tsx`, update component name and data source to use `pipelineRunsApi`
- [x] 4.2 Update table columns: Pipeline (name instead of ID), Source (tag), Status, Files (processed/total), Started
- [x] 4.3 Add detail Modal showing full run info on row click
- [x] 4.4 Update `App.tsx` route: import PipelineRuns, change path to `/pipeline-runs`
- [x] 4.5 Update `AppLayout.tsx` sidebar: rename "Run History" to "Pipeline Runs", change key to `/pipeline-runs`
- [x] 4.6 Update `Dashboard.tsx` card: key from `runhistory` to `pipeline_runs`, title to "Pipeline Runs", path to `/pipeline-runs`

## 5. Verification

- [x] 5.1 Run backend checks: `ruff check .` + `ruff format --check .` + `pytest tests/ -v`
- [x] 5.2 Run frontend checks: `npx tsc -b` + `npm run build`
