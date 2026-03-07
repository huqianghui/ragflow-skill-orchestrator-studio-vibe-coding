# Output Targets Module Specification

## Purpose

输出目标模块负责管理 Pipeline 处理完成后的数据写入目标。支持 6 种目标类型，涵盖搜索、存储、图数据库和关系型数据库。提供连通性测试、Schema 发现、字段映射引擎和写入服务。

## Data Model

Target 字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v4 string PK | 主键 |
| name | String(255) | 显示名称 |
| description | Text, nullable | 描述 |
| target_type | String(50) | 6 种类型之一 |
| connection_config | JSON | 类型相关连接配置 |
| field_mappings | JSON | 字段映射配置 |
| status | String(20) | active / inactive / error，默认 active |
| pipeline_id | FK → pipelines.id, nullable | 关联 Pipeline |
| created_at / updated_at | datetime | 时间戳 |

## 6 种 Target 类型

| 类别 | target_type | 显示名 | 安装方式 |
|------|------------|--------|----------|
| Search | `azure_ai_search` | Azure AI Search | 默认 |
| Storage | `azure_blob` | Azure Blob Storage | 默认 |
| Graph DB | `cosmosdb_gremlin` | CosmosDB (Gremlin) | 默认 |
| Graph DB | `neo4j` | Neo4j | `pip install '.[neo4j]'` |
| Relational DB | `mysql` | MySQL | `pip install '.[mysql]'` |
| Relational DB | `postgresql` | PostgreSQL | `pip install '.[postgresql]'` |

## Per-Type Config Fields

每种类型的 `connection_config` 字段定义（标记 `*` 为必填，`🔒` 为 secret）：

**azure_ai_search**: `endpoint`*, `api_key`*🔒, `index_name`
**azure_blob**: `connection_string`*🔒, `container_name`*, `output_path_template`, `content_format`(默认 json)
**cosmosdb_gremlin**: `endpoint`*, `primary_key`*🔒, `database`*, `graph`*, `partition_key`*
**neo4j**: `uri`*, `username`*, `password`*🔒, `database`(默认 neo4j)
**mysql**: `host`*, `port`(默认 3306), `username`*, `password`*🔒, `database`*, `table_name`*
**postgresql**: `host`*, `port`(默认 5432), `username`*, `password`*🔒, `database`*, `schema_name`(默认 public), `table_name`*

## Secret 掩码

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

- API 返回 `connection_config` 时，secret 字段被掩码：长度 > 8 → `前4位****后4位`；长度 ≤ 8 → `****`
- PUT 更新时，字段值为空或包含 `****` 则保留数据库原值

## CRUD API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/targets | 创建 Target，返回 201 |
| GET | /api/v1/targets?page=&page_size= | 分页列表（created_at DESC），config 已脱敏 |
| GET | /api/v1/targets/{id} | 详情（config 已脱敏），404 if 不存在 |
| PUT | /api/v1/targets/{id} | 更新 name/description/connection_config/field_mappings/status/pipeline_id |
| DELETE | /api/v1/targets/{id} | 删除，返回 204 |

## 连通性测试

**POST /api/v1/targets/{id}/test** → `{ success: bool, message: string }`

| target_type | 测试方法 |
|-------------|---------|
| azure_ai_search | SearchIndexClient → list_index_names() |
| azure_blob | BlobServiceClient → get_container_properties() |
| cosmosdb_gremlin | Gremlin client → g.V().limit(1) |
| neo4j | Neo4j driver → session.run("RETURN 1") |
| mysql | pymysql → connect + SELECT 1 |
| postgresql | psycopg2 → connect + SELECT 1 |

- 超时 30 秒自动失败
- extras 未安装时返回友好提示（如 `pip install '.[neo4j]'`）

## Schema Discovery

**GET /api/v1/targets/{id}/discover-schema** → `{ exists: bool, schema_fields: [...], suggested_schema: [...] | null }`

| target_type | 发现方式 | 返回内容 |
|-------------|---------|---------|
| azure_ai_search | SearchIndexClient.get_index(name) | index fields (name, type, searchable, filterable, vector config) |
| azure_blob | N/A（无 schema） | `{ exists: true, schema_fields: null }` |
| cosmosdb_gremlin | g.V().label().dedup() + properties | vertex labels + property keys（近似） |
| neo4j | CALL db.labels() + db.schema.nodeTypeProperties() | node labels + property types |
| mysql | DESCRIBE table_name | columns (name, type, nullable, key) |
| postgresql | information_schema.columns | columns (name, data_type, is_nullable, column_default) |

azure_ai_search 特殊：index 不存在时 `exists: false`，且如果 Target 绑定了 pipeline_id，从 Pipeline graph_data 推断 `suggested_schema`。

## Azure AI Search 索引管理

**POST /api/v1/targets/{id}/create-index**

- body: `{ index_definition: {...} }` 或空 body（使用 suggested_schema）
- 调用 SearchIndexClient.create_index()
- 索引包含 vector search profile (HNSW)，dimensions 从以下优先级推断：
  1. field_mappings 中 vector_config.dimensions
  2. Pipeline TextEmbedder 节点 config_overrides.dimensions
  3. Pipeline TextEmbedder 节点 config_overrides.model_name → 查表
  4. 默认 1536

## Schema Mapping Engine

### 统一映射结构

所有 target 类型共用 `field_mappings` JSON 格式：

```json
{
  "write_context": "/document/chunks/*",
  "write_mode": "upsert",
  "key_field": { "source": "/document/metadata/id", "target": "id" },
  "mappings": [
    { "source": "/document/chunks/*/text", "target": "content", "target_type": "string" },
    { "source": "/document/chunks/*/embedding", "target": "contentVector",
      "target_type": "vector", "vector_config": { "dimensions": 1536, "algorithm": "hnsw" } }
  ]
}
```

- `write_context: "/document"` → 整个 document 生成一条输出记录
- `write_context: "/document/chunks/*"` → 每个 chunk 生成一条输出记录
- write_mode: upsert / insert / replace

### Pipeline 输出字段推断

**GET /api/v1/targets/{id}/pipeline-outputs?pipeline_id=X** → `{ outputs: [...] }`

从 Pipeline graph_data 推断可用输出字段，用于 mapping UI 左侧列表。

### 自动建议映射

Pipeline 输出字段名与 Target schema 字段名匹配（精确匹配 + 大小写忽略 + camelCase↔snake_case 转换）+ 类型兼容性检查。

### 映射验证

**POST /api/v1/targets/{id}/validate-mapping** → `{ valid: bool, errors: [...], warnings: [...] }`

验证规则：
- key_field 必须映射（upsert/replace 模式下）
- 所有 source 路径必须在 Pipeline 输出中可达
- vector 字段必须指定 dimensions
- 目标必填字段都有 source 映射
- target_type 与目标 schema 类型兼容

### 图数据映射

图类型 target (cosmosdb_gremlin, neo4j) 的 field_mappings 额外包含 `graph_mapping`：

```json
{
  "graph_mapping": {
    "vertex_source": "/document/entities/*",
    "vertex_id_field": "id",
    "vertex_label_field": "entity_type",
    "vertex_properties": ["name", "description", "confidence"],
    "edge_source": "/document/relationships/*",
    "edge_label_field": "relation_type",
    "edge_source_id_field": "source_entity_id",
    "edge_target_id_field": "target_entity_id",
    "edge_properties": ["weight", "evidence"]
  }
}
```

### Azure Blob 路径模板

azure_blob 类型不使用 schema mapping，而使用路径模板：

可用变量：`{pipeline_name}`, `{pipeline_id}`, `{source_file}`, `{source_ext}`, `{timestamp}`, `{date}`, `{output_name}`, `{index}`

content_format：`json` | `text` | `binary` | `jsonl`

## Writer Services

**POST /api/v1/targets/{id}/write** → `{ success: bool, records_written: int, errors: [...] }`

每种类型实现异步 writer 函数，注册到 `_WRITERS` dispatcher dict。

| target_type | 写入方式 |
|-------------|---------|
| azure_ai_search | SearchClient.merge_or_upload_documents (batch ≤ 1000) |
| azure_blob | BlobClient.upload_blob（逐个，路径模板展开） |
| cosmosdb_gremlin | Gremlin client: addV/addE（逐条 traversal） |
| neo4j | Neo4j session: Cypher MERGE（batch transaction） |
| mysql | pymysql: INSERT ... ON DUPLICATE KEY UPDATE（batch） |
| postgresql | psycopg2: INSERT ... ON CONFLICT DO UPDATE（batch） |

## 依赖管理

- **默认安装**：azure-search-documents>=11.4, gremlinpython>=3.7
- **Extras**：
  - `[neo4j]` → neo4j>=5.0
  - `[mysql]` → pymysql>=1.1
  - `[postgresql]` → psycopg2-binary>=2.9
  - `[pgvector]` → psycopg2-binary>=2.9, pgvector>=0.2
  - `[all-targets]` → 全部
- 更新 `[all]`：包含 data-source extras + all-targets

## 前端页面

### 类型选择器 — /targets/new

- 6 张卡片按 4 类分组（Search / Storage / Graph DB / Relational DB）
- 每卡片：SVG 图标 (48×48) + 目标名称 + 类别标签
- 搜索过滤（大小写不敏感），空分组自动隐藏
- 点击卡片 → 弹出多步配置 Modal

**配置 Modal — Step 1: Connection**：Name*、Description、Pipeline 下拉选择（可选）、分隔线"Connection"、类型专属字段（secret 用 password）、Cancel / Test / Next

**配置 Modal — Step 2: Mapping**：
- Search/Relational: 两列 Schema Mapping UI（左侧 Pipeline 输出、右侧 Target Schema、中间映射行）
- Graph: 图映射表单说明
- Blob: 路径模板配置说明
- AI Search 索引不存在时提供 "Create Index" 按钮

### 列表页 — /targets

表格列：Name / Type (icon+Tag) / Status (colored Tag) / Created At / Actions

Actions：Test (loading) / Delete (Popconfirm)

"New Target" 按钮 → /targets/new

### SVG 图标

6 个文件位于 `frontend/public/icons/targets/`，kebab-case 命名：
azure-ai-search.svg, azure-blob-storage.svg, cosmosdb-gremlin.svg, neo4j.svg, mysql.svg, postgresql.svg

### 路由

`/targets/new` → TargetNew（置于 `/targets` 之前）
`/targets` → Targets
