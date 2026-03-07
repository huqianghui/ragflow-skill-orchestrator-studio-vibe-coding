## Why

The Data Source module currently has only a basic CRUD skeleton with 2 source types (`local_upload`, `azure_blob`) and an empty frontend table. Users need to connect to a wide variety of data stores — Azure Blob, ADLS Gen2, Cosmos DB, SQL Database, SharePoint, Amazon S3, SFTP, etc. — matching the full Azure AI Search "Import data (new)" experience. The frontend needs an intuitive card-grid type selector (not a dropdown), per-type configuration forms, connection testing, and a local upload flow with temp directory management and quota enforcement.

## What Changes

- **16 source types**: Expand from 2 to 16 source types across 3 categories — Local (1), Built-in indexer (6), Logic Apps connector (9). Each type has its own config fields and secret masking.
- **Azure-official SVG icons**: Download Azure service icons as static assets for the card grid UI.
- **Card-grid type selector page**: New `/data-sources/new` page with filterable 3-column card grid, grouped by category. Clicking a card opens a config modal.
- **Per-type config forms**: Each source type has typed config fields (connection strings, access keys, container names, paths, etc.), following the Connection module's `CONFIG_FIELDS` pattern.
- **Test connectivity**: New `POST /data-sources/{id}/test` endpoint that validates credentials and resource accessibility for each source type. Frontend "Test" button on both the config modal and the list page.
- **Secret masking**: `SECRET_FIELDS` per source type with `mask_config()` for API responses, matching the Connection module pattern.
- **Local upload temp directory**: Files uploaded via `local_upload` are stored in a configurable temp directory (`upload_temp_dir`), subject to per-file size limit, total quota, and retention-based cleanup.
- **System settings integration**: New config fields (`upload_temp_dir`, `upload_total_quota_mb`) displayed in the Settings page with current usage stats.
- **Dependency strategy**: Azure SDKs installed by default; AWS (`boto3`), Dropbox (`dropbox`), and SFTP (`paramiko`) as pip extras.

## Capabilities

### New Capabilities
- `data-source-connectors`: Covers all 16 source type definitions, per-type config fields, secret masking, test connectivity logic, and the extras-based dependency strategy.
- `data-source-ui`: Covers the card-grid type selector page, per-type config modals, Azure SVG icons, test/edit/delete UX on list page, and local upload drag-drop flow.
- `upload-temp-management`: Covers local upload temp directory management, quota enforcement, retention cleanup, and Settings page integration.

### Modified Capabilities
- `datasources`: The existing spec covers Phase 1 CRUD (done) and Phase 2 stubs. Source types expand from 2 to 16. Schema gains `SECRET_FIELDS` and `mask_config`. API gains `/test` endpoint and file upload endpoint.
- `system`: Settings model gains `upload_temp_dir` and `upload_total_quota_mb` config fields. Settings UI displays upload quota usage.

## Impact

- **Backend files**: Updated `backend/app/models/data_source.py`, updated `backend/app/schemas/data_source.py` (16 types, SECRET_FIELDS, mask_config), updated `backend/app/api/data_sources.py` (test endpoint, upload endpoint, quota endpoint), new `backend/app/services/data_source_tester.py` (per-type test logic), new `backend/app/services/upload_manager.py` (temp dir, quota, cleanup), updated `backend/app/config.py`
- **Frontend files**: Rewritten `frontend/src/pages/DataSources.tsx` (full CRUD list page), new `frontend/src/pages/DataSourceNew.tsx` (card-grid type selector), updated `frontend/src/types/index.ts` (16 source types), updated `frontend/src/services/api.ts` (test, upload endpoints), updated `frontend/src/App.tsx` (new route), updated `frontend/src/pages/Settings.tsx` (quota display)
- **Static assets**: New `frontend/public/icons/data-sources/*.svg` (16 icon files)
- **Dependencies**: New default: `azure-storage-blob`, `azure-storage-file-datalake`, `azure-cosmos`, `azure-data-tables`, `azure-storage-file-share`, `azure-storage-queue`, `azure-servicebus`, `azure-identity`, `pyodbc`, `httpx`. New extras: `[aws]` → boto3, `[dropbox]` → dropbox, `[sftp]` → paramiko, `[all]` → all extras.
- **Database**: DataSource `source_type` column now accepts 16 values. No schema migration needed (source_type is String(50), validation is at schema layer). New config fields in Settings.
- **API surface**: New endpoints: `POST /data-sources/{id}/test`, `POST /data-sources/upload` (multipart), `GET /data-sources/upload-quota`. Existing CRUD endpoints unchanged.
