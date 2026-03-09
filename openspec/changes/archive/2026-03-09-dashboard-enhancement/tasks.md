## 1. Backend — Dashboard Stats API

- [x] 1.1 Create `backend/app/api/dashboard.py` with `GET /api/v1/dashboard/stats` route, implementing aggregated count queries for all 9 resources (skills, connections, pipelines, data_sources, targets, workflows, workflow_runs, runs, agents)
- [x] 1.2 Add skill_breakdown (builtin/custom), agent_breakdown (available/unavailable), workflow_run_stats (success_rate, completed, failed, running, pending) to the stats response
- [x] 1.3 Add recent_workflow_runs query (last 5 WorkflowRun records with id, workflow_id, status, total_files, processed_files, failed_files, started_at, finished_at)
- [x] 1.4 Register dashboard router in `backend/app/api/router.py`
- [x] 1.5 Create `backend/app/schemas/dashboard.py` with DashboardStats Pydantic response schema

## 2. Backend — Tests

- [x] 2.1 Create `backend/tests/test_dashboard_api.py` with tests: stats endpoint returns correct structure, empty database returns zeros, success_rate calculation, recent_workflow_runs ordering and limit

## 3. Frontend — Types & API Service

- [x] 3.1 Add `DashboardStats` TypeScript type to `frontend/src/types/index.ts` matching the backend response schema
- [x] 3.2 Add `dashboardApi.getStats()` to `frontend/src/services/api.ts`

## 4. Frontend — Dashboard Page Refactor

- [x] 4.1 Refactor `frontend/src/pages/Dashboard.tsx` to call single `dashboardApi.getStats()` instead of 7 parallel list APIs
- [x] 4.2 Add Workflows and Workflow Runs stat cards (total 9 cards), with Skills showing builtin/custom breakdown and Agents showing online/offline breakdown
- [x] 4.3 Add success rate percentage display on the Workflow Runs card
- [x] 4.4 Add "Recent Workflow Runs" section below cards listing last 5 runs with status tag, file progress (processed/total), start time, and click-to-navigate to Workflow Runs detail
- [x] 4.5 Implement loading state (Spin) and error fallback (display "-" when API fails)

## 5. Verification

- [x] 5.1 Run backend checks: `ruff check .` + `ruff format --check .` + `pytest tests/ -v`
- [x] 5.2 Run frontend checks: `npx tsc -b` + `npm run build`
