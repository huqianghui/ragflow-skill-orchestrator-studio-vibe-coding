## Context

The platform has a skeletal Data Source module: a `DataSource` SQLAlchemy model with `source_type` limited to `local_upload | azure_blob`, basic CRUD API, an empty frontend Table page, and `dataSourcesApi` client methods. The Connection module (a separate concept for AI service credentials) provides a reference pattern for typed config fields, secret masking, test connectivity, and frontend Modal forms.

The user wants to align with Azure AI Search's "Import data (new)" experience — a card-grid selector showing all 16 source types with Azure-official icons, grouped by category, with per-type config forms and connection testing.

## Goals / Non-Goals

**Goals:**
- Support all 16 source types from Azure AI Search "Import data (new)"
- Azure-official SVG icons for every source type
- Card-grid type selector (3 columns, filterable, grouped by category)
- Per-type config fields with secret masking (matching Connection module pattern)
- Test connectivity for every source type
- Local upload temp directory with quota and retention cleanup
- Extras-based dependency strategy (Azure default, AWS/Dropbox/SFTP optional)
- Settings page integration for upload quota display

**Non-Goals:**
- Actually reading/syncing files from data sources (that's Pipeline execution scope)
- File browser / file listing within a data source
- Incremental sync / change detection
- OAuth flows for SharePoint/OneDrive (v1 uses service principal client_id/client_secret)
- Production-grade connection pooling for SQL/Cosmos
- Scheduled cleanup job (v1 provides manual cleanup or startup cleanup)

## Decisions

### Decision 1: 16 Source Types in 3 Categories

**Choice**: Match Azure AI Search exactly with 16 types in 3 groups.

| Category | source_type key | Display Name |
|----------|----------------|--------------|
| **Local** | `local_upload` | Local File Upload |
| **Built-in indexer** | `azure_blob` | Azure Blob Storage |
| | `azure_adls_gen2` | Azure Data Lake Storage Gen2 |
| | `azure_cosmos_db` | Azure Cosmos DB |
| | `azure_sql` | Azure SQL Database |
| | `azure_table` | Azure Table Storage |
| | `microsoft_onelake` | Microsoft OneLake |
| **Logic Apps connector** | `sharepoint` | SharePoint |
| | `onedrive` | OneDrive |
| | `onedrive_business` | OneDrive for Business |
| | `azure_file_storage` | Azure File Storage |
| | `azure_queues` | Azure Queues |
| | `service_bus` | Service Bus |
| | `amazon_s3` | Amazon S3 |
| | `dropbox` | Dropbox |
| | `sftp_ssh` | SFTP - SSH |

### Decision 2: Per-Type Config Fields

**Choice**: Each source type defines its own `CONFIG_FIELDS` list, exactly like the Connection module.

```
local_upload:
  (no config fields — uses file upload flow)

azure_blob:
  connection_string  (secret, required)
  container_name     (required)
  path_prefix

azure_adls_gen2:
  account_name       (required)
  account_key        (secret, required)
  filesystem         (required)
  path_prefix

azure_cosmos_db:
  connection_string  (secret, required)
  database           (required)
  container          (required)
  query

azure_sql:
  connection_string  (secret, required)
  table_or_view      (required)
  query

azure_table:
  connection_string  (secret, required)
  table_name         (required)

microsoft_onelake:
  tenant_id          (required)
  client_id          (required)
  client_secret      (secret, required)
  workspace_id       (required)
  lakehouse_id       (required)
  path_prefix

sharepoint:
  site_url           (required)
  tenant_id          (required)
  client_id          (required)
  client_secret      (secret, required)
  document_library
  folder_path

onedrive:
  tenant_id          (required)
  client_id          (required)
  client_secret      (secret, required)
  drive_id
  folder_path

onedrive_business:
  tenant_id          (required)
  client_id          (required)
  client_secret      (secret, required)
  user_email         (required)
  folder_path

azure_file_storage:
  connection_string  (secret, required)
  share_name         (required)
  directory_path

azure_queues:
  connection_string  (secret, required)
  queue_name         (required)

service_bus:
  connection_string  (secret, required)
  queue_or_topic     (required)
  subscription

amazon_s3:
  access_key_id      (secret, required)
  secret_access_key  (secret, required)
  bucket_name        (required)
  region             (required)
  path_prefix

dropbox:
  access_token       (secret, required)
  folder_path

sftp_ssh:
  host               (required)
  port               (default: 22)
  username           (required)
  auth_method        (password | private_key, required)
  password           (secret, conditional)
  private_key        (secret, conditional)
  remote_path        (required)
```

### Decision 3: Secret Masking (same pattern as Connection)

```python
SECRET_FIELDS: dict[str, list[str]] = {
    "azure_blob": ["connection_string"],
    "azure_adls_gen2": ["account_key"],
    "azure_cosmos_db": ["connection_string"],
    "azure_sql": ["connection_string"],
    "azure_table": ["connection_string"],
    "microsoft_onelake": ["client_secret"],
    "sharepoint": ["client_secret"],
    "onedrive": ["client_secret"],
    "onedrive_business": ["client_secret"],
    "azure_file_storage": ["connection_string"],
    "azure_queues": ["connection_string"],
    "service_bus": ["connection_string"],
    "amazon_s3": ["access_key_id", "secret_access_key"],
    "dropbox": ["access_token"],
    "sftp_ssh": ["password", "private_key"],
}
```

Reuse `mask_secret()` from `schemas/connection.py` (or extract to `utils/secrets.py`).

### Decision 4: Test Connectivity per Type

**Choice**: `POST /data-sources/{id}/test` → `{ success: bool, message: str }`

Each type implements a lightweight validation — connect, verify the target resource exists, disconnect. No data reading.

```
Source Type          | SDK / Library              | Test Action
---------------------|---------------------------|----------------------------------
local_upload         | os                        | Check temp dir exists & writable
azure_blob           | azure-storage-blob        | BlobServiceClient → get_container_client → get_container_properties
azure_adls_gen2      | azure-storage-file-datalake| DataLakeServiceClient → get_file_system_client → get_file_system_properties
azure_cosmos_db      | azure-cosmos              | CosmosClient → get_database_client → read
azure_sql            | pyodbc                    | connect → cursor.execute("SELECT 1")
azure_table          | azure-data-tables         | TableServiceClient → get_table_client → get_table_properties (requires WEBSITE_CONTENTAZUREFILECONNECTIONSTRING?)
microsoft_onelake    | httpx + azure-identity    | ClientSecretCredential → REST call to OneLake API
sharepoint           | httpx                     | Graph API → GET /sites/{site_url}
onedrive             | httpx                     | Graph API → GET /drives/{drive_id}
onedrive_business    | httpx                     | Graph API → GET /users/{email}/drive
azure_file_storage   | azure-storage-file-share  | ShareServiceClient → get_share_client → get_share_properties
azure_queues         | azure-storage-queue       | QueueServiceClient → get_queue_client → get_queue_properties
service_bus          | azure-servicebus          | ServiceBusClient → get_queue_receiver (peek)
amazon_s3            | boto3                     | s3.head_bucket(Bucket=name)
dropbox              | dropbox                   | Dropbox → users_get_current_account
sftp_ssh             | paramiko                  | SSHClient → connect → sftp → listdir
```

Test functions are organized in `backend/app/services/data_source_tester.py` with a dispatcher:

```python
async def test_data_source(source_type: str, config: dict) -> TestResult:
    tester = TESTERS.get(source_type)
    if not tester:
        return TestResult(success=False, message=f"Unknown type: {source_type}")
    return await tester(config)
```

For extras-based types (S3, Dropbox, SFTP), the tester does an `import` check first and returns a helpful error if the SDK is missing.

### Decision 5: Dependency Strategy — Azure Default, Extras Optional

**Choice**: All Azure SDKs are default dependencies; non-Azure are pip extras.

```toml
# pyproject.toml
[project]
dependencies = [
    # ... existing ...
    "azure-storage-blob>=12.0",
    "azure-storage-file-datalake>=12.0",
    "azure-cosmos>=4.0",
    "azure-data-tables>=12.0",
    "azure-storage-file-share>=12.0",
    "azure-storage-queue>=12.0",
    "azure-servicebus>=7.0",
    "azure-identity>=1.0",
    "pyodbc>=5.0",
]

[project.optional-dependencies]
aws = ["boto3>=1.28"]
dropbox = ["dropbox>=12.0"]
sftp = ["paramiko>=3.0"]
all = ["boto3>=1.28", "dropbox>=12.0", "paramiko>=3.0"]
```

Runtime check pattern for extras:
```python
async def test_amazon_s3(config: dict) -> TestResult:
    try:
        import boto3
    except ImportError:
        return TestResult(
            success=False,
            message="Amazon S3 requires extra dependencies: pip install '.[aws]'"
        )
    # ... actual test logic ...
```

### Decision 6: Local Upload Temp Directory Management

**Choice**: `local_upload` stores files in `{upload_temp_dir}/{ds_id}/`, enforced by quota and retention.

**Config fields** (in `config.py`):
```python
upload_temp_dir: str = "./data/uploads/tmp"
upload_total_quota_mb: int = 1024  # 1 GB total
```

**API endpoints**:
- `POST /data-sources/upload` — multipart file upload, validates size and quota, stores to `{temp_dir}/{ds_id}/{filename}`
- `GET /data-sources/upload-quota` — returns `{ total_mb, used_mb, available_mb, retention_days }`

**Cleanup logic** (in `upload_manager.py`):
- On startup: scan temp dir, delete files older than `cleanup_retention_days`
- On upload: check if `used + new_file_size > quota`, reject if exceeded
- Future: scheduled cleanup (cron-like, deferred)

**Settings page** displays:
- Upload Temp Directory path
- Max Upload Size (per file)
- Total Quota / Used / Available (with progress bar)
- Cleanup Retention days

### Decision 7: Frontend UX — Card Grid + Modal

**Route**: `/data-sources/new` — new page with card-grid selector

**Card grid layout**:
- 3-column responsive grid (Ant Design `Row` + `Col span={8}`)
- Grouped by category with section headers ("Local", "Built-in indexer", "Logic Apps connector")
- Each card: icon (48px SVG), title, subtitle (category label)
- Filter input at top: filters by card title
- Clicking a card → opens a config Modal (or for `local_upload`, a modal with file drop zone)

**Config Modal** (per-type):
- Name (required)
- Description (optional)
- Type-specific config fields (password input for secrets, text for others)
- Pipeline selector (optional dropdown)
- Footer: Cancel | Test | Create

**Local Upload Modal**:
- Name (required)
- Description (optional)
- Ant Design `Upload.Dragger` component for file drag-drop
- Shows quota: "234 MB / 1 GB used"
- Supported file types list
- Footer: Cancel | Upload & Create

**List page** (enhanced `DataSources.tsx`):
- Table with columns: Name, Type (icon + tag), Status (colored tag), Files, Size, Actions
- Actions: Test (loading state), Edit, Delete (with confirm)
- "New Data Source" button → navigates to `/data-sources/new`

### Decision 8: Azure SVG Icons

Download Azure architecture icons from the official Microsoft icon set. Store as static SVG in `frontend/public/icons/data-sources/`. Each icon ~2-5KB.

File naming convention:
```
frontend/public/icons/data-sources/
├── local-upload.svg          (generic folder/upload icon)
├── azure-blob-storage.svg
├── azure-data-lake-gen2.svg
├── azure-cosmos-db.svg
├── azure-sql-database.svg
├── azure-table-storage.svg
├── microsoft-onelake.svg
├── sharepoint.svg
├── onedrive.svg
├── onedrive-business.svg
├── azure-file-storage.svg
├── azure-queues.svg
├── service-bus.svg
├── amazon-s3.svg
├── dropbox.svg
└── sftp-ssh.svg
```

Referenced in frontend as `<img src="/icons/data-sources/azure-blob-storage.svg" />` inside card components.

## Risks / Trade-offs

**[Risk] pyodbc requires ODBC driver installed on host** → Azure SQL test needs the ODBC Driver for SQL Server installed at OS level (not just the Python package). Mitigation: Test function catches the connection error and returns a helpful message mentioning the driver requirement.

**[Risk] Graph API auth for SharePoint/OneDrive is complex** → Requires Azure AD app registration with correct permissions (Sites.Read.All, Files.Read.All). Mitigation: v1 uses client_credentials flow (service principal). Document the required AAD permissions in config field help text.

**[Risk] Many Azure SDK dependencies increase install size** → Adding ~8 Azure packages. Mitigation: Azure SDKs share common dependencies (`azure-core`, `azure-identity`), so the incremental size is moderate (~50MB). This is acceptable for a studio tool.

**[Risk] Test connectivity may be slow for some types** → Cosmos DB or SQL Database connections can take 5-10 seconds. Mitigation: Frontend shows loading spinner on the Test button. Backend has a per-test timeout of 30 seconds.

**[Trade-off] Service principal auth only (no OAuth interactive flow)** → SharePoint/OneDrive users must create an AAD app registration and provide client credentials. This is less user-friendly than OAuth redirect but much simpler to implement and suitable for a developer studio tool.

**[Trade-off] No actual file reading in v1** → Data Source module only validates connectivity and stores config. Actual file enumeration and reading happens at Pipeline execution time. This keeps the scope focused.

## Open Questions

- Should the `connection_config` JSON be encrypted at rest (like Connection's `config`)? The Connection module uses Fernet encryption for secret fields. Data Source has the same need. Recommend: yes, reuse the encryption utility.
- Should we support Azure Managed Identity as an auth option for Azure services (in addition to connection string / account key)? Deferred to future — start with explicit credentials.
