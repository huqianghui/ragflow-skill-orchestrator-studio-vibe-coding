## 1. Backend Schema & Config

- [x] 1.1 Update `backend/app/schemas/target.py` — expand `target_type` regex to 6 types; add `TARGET_TYPES` tuple, `SECRET_FIELDS` dict, `mask_secret()`, `mask_config()` (reuse DataSource pattern); add `TargetTestResult`, `TargetSchemaDiscovery`, `MappingValidationResult` schemas
- [x] 1.2 Update `backend/app/models/target.py` — update `target_type` comment to list 6 types; no column changes needed
- [x] 1.3 Update `backend/app/api/targets.py` — apply `mask_config()` to all GET responses; handle secret preservation on PUT; add static routes before `/{target_id}`
- [x] 1.4 Update `frontend/src/types/index.ts` — expand `Target.target_type` union to 6 types; add `TargetTestResult`, `TargetSchemaDiscovery`, `MappingValidationResult` types
- [x] 1.5 Run `ruff check .` + `ruff format --check .` to verify

## 2. Connectivity Testing

- [x] 2.1 Create `backend/app/services/target_tester.py` — implement `run_target_test(target_type, config) -> TestResult` dispatcher with per-type test functions
- [x] 2.2 Implement Azure testers: `test_azure_ai_search` (SearchIndexClient → list_index_names), `test_azure_blob` (BlobServiceClient → get_container_properties), `test_cosmosdb_gremlin` (Gremlin client → g.V().limit(1))
- [x] 2.3 Implement extras-based testers: `test_neo4j` (driver → session.run RETURN 1), `test_mysql` (pymysql connect + SELECT 1), `test_postgresql` (psycopg2 connect + SELECT 1)
- [x] 2.4 Add `POST /targets/{target_id}/test` endpoint to `api/targets.py`
- [x] 2.5 Write unit tests for target tester dispatcher (mock SDK, test import check, test timeout)
- [x] 2.6 Run `ruff check .` + `ruff format --check .` + `pytest tests/ -v`

## 3. Schema Discovery

- [x] 3.1 Create `backend/app/services/target_schema_discovery.py` — implement `discover_schema(target_type, config) -> SchemaDiscoveryResult` dispatcher
- [x] 3.2 Implement `discover_azure_ai_search` — SearchIndexClient.get_index(): return fields (name, type, searchable, filterable, vector config); handle index not found → exists=false
- [x] 3.3 Implement `discover_cosmosdb_gremlin` — Gremlin g.V().label().dedup() + property keys
- [x] 3.4 Implement `discover_neo4j` — CALL db.labels() + db.schema.nodeTypeProperties()
- [x] 3.5 Implement `discover_mysql` — DESCRIBE table_name; return columns
- [x] 3.6 Implement `discover_postgresql` — information_schema.columns query; return columns
- [x] 3.7 Add `GET /targets/{target_id}/discover-schema` endpoint
- [x] 3.8 Write unit tests for schema discovery (mock responses)
- [x] 3.9 Run lint + tests

## 4. Azure AI Search Index Management

- [x] 4.1 Create `backend/app/services/target_index_manager.py` — `infer_index_schema(pipeline, field_mappings)` to generate AI Search index definition from Pipeline graph_data
- [x] 4.2 Implement vector dimension inference chain: field_mappings → Pipeline TextEmbedder config → model name lookup table → default 1536
- [x] 4.3 Implement `create_search_index(config, index_definition)` — SearchIndexClient.create_index() with vector search profile (HNSW)
- [x] 4.4 Add `POST /targets/{target_id}/create-index` endpoint — body optional (uses suggested_schema if empty)
- [x] 4.5 Integrate suggested_schema into discover-schema response (when index not found + pipeline_id set)
- [x] 4.6 Write unit tests for index schema inference and creation (mock SearchIndexClient)
- [x] 4.7 Run lint + tests

## 5. Schema Mapping Engine

- [x] 5.1 Create `backend/app/services/mapping_engine.py` — `infer_pipeline_outputs(pipeline) -> list[OutputField]` to extract all output paths from Pipeline graph_data
- [x] 5.2 Implement `suggest_mappings(pipeline_outputs, target_schema) -> list[SuggestedMapping]` — name matching (exact + case-insensitive + camelCase↔snake_case) + type compatibility check
- [x] 5.3 Implement `validate_mapping(target_type, field_mappings, pipeline_outputs, target_schema) -> ValidationResult` — check key field, required fields, type compat, vector dimensions
- [x] 5.4 Implement `apply_mapping(field_mappings, enrichment_tree_data) -> list[dict]` — expand write_context, resolve source paths, transform types, produce output records
- [x] 5.5 Add `GET /targets/{target_id}/pipeline-outputs?pipeline_id=X` endpoint — return inferred output fields
- [x] 5.6 Add `POST /targets/{target_id}/validate-mapping` endpoint — body = field_mappings + pipeline_id
- [x] 5.7 Write unit tests for mapping engine: infer outputs, suggest, validate, apply
- [x] 5.8 Run lint + tests

## 6. Writer Services

- [x] 6.1 Create `backend/app/services/target_writer.py` — implement `write_to_target(target_type, config, field_mappings, records) -> WriteResult` dispatcher
- [x] 6.2 Implement `write_azure_ai_search` — SearchClient.merge_or_upload_documents (batch ≤ 1000)
- [x] 6.3 Implement `write_azure_blob` — BlobClient.upload_blob with path template expansion (support variables: pipeline_name, source_file, date, timestamp, index, output_name)
- [x] 6.4 Implement `write_cosmosdb_gremlin` — parse graph_mapping, addV/addE with partition key injection
- [x] 6.5 Implement `write_neo4j` — parse graph_mapping, Cypher MERGE transactions
- [x] 6.6 Implement `write_mysql` — pymysql INSERT ON DUPLICATE KEY UPDATE; support auto_create_table
- [x] 6.7 Implement `write_postgresql` — psycopg2 INSERT ON CONFLICT; support pgvector extension + vector column type; support auto_create_table
- [x] 6.8 Add `POST /targets/{target_id}/write` endpoint (for manual testing) — body = { pipeline_id, records } or { data } for direct write
- [x] 6.9 Write unit tests for writer dispatcher (mock all SDK calls)
- [x] 6.10 Run lint + tests

## 7. Dependencies

- [x] 7.1 Update `backend/pyproject.toml` — add default: azure-search-documents>=11.4, gremlinpython>=3.7
- [x] 7.2 Add extras: `[neo4j]` → neo4j>=5.0, `[mysql]` → pymysql>=1.1, `[postgresql]` → psycopg2-binary>=2.9, `[pgvector]` → psycopg2-binary>=2.9 + pgvector>=0.2
- [x] 7.3 Add `[all-targets]` → all target extras; update `[all]` to include data-source extras + all-targets
- [x] 7.4 Run `pip install -e .` to verify default installation

## 8. Frontend Types & API

- [x] 8.1 Update `frontend/src/services/api.ts` — add `targetsApi.test(id)`, `.discoverSchema(id)`, `.createIndex(id, body)`, `.getPipelineOutputs(id, pipelineId)`, `.validateMapping(id, body)`, `.write(id, body)` methods
- [x] 8.2 Verify TypeScript types match backend schemas (TargetTestResult, SchemaDiscovery, etc.)

## 9. Frontend — SVG Icons

- [x] 9.1 Create `frontend/public/icons/targets/` directory with 6 SVG files: azure-ai-search.svg, azure-blob-storage.svg, cosmosdb-gremlin.svg, neo4j.svg, mysql.svg, postgresql.svg

## 10. Frontend — Card Grid Type Selector

- [x] 10.1 Create `frontend/src/pages/TargetNew.tsx` — page layout: back link, title, filter input, card grid
- [x] 10.2 Define `TARGET_TYPES` constant with 6 types: value, label, category, categoryLabel, icon, configFields
- [x] 10.3 Implement card grid with 3-column layout, grouped by 4 categories (Search / Storage / Graph DB / Relational DB)
- [x] 10.4 Implement filter: case-insensitive match, hide empty groups
- [x] 10.5 Implement card click → open multi-step config Modal
- [x] 10.6 Add route `/targets/new` → TargetNew in App.tsx (before `/targets`)

## 11. Frontend — Config Modal (Step 1: Connection)

- [x] 11.1 Implement connection config step: Name*, Description, Pipeline selector (optional), type-specific config fields, Cancel/Test/Next buttons
- [x] 11.2 Implement Test button: create Target → test → keep on success, delete on failure
- [x] 11.3 Implement Pipeline selector: fetch pipelines list, populate dropdown, store pipeline_id

## 12. Frontend — Config Modal (Step 2: Mapping)

- [x] 12.1 Implement Schema Mapping UI for search/relational types: left panel (pipeline outputs via API), right panel (target schema via discover-schema), mapping rows with source dropdown + target dropdown
- [x] 12.2 Implement Auto-suggest button: call suggest API, populate mappings
- [x] 12.3 Implement Validate button: call validate-mapping API, show errors/warnings
- [x] 12.4 Implement write_context selector: dropdown with "/document" and array paths from pipeline
- [x] 12.5 Implement vector field config: dimensions input + algorithm dropdown (for AI Search)
- [x] 12.6 Implement Graph Mapping UI for cosmosdb_gremlin/neo4j: vertex source + fields form, edge source + fields form
- [x] 12.7 Implement Blob Path Template UI for azure_blob: template input with variable chips, content_format dropdown, preview
- [x] 12.8 Implement AI Search "Create Index" button when index not found: show suggested schema, confirm → create
- [x] 12.9 Implement Create/Save button: call create/update API with full field_mappings, navigate to list

## 13. Frontend — List Page Enhancement

- [x] 13.1 Rewrite `frontend/src/pages/Targets.tsx` — wire to real API, implement columns: Name, Type (icon+tag), Pipeline, Status (colored tag), Created At, Actions
- [x] 13.2 Implement "New Target" button → navigate to /targets/new
- [x] 13.3 Implement Test action with loading state
- [x] 13.4 Implement Edit action → multi-step Modal with pre-filled form (target_type disabled, secret placeholder)
- [x] 13.5 Implement Delete action with Popconfirm
- [x] 13.6 Add type-to-icon and type-to-color mapping for Tags

## 14. Verification & Cleanup

- [x] 14.1 Run backend checks: `ruff check .` + `ruff format --check .` + `pytest tests/ -v`
- [x] 14.2 Run frontend checks: `npx tsc -b` + `npm run build`
- [x] 14.3 E2E manual test: /targets/new → 6 cards, filter, configure Azure AI Search with test + index creation + field mapping
- [x] 14.4 E2E manual test: configure graph target (CosmosDB Gremlin or Neo4j), verify graph mapping UI
- [x] 14.5 E2E manual test: configure relational target (MySQL/PostgreSQL), verify column mapping
- [x] 14.6 E2E manual test: configure Blob target, verify path template preview
- [x] 14.7 Update `openspec/specs/targets/spec.md` with expanded types, test/discovery/mapping/write endpoints
- [x] 14.8 Update `openspec/specs/system/spec.md` if new config fields added
