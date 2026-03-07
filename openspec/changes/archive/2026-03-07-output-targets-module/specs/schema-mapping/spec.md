# Schema Mapping Specification

## Purpose

定义 Pipeline Enrichment Tree 输出到 Target schema 的字段映射引擎，包括映射数据结构、自动建议、验证规则和图数据特殊映射。

### Requirement: 统一映射结构

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

#### Scenario: write_context 决定记录粒度

- `write_context: "/document"` → 整个 document 生成一条输出记录
- `write_context: "/document/chunks/*"` → 每个 chunk 生成一条输出记录
- write_context 中的 `*` 展开为数组索引，与 Pipeline context 概念一致

#### Scenario: write_mode

| write_mode | AI Search | Graph | Relational | Blob |
|-----------|-----------|-------|------------|------|
| upsert | merge_or_upload | MERGE vertex/edge | ON CONFLICT UPDATE | overwrite blob |
| insert | upload (fail on dup) | CREATE | INSERT (fail on dup) | create blob |
| replace | delete + upload | DROP + CREATE | TRUNCATE + INSERT | overwrite blob |

#### Scenario: target_type 字段类型

支持的类型：`string`, `int`, `float`, `boolean`, `datetime`, `array`, `json`, `vector`

`vector` 类型额外携带 `vector_config`：
- `dimensions`：向量维度（必填）
- `algorithm`：`hnsw` | `eknn`（仅 AI Search，默认 hnsw）
- `metric`：`cosine` | `euclidean` | `dotProduct`（默认 cosine）

### Requirement: 图数据映射

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

#### Scenario: CosmosDB Gremlin 转译

- vertex → `g.addV(label).property('pk', partition_value).property(k, v)...`
- edge → `g.V(source_id).addE(label).to(g.V(target_id)).property(k, v)...`
- partition_key 从 connection_config 读取，自动注入到每个 vertex 的 properties

#### Scenario: Neo4j 转译

- vertex → `MERGE (n:Label {id: $id}) SET n.name = $name, ...`
- edge → `MATCH (a {id: $src}), (b {id: $tgt}) MERGE (a)-[r:LABEL]->(b) SET r.weight = $weight`

### Requirement: Pipeline 输出字段推断

从 Pipeline graph_data 推断可用输出字段，用于 mapping UI 左侧列表。

#### Scenario: 推断逻辑

- 遍历 Pipeline graph_data.nodes（按 position 排序）
- 每个 node 的 outputs 产出路径 = `{context}/{targetName}`
- 如果 context 含 `*`，输出路径也含 `*`（如 `/document/chunks/*/embedding`）
- 初始可用路径：`/document/file_content`, `/document/file_name`

#### Scenario: 推断结果结构

```json
[
  { "path": "/document/content", "type": "string", "from_skill": "DocumentCracker" },
  { "path": "/document/chunks/*/text", "type": "string", "from_skill": "TextSplitter" },
  { "path": "/document/chunks/*/embedding", "type": "vector", "from_skill": "TextEmbedder",
    "vector_hint": { "model": "text-embedding-ada-002", "dimensions": 1536 } }
]
```

### Requirement: 自动建议映射

#### Scenario: 名称匹配

- Pipeline 输出字段名（path 最后一段）与 Target schema 字段名完全匹配 → 自动映射
- 近似匹配（忽略大小写、下划线/驼峰转换）→ 建议映射

#### Scenario: 类型兼容检查

- string → string/text/varchar/nvarchar ✓
- vector → Collection(Edm.Single) / vector(N) ✓
- array → Collection(Edm.String) ✓
- int → int/bigint/Edm.Int32/Edm.Int64 ✓
- 不兼容时标记警告

### Requirement: 映射验证

POST /api/v1/targets/{id}/validate-mapping → `{ valid: bool, errors: [...], warnings: [...] }`

#### Scenario: 验证规则

- key_field 必须映射（upsert/replace 模式下）
- 所有 source 路径必须在 Pipeline 输出中可达
- vector 字段必须指定 dimensions
- 目标必填字段都有 source 映射
- target_type 与目标 schema 类型兼容

### Requirement: Azure Blob 路径模板

azure_blob 类型不使用 schema mapping，而使用路径模板：

```json
{
  "write_context": "/document/chunks/*",
  "output_path_template": "{pipeline_name}/{source_file}/{date}_{index}.json",
  "content_format": "json"
}
```

可用变量：`{pipeline_name}`, `{pipeline_id}`, `{source_file}`, `{source_ext}`, `{timestamp}`, `{date}`, `{output_name}`, `{index}`

content_format：`json` | `text` | `binary` | `jsonl`
