## Why

Custom skills and built-in skills are individually tested and working, but there is no way to chain them together into an end-to-end document processing pipeline. Users need to visually compose skills into ordered pipelines (e.g., DocumentCracker → TextSplitter → TextEmbedder), upload a file to debug the entire flow, and inspect each node's input/output — exactly like Azure AI Search's Debug Session experience. Pipeline CRUD API and empty frontend placeholders already exist; the missing piece is the orchestration engine, the pipeline editor UI, and the debug session UI.

## What Changes

- **Enrichment Tree engine**: New `EnrichmentTree` class that serves as a shared, path-addressable data store during pipeline execution. Skills read from and write to the tree using paths like `/document/content` or `/document/chunks/*/text`. The `context` field controls fan-out — when set to `/document/chunks/*`, a skill runs once per chunk.
- **Pipeline Runner**: New `PipelineRunner` class that executes pipeline nodes in order, resolving connections, mapping tree paths to skill inputs, calling existing skill implementations, and writing outputs back to the tree. Records per-node execution snapshots (input, output, timing, errors).
- **Pipeline Debug API**: New `POST /pipelines/{id}/debug` endpoint accepting a multipart file upload, executing the full pipeline, and returning the enrichment tree plus per-node results.
- **Pipeline I/O defaults**: Each built-in skill gets a `pipeline_io` declaration defining its default `context`, `inputs` (source paths), and `outputs` (target names). Stored in the Skill model and seeded with BUILTIN_SKILLS.
- **Available skills API**: New `GET /pipelines/{id}/available-skills` endpoint returning all skills with their pipeline_io defaults, for the "Add Skill" dialog.
- **Pipeline Editor UI (Edit mode)**: Replace the placeholder `PipelineEditor.tsx` with an ordered, drag-sortable skill node list. Each node card shows connection selector, context, input source path dropdowns (with smart suggestions based on preceding nodes), output target names, and config override form.
- **Pipeline Editor UI (Debug mode)**: Azure AI Search Debug Session-style 3-column layout — left: skill execution status list + file upload; middle: enrichment data tree viewer (expandable); right: selected node's input/output detail panel.
- **Pipeline list page**: Wire `Pipelines.tsx` to real API with full CRUD (currently shows an empty table).
- **Pipeline templates**: Pre-configured pipeline definitions for common patterns (PDF indexing, multilingual processing, entity extraction, PII redaction, image analysis).
- **Skill model extension**: Add `pipeline_io` (JSON) field to Skill model; update Alembic migration and seed logic.

## Capabilities

### New Capabilities
- `pipeline-orchestration`: Covers the Enrichment Tree engine, PipelineRunner execution, debug API, pipeline I/O defaults, available-skills API, pipeline templates, and the `pipeline_io` Skill model extension.
- `pipeline-editor-ui`: Covers the Pipeline Editor page (edit mode with sortable node list + debug mode with 3-column Azure-style layout), the Pipeline list page CRUD wiring, and all frontend components.

### Modified Capabilities
- `pipelines`: The existing pipeline spec covers Phase 1 CRUD (done) and Phase 2 stubs. The `graph_data` format is now fully defined with node structure (id, skill_id, position, context, inputs, outputs, config_overrides, bound_connection_id). Pipeline status workflow gains `debugging` state.
- `skills`: The Skill model gains a new `pipeline_io` JSON field. BUILTIN_SKILLS seed data updated with pipeline I/O declarations.

## Impact

- **Backend files**: New `backend/app/services/pipeline/` package (enrichment_tree.py, runner.py), new `backend/app/data/pipeline_defaults.py`, updated `backend/app/api/pipelines.py`, updated `backend/app/models/pipeline.py`, updated `backend/app/models/skill.py`, updated `backend/app/data/builtin_skills.py`, updated `backend/app/services/skill_seeder.py`, new Alembic migration
- **Frontend files**: Rewritten `frontend/src/pages/PipelineEditor.tsx`, updated `frontend/src/pages/Pipelines.tsx`, updated `frontend/src/services/api.ts`, updated `frontend/src/types/index.ts`
- **Dependencies**: No new backend dependencies. No new frontend dependencies (@xyflow/react already installed but not used for this phase — Azure-style list approach chosen over visual DAG canvas).
- **Database**: Skill table adds `pipeline_io` column (JSON, nullable). Pipeline `graph_data` format now has defined node/edge schema. Requires Alembic migration update + DB recreation.
- **API surface**: Two new endpoints (`POST /pipelines/{id}/debug`, `GET /pipelines/{id}/available-skills`). Existing pipeline CRUD endpoints unchanged.
