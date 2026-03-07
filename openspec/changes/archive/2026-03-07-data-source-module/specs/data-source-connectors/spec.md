# Data Source Connectors Specification

## Purpose

定义 16 种数据源类型的配置字段、Secret 掩码规则、连通性测试逻辑和依赖管理策略。

### Requirement: 16 种数据源类型

#### Scenario: Source Type 枚举

- **GIVEN** 数据源模块
- **THEN** 支持以下 16 种 `source_type`:

| 分类 | source_type | 显示名 |
|------|------------|--------|
| Local | `local_upload` | Local File Upload |
| Built-in indexer | `azure_blob` | Azure Blob Storage |
| Built-in indexer | `azure_adls_gen2` | Azure Data Lake Storage Gen2 |
| Built-in indexer | `azure_cosmos_db` | Azure Cosmos DB |
| Built-in indexer | `azure_sql` | Azure SQL Database |
| Built-in indexer | `azure_table` | Azure Table Storage |
| Built-in indexer | `microsoft_onelake` | Microsoft OneLake |
| Logic Apps connector | `sharepoint` | SharePoint |
| Logic Apps connector | `onedrive` | OneDrive |
| Logic Apps connector | `onedrive_business` | OneDrive for Business |
| Logic Apps connector | `azure_file_storage` | Azure File Storage |
| Logic Apps connector | `azure_queues` | Azure Queues |
| Logic Apps connector | `service_bus` | Service Bus |
| Logic Apps connector | `amazon_s3` | Amazon S3 |
| Logic Apps connector | `dropbox` | Dropbox |
| Logic Apps connector | `sftp_ssh` | SFTP - SSH |

### Requirement: Per-Type Config Fields

#### Scenario: Azure Blob Storage 配置

- **WHEN** source_type = `azure_blob`
- **THEN** `connection_config` 需包含:
  - `connection_string` (必填, secret)
  - `container_name` (必填)
  - `path_prefix` (可选)

#### Scenario: Azure Data Lake Storage Gen2 配置

- **WHEN** source_type = `azure_adls_gen2`
- **THEN** `connection_config` 需包含:
  - `account_name` (必填)
  - `account_key` (必填, secret)
  - `filesystem` (必填)
  - `path_prefix` (可选)

#### Scenario: Azure Cosmos DB 配置

- **WHEN** source_type = `azure_cosmos_db`
- **THEN** `connection_config` 需包含:
  - `connection_string` (必填, secret)
  - `database` (必填)
  - `container` (必填)
  - `query` (可选)

#### Scenario: Azure SQL Database 配置

- **WHEN** source_type = `azure_sql`
- **THEN** `connection_config` 需包含:
  - `connection_string` (必填, secret)
  - `table_or_view` (必填)
  - `query` (可选)

#### Scenario: Azure Table Storage 配置

- **WHEN** source_type = `azure_table`
- **THEN** `connection_config` 需包含:
  - `connection_string` (必填, secret)
  - `table_name` (必填)

#### Scenario: Microsoft OneLake 配置

- **WHEN** source_type = `microsoft_onelake`
- **THEN** `connection_config` 需包含:
  - `tenant_id` (必填)
  - `client_id` (必填)
  - `client_secret` (必填, secret)
  - `workspace_id` (必填)
  - `lakehouse_id` (必填)
  - `path_prefix` (可选)

#### Scenario: SharePoint 配置

- **WHEN** source_type = `sharepoint`
- **THEN** `connection_config` 需包含:
  - `site_url` (必填)
  - `tenant_id` (必填)
  - `client_id` (必填)
  - `client_secret` (必填, secret)
  - `document_library` (可选)
  - `folder_path` (可选)

#### Scenario: OneDrive 配置

- **WHEN** source_type = `onedrive`
- **THEN** `connection_config` 需包含:
  - `tenant_id` (必填)
  - `client_id` (必填)
  - `client_secret` (必填, secret)
  - `drive_id` (可选)
  - `folder_path` (可选)

#### Scenario: OneDrive for Business 配置

- **WHEN** source_type = `onedrive_business`
- **THEN** `connection_config` 需包含:
  - `tenant_id` (必填)
  - `client_id` (必填)
  - `client_secret` (必填, secret)
  - `user_email` (必填)
  - `folder_path` (可选)

#### Scenario: Azure File Storage 配置

- **WHEN** source_type = `azure_file_storage`
- **THEN** `connection_config` 需包含:
  - `connection_string` (必填, secret)
  - `share_name` (必填)
  - `directory_path` (可选)

#### Scenario: Azure Queues 配置

- **WHEN** source_type = `azure_queues`
- **THEN** `connection_config` 需包含:
  - `connection_string` (必填, secret)
  - `queue_name` (必填)

#### Scenario: Service Bus 配置

- **WHEN** source_type = `service_bus`
- **THEN** `connection_config` 需包含:
  - `connection_string` (必填, secret)
  - `queue_or_topic` (必填)
  - `subscription` (可选)

#### Scenario: Amazon S3 配置

- **WHEN** source_type = `amazon_s3`
- **THEN** `connection_config` 需包含:
  - `access_key_id` (必填, secret)
  - `secret_access_key` (必填, secret)
  - `bucket_name` (必填)
  - `region` (必填)
  - `path_prefix` (可选)

#### Scenario: Dropbox 配置

- **WHEN** source_type = `dropbox`
- **THEN** `connection_config` 需包含:
  - `access_token` (必填, secret)
  - `folder_path` (可选)

#### Scenario: SFTP - SSH 配置

- **WHEN** source_type = `sftp_ssh`
- **THEN** `connection_config` 需包含:
  - `host` (必填)
  - `port` (可选, 默认 22)
  - `username` (必填)
  - `auth_method` (必填, password | private_key)
  - `password` (条件必填, secret)
  - `private_key` (条件必填, secret)
  - `remote_path` (必填)

### Requirement: Secret 掩码

#### Scenario: API 返回掩码后的 config

- **WHEN** GET /api/v1/data-sources 或 GET /api/v1/data-sources/{id}
- **THEN** `connection_config` 中的 secret 字段被掩码处理
- **AND** 掩码格式: 长度 > 8 → `前4位****后4位`; 长度 ≤ 8 → `****`

#### Scenario: 更新时保留旧 secret

- **WHEN** PUT /api/v1/data-sources/{id}
- **AND** secret 字段为空或包含 `****`
- **THEN** 保留数据库中原有值，不覆盖

### Requirement: 连通性测试

#### Scenario: 测试成功

- **WHEN** POST /api/v1/data-sources/{id}/test
- **AND** 凭证有效且目标资源可访问
- **THEN** 返回 `{ "success": true, "message": "Connected successfully to container 'documents'" }`

#### Scenario: 测试失败 — 凭证无效

- **WHEN** POST /api/v1/data-sources/{id}/test
- **AND** 凭证无效
- **THEN** 返回 `{ "success": false, "message": "Authentication failed: Invalid connection string" }`

#### Scenario: 测试失败 — SDK 未安装

- **WHEN** POST /api/v1/data-sources/{id}/test
- **AND** source_type 为 `amazon_s3` 但 boto3 未安装
- **THEN** 返回 `{ "success": false, "message": "Amazon S3 requires extra dependencies: pip install '.[aws]'" }`

#### Scenario: 测试超时

- **WHEN** POST /api/v1/data-sources/{id}/test
- **AND** 连接超过 30 秒未响应
- **THEN** 返回 `{ "success": false, "message": "Connection timed out after 30 seconds" }`

### Requirement: 依赖管理

#### Scenario: 默认安装包含 Azure SDK

- **GIVEN** `pip install .`
- **THEN** 包含: azure-storage-blob, azure-storage-file-datalake, azure-cosmos, azure-data-tables, azure-storage-file-share, azure-storage-queue, azure-servicebus, azure-identity, pyodbc, httpx

#### Scenario: Extras 安装

- **GIVEN** `pip install '.[aws]'` → 包含 boto3
- **GIVEN** `pip install '.[dropbox]'` → 包含 dropbox
- **GIVEN** `pip install '.[sftp]'` → 包含 paramiko
- **GIVEN** `pip install '.[all]'` → 包含 boto3 + dropbox + paramiko
