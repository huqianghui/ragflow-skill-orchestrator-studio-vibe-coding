## 1. Backend Schema & Config

- [x] 1.1 Update `backend/app/config.py` — add `upload_temp_dir: str = "./data/uploads/tmp"` and `upload_total_quota_mb: int = 1024`
- [x] 1.2 Update `backend/app/schemas/data_source.py` — expand `source_type` regex to all 16 types; add `SOURCE_TYPES` list, `SECRET_FIELDS` dict, `mask_secret()`, `mask_config()` (reuse pattern from `schemas/connection.py`); add `DataSourceTestResult` schema
- [x] 1.3 Update `backend/app/models/data_source.py` — update `source_type` comment to list all 16 types; no column changes needed (String(50) is sufficient)
- [x] 1.4 Update `backend/app/api/data_sources.py` — apply `mask_config()` to all GET responses (list and detail); handle secret preservation on PUT (skip fields containing `****`)
- [x] 1.5 Run `ruff check .` + `ruff format --check .` to verify

## 2. Test Connectivity

- [x] 2.1 Create `backend/app/services/data_source_tester.py` — implement `test_data_source(source_type, config) -> TestResult` dispatcher with per-type test functions
- [x] 2.2 Implement Azure Built-in testers: `test_azure_blob` (BlobServiceClient → get_container_properties), `test_azure_adls_gen2` (DataLakeServiceClient → get_file_system_properties), `test_azure_cosmos_db` (CosmosClient → read database), `test_azure_sql` (pyodbc → SELECT 1), `test_azure_table` (TableServiceClient), `test_microsoft_onelake` (httpx + ClientSecretCredential)
- [x] 2.3 Implement Logic Apps connector testers: `test_sharepoint` (Graph API), `test_onedrive` (Graph API), `test_onedrive_business` (Graph API), `test_azure_file_storage` (ShareServiceClient), `test_azure_queues` (QueueServiceClient), `test_service_bus` (ServiceBusClient)
- [x] 2.4 Implement Extras-based testers: `test_amazon_s3` (boto3 with import check), `test_dropbox` (dropbox SDK with import check), `test_sftp_ssh` (paramiko with import check)
- [x] 2.5 Implement `test_local_upload` — check temp dir exists and is writable
- [x] 2.6 Add `POST /data-sources/{ds_id}/test` endpoint to `api/data_sources.py` — load DataSource, call `test_data_source()`, return result
- [x] 2.7 Write unit tests for tester dispatcher (mock SDK calls, test import error handling, test timeout)
- [x] 2.8 Run `ruff check .` + `ruff format --check .` + `pytest tests/ -v`

## 3. Upload Temp Management

- [x] 3.1 Create `backend/app/services/upload_manager.py` — implement `UploadManager` class with methods: `save_file(ds_id, filename, content)`, `delete_ds_files(ds_id)`, `get_quota_info()`, `cleanup_expired()`, `calculate_used_bytes()`
- [x] 3.2 Add `POST /data-sources/upload` endpoint (multipart) — validate file size, validate quota, save via UploadManager, update DataSource file_count/total_size
- [x] 3.3 Add `GET /data-sources/upload-quota` endpoint (static route, before `/{ds_id}`) — return quota info from UploadManager
- [x] 3.4 Update `DELETE /data-sources/{ds_id}` — if source_type is `local_upload`, call `UploadManager.delete_ds_files(ds_id)`
- [x] 3.5 Add startup cleanup in `main.py` lifespan — call `UploadManager.cleanup_expired()` on app start
- [x] 3.6 Write unit tests for UploadManager (mock filesystem, test quota enforcement, test cleanup logic)
- [x] 3.7 Run `ruff check .` + `ruff format --check .` + `pytest tests/ -v`

## 4. Dependencies

- [x] 4.1 Update `backend/pyproject.toml` (or `requirements.txt`) — add Azure SDK default dependencies: azure-storage-blob, azure-storage-file-datalake, azure-cosmos, azure-data-tables, azure-storage-file-share, azure-storage-queue, azure-servicebus, azure-identity, pyodbc, httpx
- [x] 4.2 Add extras sections: `[aws]` → boto3, `[dropbox]` → dropbox, `[sftp]` → paramiko, `[all]` → all three
- [x] 4.3 Run `pip install -e .` to verify default installation (manual verification)
- [x] 4.4 Run `pip install -e '.[all]'` to verify extras installation (manual verification)

## 5. Azure SVG Icons

- [x] 5.1 Download Azure service SVG icons from official Microsoft icon set for all 16 source types
- [x] 5.2 Create `frontend/public/icons/data-sources/` directory with 16 SVG files (kebab-case naming)
- [x] 5.3 Verify all icons render correctly at 48px and 24px sizes

## 6. Frontend Types & API

- [x] 6.1 Update `frontend/src/types/index.ts` — expand `DataSource.source_type` union to all 16 types; add `DataSourceTestResult` type; add `UploadQuotaInfo` type
- [x] 6.2 Update `frontend/src/services/api.ts` — add `dataSourcesApi.test(id)`, `dataSourcesApi.upload(dsId, file)`, `dataSourcesApi.getQuota()` methods

## 7. Frontend — Card Grid Type Selector Page

- [x] 7.1 Create `frontend/src/pages/DataSourceNew.tsx` — implement page layout: back link, title, filter input, card grid
- [x] 7.2 Define `SOURCE_TYPES` constant array with all 16 types: value, label, category, categoryLabel, icon path, configFields
- [x] 7.3 Implement card grid with 3-column `Row`/`Col` layout, grouped by category with section headers
- [x] 7.4 Implement filter: case-insensitive substring match on label, hide empty groups
- [x] 7.5 Implement card click → open config Modal (pass selected type to Modal)
- [x] 7.6 Implement config Modal for non-local types: Name, Description, type-specific config fields (password for secrets), Pipeline selector, Cancel/Test/Create buttons
- [x] 7.7 Implement config Modal for `local_upload`: Name, Description, Upload.Dragger with file types filter, quota display, Cancel/Upload & Create buttons
- [x] 7.8 Implement Test button in Modal: call API, show loading state, display success/error message
- [x] 7.9 Implement Create button: call POST API, navigate back to list on success
- [x] 7.10 Add route `/data-sources/new` → `DataSourceNew` in `App.tsx` (before `/data-sources` route for proper matching)

## 8. Frontend — List Page Enhancement

- [x] 8.1 Rewrite `frontend/src/pages/DataSources.tsx` — wire to real API: load data on mount with pagination, implement columns (Name, Type with icon+tag, Status colored tag, Files, Size formatted, Created At, Actions)
- [x] 8.2 Implement "New Data Source" button → navigate to `/data-sources/new`
- [x] 8.3 Implement Test action button with loading state
- [x] 8.4 Implement Edit action → Modal with pre-filled form (source_type disabled, secret placeholder)
- [x] 8.5 Implement Delete action with Popconfirm
- [x] 8.6 Add type-to-icon mapping and type-to-color mapping for Tags

## 9. Frontend — Settings Page Update

- [x] 9.1 Update `frontend/src/pages/Settings.tsx` — add "Upload Storage" section: fetch quota from API, display temp dir, max file size, total/used/available with Progress bar, retention days
- [x] 9.2 Implement Progress bar color: green (<70%), yellow (70-90%), red (>90%)

## 10. Verification & Cleanup

- [x] 10.1 Run backend checks: `ruff check .` + `ruff format --check .` + `pytest tests/ -v` — all must pass
- [x] 10.2 Run frontend checks: `npx tsc -b` + `npm run build` — all must pass
- [ ] 10.3 End-to-end manual test: navigate to /data-sources/new, verify 16 cards displayed with icons, filter works, click Azure Blob → Modal appears with correct fields, create a data source, verify it appears in list, test connectivity, edit, delete
- [ ] 10.4 End-to-end manual test: create local_upload data source, upload a file, verify quota display in Settings page
- [x] 10.5 Update `openspec/specs/datasources/spec.md` with expanded source types, test endpoint, upload endpoint, quota endpoint
- [x] 10.6 Update `openspec/specs/system/spec.md` with new config fields
