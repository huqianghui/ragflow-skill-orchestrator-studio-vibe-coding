# Target Connectors Specification

## Purpose

定义 7 种 Output Target 类型的连接配置、Secret 掩码、连通性测试、Schema Discovery 和 Writer 实现。

### Requirement: 7 种 Target 类型

| 类别 | target_type | 显示名 |
|------|------------|--------|
| Search | `azure_ai_search` | Azure AI Search |
| Storage | `azure_blob` | Azure Blob Storage |
| Graph | `cosmosdb_gremlin` | CosmosDB (Gremlin) |
| Graph | `neo4j` | Neo4j |
| Relational | `mysql` | MySQL |
| Relational | `postgresql` | PostgreSQL |

### Requirement: Per-Type Config Fields

**azure_ai_search**: `endpoint`*, `api_key`*🔒, `index_name`*
**azure_blob**: `connection_string`*🔒, `container_name`*, `output_path_template`, `content_format`(默认 json)
**cosmosdb_gremlin**: `endpoint`*, `primary_key`*🔒, `database`*, `graph`*, `partition_key`*
**neo4j**: `uri`*, `username`*, `password`*🔒, `database`(默认 neo4j)
**mysql**: `host`*, `port`(默认 3306), `username`*, `password`*🔒, `database`*, `table_name`*
**postgresql**: `host`*, `port`(默认 5432), `username`*, `password`*🔒, `database`*, `schema_name`(默认 public), `table_name`*

### Requirement: Secret 掩码

复用 DataSource 的 `mask_secret()` / `mask_config()` 模式。

SECRET_FIELDS：

| target_type | secret 字段 |
|-------------|------------|
| azure_ai_search | api_key |
| azure_blob | connection_string |
| cosmosdb_gremlin | primary_key |
| neo4j | password |
| mysql | password |
| postgresql | password |

### Requirement: 连通性测试

POST /api/v1/targets/{id}/test → `{ success: bool, message: string }`

| target_type | 测试方法 |
|-------------|---------|
| azure_ai_search | SearchIndexClient → list_index_names() |
| azure_blob | BlobServiceClient → get_container_properties() |
| cosmosdb_gremlin | Gremlin client → g.V().limit(1) |
| neo4j | Neo4j driver → session.run("RETURN 1") |
| mysql | pymysql → connect + SELECT 1 |
| postgresql | psycopg2 → connect + SELECT 1 |

超时 30 秒。extras 未安装时返回友好提示。

### Requirement: Schema Discovery

GET /api/v1/targets/{id}/discover-schema → `{ exists: bool, schema: [...], suggested_schema: [...] | null }`

| target_type | 发现方式 | 返回内容 |
|-------------|---------|---------|
| azure_ai_search | SearchIndexClient.get_index(name) | index fields (name, type, searchable, filterable, vector config) |
| azure_blob | N/A (无 schema) | `{ exists: true, schema: null }` |
| cosmosdb_gremlin | g.V().label().dedup() + properties | vertex labels + property keys (近似) |
| neo4j | CALL db.labels() + db.schema.nodeTypeProperties() | node labels + property types |
| mysql | DESCRIBE table_name | columns (name, type, nullable, key) |
| postgresql | information_schema.columns | columns (name, data_type, is_nullable, column_default) |

azure_ai_search 特殊：index 不存在时 `exists: false`，且如果 Target 绑定了 pipeline_id，从 Pipeline graph_data 推断 `suggested_schema`。

### Requirement: Azure AI Search 索引管理

POST /api/v1/targets/{id}/create-index

- body: `{ index_definition: {...} }` 或空 body（使用 suggested_schema）
- 调用 SearchIndexClient.create_index()
- 索引包含 vector search profile (HNSW)，dimensions 从以下优先级推断：
  1. field_mappings 中 vector_config.dimensions
  2. Pipeline TextEmbedder 节点 config_overrides.dimensions
  3. Pipeline TextEmbedder 节点 config_overrides.model_name → 查表
  4. 默认 1536

### Requirement: Writer Services

每种类型实现异步 writer 函数，注册到 `_WRITERS` dispatcher dict。

```
async def write_to_target(target_type, config, field_mappings, records) -> WriteResult
```

WriteResult: `{ success: bool, records_written: int, errors: list[str] }`

| target_type | 写入方式 |
|-------------|---------|
| azure_ai_search | SearchClient.merge_or_upload_documents (batch ≤ 1000) |
| azure_blob | BlobClient.upload_blob (逐个，路径模板展开) |
| cosmosdb_gremlin | Gremlin client: addV/addE (逐条 traversal) |
| neo4j | Neo4j session: Cypher MERGE (batch transaction) |
| mysql | pymysql: INSERT ... ON DUPLICATE KEY UPDATE (batch) |
| postgresql | psycopg2: INSERT ... ON CONFLICT DO UPDATE (batch) |

### Requirement: 依赖管理

默认：azure-search-documents>=11.4, gremlinpython>=3.7
extras `[neo4j]`：neo4j>=5.0
extras `[mysql]`：pymysql>=1.1
extras `[postgresql]`：psycopg2-binary>=2.9
extras `[pgvector]`：psycopg2-binary>=2.9, pgvector>=0.2
extras `[all-targets]`：全部
更新 `[all]`：包含 data-source extras + all-targets
