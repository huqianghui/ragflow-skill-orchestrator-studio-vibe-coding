## 1. Data Model & Migration

- [x] 1.1 Add `pipeline_io` (JSON, nullable) column to `Skill` model in `backend/app/models/skill.py`
- [x] 1.2 Update Alembic init migration (`alembic/versions/d750dfb7d5f0_init_tables.py`) to include `pipeline_io` column
- [x] 1.3 Update `SkillResponse` schema in `backend/app/schemas/skill.py` to include `pipeline_io` field
- [x] 1.4 Delete local SQLite DB and re-run `alembic upgrade head` to verify migration

## 2. Pipeline I/O Defaults & Seed Data

- [x] 2.1 Create `backend/app/data/pipeline_defaults.py` with `PIPELINE_DEFAULTS` dict — default `context/inputs/outputs` for all 16 built-in skills (per design table)
- [x] 2.2 Update `backend/app/data/builtin_skills.py` — add `pipeline_io` field to each of the 16 BUILTIN_SKILLS entries, referencing PIPELINE_DEFAULTS
- [x] 2.3 Update `backend/app/services/skill_seeder.py` — ensure `pipeline_io` is included when seeding new skills (and optionally update existing built-in skills' pipeline_io on startup)
- [x] 2.4 Verify: start backend, check that all 16 built-in skills have non-null `pipeline_io` via GET /api/v1/skills

## 3. Enrichment Tree Engine

- [x] 3.1 Create `backend/app/services/pipeline/__init__.py` (empty package init)
- [x] 3.2 Create `backend/app/services/pipeline/enrichment_tree.py` — implement `EnrichmentTree` class with `get(path)`, `set(path, value)`, `expand_context(context_path)`, `resolve_source(source, context_path, instance_path)`, `to_dict(exclude_binary)`
- [x] 3.3 Write unit tests for EnrichmentTree: path get/set, context expansion with `/*`, source resolution with wildcard replacement, binary exclusion in to_dict, edge cases (nested arrays, missing paths)

## 4. Pipeline Runner

- [x] 4.1 Create `backend/app/services/pipeline/runner.py` — implement `PipelineRunner` class with async `execute(pipeline, file_content, file_name, db)` method
- [x] 4.2 Implement per-node execution loop: expand context → resolve inputs → call skill.execute() → write outputs to tree → record node_result
- [x] 4.3 Implement connection resolution with 3-level priority: node-level → skill-level → default connection
- [x] 4.4 Implement fan-out: when context has `/*`, iterate over array elements and execute skill per element
- [x] 4.5 Implement error handling: stop on first node failure, return partial results with `status: "partial"`
- [x] 4.6 Implement input/output snapshot recording per node (truncate large values for response)
- [x] 4.7 Write unit tests for PipelineRunner: simple 2-node pipeline, fan-out pipeline, error-on-second-node, connection resolution fallback

## 5. Pipeline Debug API

- [x] 5.1 Add `POST /pipelines/{id}/debug` endpoint to `backend/app/api/pipelines.py` — accept multipart file upload, invoke PipelineRunner, return structured debug result
- [x] 5.2 Add `GET /pipelines/available-skills` endpoint (before `/{pipeline_id}` route to avoid path param collision) — return all skills with pipeline_io
- [x] 5.3 Add timeout handling: wrap PipelineRunner execution with `asyncio.wait_for` using `sync_execution_timeout_s`
- [x] 5.4 Add validation: return 400 if pipeline has no nodes
- [x] 5.5 Run ruff check + ruff format on all backend changes

## 6. Pipeline Templates

- [x] 6.1 Create `backend/app/data/pipeline_templates.py` — define 5 templates (PDF indexing, multilingual, entity extraction, PII redaction, image analysis) with complete node definitions including skill_name references
- [x] 6.2 Add `GET /pipelines/templates` endpoint to return available templates (each with name, description, and node definitions with skill_name instead of skill_id — frontend resolves to skill_id from available skills)

## 7. Frontend Types & API

- [x] 7.1 Update `frontend/src/types/index.ts` — add `PipelineNode`, `PipelineInput`, `PipelineOutput`, `PipelineDebugResult`, `NodeExecutionResult`, `EnrichmentTreeData` types; update `Pipeline.graph_data` to use typed `PipelineNode[]`
- [x] 7.2 Update `frontend/src/services/api.ts` — complete `pipelinesApi` with all CRUD methods (list, create, get, update, delete); add `debugPipeline(id, file)`, `getAvailableSkills()`, `getTemplates()` methods

## 8. Pipeline List Page

- [x] 8.1 Rewrite `frontend/src/pages/Pipelines.tsx` — wire to real API: load data on mount, implement New Pipeline button (with modal including name, description, template selector), Edit navigation, Delete with confirmation
- [x] 8.2 Implement template selection in the New Pipeline modal: fetch templates from API, show template cards with description, create pipeline with pre-filled graph_data when template selected

## 9. Pipeline Editor — Edit Mode

- [x] 9.1 Rewrite `frontend/src/pages/PipelineEditor.tsx` — implement page layout: top bar (Back, pipeline name, mode switch [Edit|Debug], Save button), mode state management, load pipeline data on mount
- [x] 9.2 Implement Skill node list — ordered list of collapsible Card components, each showing: position number, skill name, type tag (builtin/custom), connection indicator, expand/collapse toggle, delete button, drag handle
- [x] 9.3 Implement drag-to-reorder — use HTML5 drag-and-drop or a sortable library to reorder nodes, auto-update position values
- [x] 9.4 Implement node card expanded view — Connection dropdown (filtered by required_resource_types), Context path selector, Input source path dropdowns, Output targetName fields, Config override form (reuse config_schema → form generation logic from BuiltinSkillEditor)
- [x] 9.5 Implement available paths computation — walk nodes in order, accumulate output paths from each node; wildcard contexts generate `/*` paths; provide as options to source path dropdowns
- [x] 9.6 Implement "Add Skill" modal — fetch available skills from API, group by type (built-in / custom), show name + description + resource type; on select, create new node with pipeline_io defaults appended to list
- [x] 9.7 Implement Save — collect all node configs into graph_data.nodes, call PUT /pipelines/{id}, show success/error notification

## 10. Pipeline Editor — Debug Mode

- [x] 10.1 Implement Debug mode 3-column layout — left column (~200px): file upload zone + skill execution status list; middle column (flex): enrichment tree viewer; right column (~400px): node detail panel
- [x] 10.2 Implement file upload in left column — drag-and-drop zone (reuse pattern from BuiltinSkillEditor), show uploaded file name/size, enable "Run" button after upload
- [x] 10.3 Implement "Run" button — call POST /pipelines/{id}/debug with file, show loading state, parse response into state (enrichment_tree, node_results)
- [x] 10.4 Implement skill execution status list (left column) — for each node: show name + status icon (check/x/blank) + execution_time_ms; clickable to select node for detail view; bottom summary: total time + completion ratio
- [x] 10.5 Implement Enrichment Tree viewer (middle column) — recursive tree component: expandable objects/arrays, inline scalar values, type icons; truncate long strings
- [x] 10.6 Implement Node Detail panel (right column) — show selected node: skill name, status badge, execution time, records processed; collapsible Input/Output JSON viewers; for fan-out nodes: record selector (dropdown) to switch between per-record snapshots
- [x] 10.7 Implement tree-to-node linking — clicking a node in the status list highlights it and shows its details

## 11. Verification & Cleanup

- [x] 11.1 Run backend checks: `ruff check .` + `ruff format --check .` + `pytest tests/ -v` — all must pass
- [x] 11.2 Run frontend checks: `npx tsc -b` + `npm run build` — all must pass
- [x] 11.3 End-to-end manual test: create pipeline from "PDF 文档索引" template, verify 3 nodes appear in editor, upload a PDF in debug mode, verify enrichment tree shows content/chunks/embeddings, click nodes to see input/output
- [x] 11.4 Update `docs/api-reference.md` with new endpoints: POST /pipelines/{id}/debug, GET /pipelines/available-skills, GET /pipelines/templates
