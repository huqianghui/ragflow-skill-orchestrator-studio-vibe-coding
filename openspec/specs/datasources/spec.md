# Data Sources Module Specification

## Purpose

管理 Pipeline 输入数据来源，对齐 Azure AI Search "Import data (new)" 体验。支持 16 种数据源类型，分 3 个类别。

## Data Model

DataSource 字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v4 string PK | 主键 |
| name | String(255) | 显示名称 |
| description | Text, nullable | 描述 |
| source_type | String(50) | 16 种类型之一 |
| connection_config | JSON | 类型相关配置 |
| status | String(20) | active / inactive / error，默认 active |
| file_count | int | 文件数，默认 0 |
| total_size | int | 总大小 bytes，默认 0 |
| pipeline_id | FK → pipelines.id, nullable | 关联 Pipeline |
| created_at / updated_at | datetime | 时间戳 |

## 16 种数据源类型

| 分类 | source_type | 显示名 | 安装方式 |
|------|------------|--------|----------|
| Local | `local_upload` | Local File Upload | 默认 |
| Built-in indexer | `azure_blob` | Azure Blob Storage | 默认 |
| Built-in indexer | `azure_adls_gen2` | Azure Data Lake Storage Gen2 | 默认 |
| Built-in indexer | `azure_cosmos_db` | Azure Cosmos DB | 默认 |
| Built-in indexer | `azure_sql` | Azure SQL Database | 默认 |
| Built-in indexer | `azure_table` | Azure Table Storage | 默认 |
| Built-in indexer | `microsoft_onelake` | Microsoft OneLake | 默认 |
| Logic Apps connector | `sharepoint` | SharePoint | 默认 |
| Logic Apps connector | `onedrive` | OneDrive | 默认 |
| Logic Apps connector | `onedrive_business` | OneDrive for Business | 默认 |
| Logic Apps connector | `azure_file_storage` | Azure File Storage | 默认 |
| Logic Apps connector | `azure_queues` | Azure Queues | 默认 |
| Logic Apps connector | `service_bus` | Service Bus | 默认 |
| Logic Apps connector | `amazon_s3` | Amazon S3 | `pip install '.[aws]'` |
| Logic Apps connector | `dropbox` | Dropbox | `pip install '.[dropbox]'` |
| Logic Apps connector | `sftp_ssh` | SFTP - SSH | `pip install '.[sftp]'` |

## Per-Type Config Fields

每种类型的 `connection_config` 字段定义（标记 `*` 为必填，`🔒` 为 secret）：

**azure_blob**: `connection_string`*🔒, `container_name`*, `path_prefix`
**azure_adls_gen2**: `account_name`*, `account_key`*🔒, `filesystem`*, `path_prefix`
**azure_cosmos_db**: `connection_string`*🔒, `database`*, `container`*, `query`
**azure_sql**: `connection_string`*🔒, `table_or_view`*, `query`
**azure_table**: `connection_string`*🔒, `table_name`*
**microsoft_onelake**: `tenant_id`*, `client_id`*, `client_secret`*🔒, `workspace_id`*, `lakehouse_id`*, `path_prefix`
**sharepoint**: `site_url`*, `tenant_id`*, `client_id`*, `client_secret`*🔒, `document_library`, `folder_path`
**onedrive**: `tenant_id`*, `client_id`*, `client_secret`*🔒, `drive_id`, `folder_path`
**onedrive_business**: `tenant_id`*, `client_id`*, `client_secret`*🔒, `user_email`*, `folder_path`
**azure_file_storage**: `connection_string`*🔒, `share_name`*, `directory_path`
**azure_queues**: `connection_string`*🔒, `queue_name`*
**service_bus**: `connection_string`*🔒, `queue_or_topic`*, `subscription`
**amazon_s3**: `access_key_id`*🔒, `secret_access_key`*🔒, `bucket_name`*, `region`*, `path_prefix`
**dropbox**: `access_token`*🔒, `folder_path`
**sftp_ssh**: `host`*, `port`(默认22), `username`*, `auth_method`*(password|private_key), `password`🔒, `private_key`🔒, `remote_path`*

## Secret 掩码

- API 返回 `connection_config` 时，secret 字段被掩码：长度 > 8 → `前4位****后4位`；长度 ≤ 8 → `****`
- PUT 更新时，字段值为空或包含 `****` 则保留数据库原值

## CRUD API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/data-sources | 创建数据源，返回 201 |
| GET | /api/v1/data-sources?page=&page_size= | 分页列表（created_at DESC），config 已脱敏 |
| GET | /api/v1/data-sources/{id} | 详情（config 已脱敏），404 if 不存在 |
| PUT | /api/v1/data-sources/{id} | 更新 name/description/connection_config/status/pipeline_id |
| DELETE | /api/v1/data-sources/{id} | 删除，返回 204；local_upload 同时清理上传文件 |

## 连通性测试

**POST /api/v1/data-sources/{id}/test** → `{ success: bool, message: string }`

| 类型 | 测试方法 |
|------|----------|
| local_upload | 检查临时目录存在且可写 |
| azure_blob | BlobServiceClient → get_container_properties |
| azure_adls_gen2 | DataLakeServiceClient → get_file_system_properties |
| azure_cosmos_db | CosmosClient → read database |
| azure_sql | pyodbc → SELECT 1 |
| azure_table | TableServiceClient → query_entities(top=1) |
| microsoft_onelake | httpx + ClientSecretCredential → list files |
| sharepoint / onedrive / onedrive_business | Graph API (AAD token) |
| azure_file_storage | ShareServiceClient → get_share_properties |
| azure_queues | QueueServiceClient → get_queue_properties |
| service_bus | ServiceBusClient → get_queue_runtime_properties |
| amazon_s3 | boto3 → list_objects_v2 |
| dropbox | dropbox SDK → users_get_current_account |
| sftp_ssh | paramiko → SFTP listdir |

- 超时 30 秒自动失败
- extras 未安装时返回 `pip install '.[aws]'` 等提示

## 本地文件上传

**POST /api/v1/data-sources/upload** (multipart: `file` + `data_source_id`)

- 存储路径：`{upload_temp_dir}/{ds_id}/{filename}`
- 路径遍历防护：`Path(filename).name` 清洗
- 文件大小限制：单文件 ≤ `max_upload_size_mb` (默认 100 MB)
- 总配额限制：累计 ≤ `upload_total_quota_mb` (默认 1024 MB)
- 上传后更新 DataSource 的 file_count 和 total_size
- 支持格式：PDF, DOCX, DOC, TXT, MD, CSV, HTML, PNG, JPG, JPEG, TIFF, JSON, JSONL, XLSX, XLS

**GET /api/v1/data-sources/upload-quota** → `UploadQuotaInfo`

```json
{ "total_mb": 1024, "used_mb": 150.5, "available_mb": 873.5,
  "retention_days": 7, "max_file_size_mb": 100, "temp_dir": "./data/uploads/tmp" }
```

**过期清理**：应用启动时扫描 upload_temp_dir，删除修改时间超过 `cleanup_retention_days` 的文件及空目录。

## 依赖策略

- **默认安装**：azure-storage-blob, azure-storage-file-datalake, azure-cosmos, azure-data-tables, azure-storage-file-share, azure-storage-queue, azure-servicebus, azure-identity, pyodbc, httpx
- **Extras**：`[aws]` → boto3, `[dropbox]` → dropbox, `[sftp]` → paramiko, `[all]` → 全部

## 前端页面

### 类型选择器 — /data-sources/new

- 16 张卡片按 3 类分组（Local / Built-in indexer / Logic Apps connector）
- 每卡片：SVG 图标 (48x48) + 名称 + 分类标签
- 搜索过滤（大小写不敏感），空分组自动隐藏
- 点击卡片 → 弹出配置 Modal

**配置 Modal（非 local_upload）**：Name*、Description、分隔线"Connection"、类型专属字段（secret 用 password）、Cancel / Test / Create

**上传 Modal（local_upload）**：Name*、Description、Upload.Dragger 拖放区、配额 Progress bar、Cancel / Upload & Create

### 列表页 — /data-sources

表格列：Name (可点击编辑) / Type (icon+Tag) / Status (colored Tag) / Files / Size (formatted) / Created At / Actions

Actions：Test (loading) / Edit (Modal, source_type disabled, secret placeholder) / Delete (Popconfirm)

"New Data Source" 按钮 → /data-sources/new

### Settings 页 — Upload Storage 区域

显示：Temp Directory、Max File Size、Total/Used/Available (MB)、Retention (days)、Progress bar（green <70%, yellow 70-90%, red >90%）

### SVG 图标

16 个文件位于 `frontend/public/icons/data-sources/`，kebab-case 命名。卡片中 48x48，列表中 20x20。

### 路由

`/data-sources/new` → DataSourceNew（置于 `/data-sources` 之前）
`/data-sources` → DataSources
