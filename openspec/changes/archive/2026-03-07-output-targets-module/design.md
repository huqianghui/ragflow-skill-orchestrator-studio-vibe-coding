# Output Targets Module — Design

## D1: 7 种 Target 类型分 4 个类别

| 类别 | target_type | 写入语义 | 默认/Extras |
|------|------------|---------|-------------|
| Search | `azure_ai_search` | document batch upsert | 默认 |
| Storage | `azure_blob` | blob upload | 默认 (已安装) |
| Graph | `cosmosdb_gremlin` | Gremlin addV/addE | 默认 |
| Graph | `neo4j` | Cypher CREATE/MERGE | extras `[neo4j]` |
| Relational | `mysql` | INSERT ON DUPLICATE KEY | extras `[mysql]` |
| Relational | `postgresql` | INSERT ON CONFLICT + pgvector | extras `[postgresql]` |

**替代方案**：将 cosmosdb_gremlin 也放入 extras。**拒绝理由**：项目定位 Azure-first，CosmosDB 是核心 Azure 服务。

## D2: Schema Mapping 数据结构

field_mappings JSON 采用统一结构，所有 target 类型共用：

```json
{
  "write_context": "/document/chunks/*",
  "write_mode": "upsert",
  "key_field": { "source": "/document/metadata/id", "target": "id" },
  "mappings": [
    {
      "source": "/document/chunks/*/text",
      "target": "content",
      "target_type": "string"
    },
    {
      "source": "/document/chunks/*/embedding",
      "target": "contentVector",
      "target_type": "vector",
      "vector_config": { "dimensions": 1536, "algorithm": "hnsw" }
    }
  ]
}
```

- `write_context`：决定 Enrichment Tree 的哪个层级变成一条输出记录。`/document` = 一条，`/document/chunks/*` = 每 chunk 一条
- `write_mode`：`upsert` | `insert` | `replace`（对应不同 target 的语义）
- `key_field`：upsert 时的主键映射
- `mappings[].target_type`：string/int/float/boolean/vector/array/json（用于类型转换和验证）
- `mappings[].vector_config`：仅 vector 类型需要，AI Search 和 pgvector 用到

**替代方案**：每种 target 用不同的 mapping 结构。**拒绝理由**：增加前端复杂度，映射引擎难以统一，且大部分语义相通。

## D3: 图数据映射 — graph_mapping 扩展

图类型 target 的 field_mappings 额外包含 `graph_mapping` 段：

```json
{
  "write_context": "/document",
  "graph_mapping": {
    "vertex_source": "/document/entities/*",
    "vertex_id_field": "id",
    "vertex_label_field": "entity_type",
    "vertex_properties": ["name", "description"],
    "edge_source": "/document/relationships/*",
    "edge_label_field": "relation_type",
    "edge_source_id_field": "source_entity_id",
    "edge_target_id_field": "target_entity_id",
    "edge_properties": ["confidence"]
  }
}
```

CosmosDB Gremlin writer 额外处理 partition_key（从 connection_config 读取）。Neo4j writer 转为 Cypher MERGE 语句。

**替代方案**：要求 Pipeline Skill 直接输出标准 `{vertices, edges}` JSON。**拒绝理由**：不够灵活，不同 NER/关系抽取 skill 输出格式各异，mapping 层可适配。

## D4: Azure AI Search 索引管理

流程：
1. 用户输入 endpoint + api_key + index_name
2. `POST /targets/{id}/test` 验证连接
3. `GET /targets/{id}/discover-schema` 检查 index 是否存在
   - 存在 → 返回 index fields schema
   - 不存在 → 返回 `{ exists: false, suggested_schema: [...] }`
4. suggested_schema 从 Pipeline graph_data 推断：
   - 遍历 nodes 收集 output 字段路径
   - 找 TextEmbedder 节点 → model_name → 维度
   - 生成 AI Search field definitions（含 vector search profile）
5. `POST /targets/{id}/create-index` 创建索引

**Vector 维度推断优先级**：
1. field_mappings 中显式指定的 `vector_config.dimensions`
2. Pipeline TextEmbedder 节点的 `config_overrides.dimensions`
3. Pipeline TextEmbedder 节点的 `config_overrides.model_name` → 查表
4. 默认 1536 (text-embedding-ada-002)

常用模型维度表：

| model | dimensions |
|-------|-----------|
| text-embedding-ada-002 | 1536 |
| text-embedding-3-small | 1536 |
| text-embedding-3-large | 3072 |

## D5: Azure Blob 路径模板

connection_config 包含 `output_path_template`，支持变量替换：

```
{pipeline_name}/{source_file}/{date}_{output_name}.{format}
```

可用变量：`{pipeline_name}`, `{pipeline_id}`, `{source_file}`, `{source_ext}`, `{timestamp}`, `{date}`, `{output_name}`, `{index}`

content_format 选项：`json` | `text` | `binary` | `jsonl`

写入时 writer 展开模板，逐个 blob 上传。

## D6: Relational DB upsert + pgvector

MySQL：`INSERT INTO ... ON DUPLICATE KEY UPDATE ...`
PostgreSQL：`INSERT INTO ... ON CONFLICT (key) DO UPDATE SET ...`

pgvector 支持：
- 检测 `vector` 类型映射 → 自动执行 `CREATE EXTENSION IF NOT EXISTS vector`
- 列类型用 `vector(N)` 而非标准 SQL 类型

auto_create_table：如果用户勾选，根据 mappings 自动生成 CREATE TABLE DDL 并执行。

## D7: Writer Service 架构

统一 dispatcher 模式（同 DataSource tester）：

```python
async def write_to_target(target_type, connection_config, field_mappings, data) -> WriteResult
```

每种类型实现独立的 `_write_xxx` 函数，注册到 `_WRITERS` dict。

WriteResult：`{ success: bool, records_written: int, errors: list[str] }`

## D8: 依赖策略

pyproject.toml 新增：

- 默认：`azure-search-documents>=11.4`, `gremlinpython>=3.7`
- extras `[neo4j]`：`neo4j>=5.0`
- extras `[mysql]`：`pymysql>=1.1`
- extras `[postgresql]`：`psycopg2-binary>=2.9`
- extras `[pgvector]`：`psycopg2-binary>=2.9`, `pgvector>=0.2`
- extras `[all-targets]`：以上全部
- 更新 `[all]`：包含 data-source extras + target extras
