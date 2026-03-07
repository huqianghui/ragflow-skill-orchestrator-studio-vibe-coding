# Output Targets Module — Change Proposal

## 概述

将 Output Targets 模块从 Phase 1 占位状态升级为完整功能模块。对齐 Azure AI Search Indexer 的输出目标能力，支持 7 种目标类型写入，包括搜索索引、Blob 存储、图数据库和关系型数据库。核心增量是 **Schema Mapping 引擎**——将 Pipeline Enrichment Tree 输出映射到不同目标的 schema。

## 动机

Pipeline 执行完成后，Enrichment Tree 中的数据需要写入外部存储才能被下游系统消费。当前 Target 模块仅有 CRUD 占位，无法实际连接、发现 schema 或写入数据。本次变更填补从"数据处理"到"数据落地"的最后一环。

## 范围

### 包含

1. **7 种 Target 类型**：azure_ai_search, azure_blob, cosmosdb_gremlin, neo4j, mysql, postgresql + azure_blob (作为输出)
2. **Per-type 连接配置 + Secret 掩码**（复用 DataSource 模式）
3. **连通性测试**（复用 DataSource dispatcher 模式）
4. **Schema Discovery**：自动发现目标 schema（AI Search index fields、DB table columns）
5. **Azure AI Search 索引管理**：检查/自动创建索引，vector field 维度从 Pipeline TextEmbedder 推断
6. **Schema Mapping Engine**：Pipeline 输出字段 → Target schema 字段映射，含自动建议、验证
7. **统一图数据格式**：CosmosDB Gremlin 和 Neo4j 共用 vertices/edges 标准结构
8. **Azure Blob 路径模板**：支持变量替换的输出路径命名
9. **Relational DB**：MySQL/PostgreSQL 表级 upsert，PostgreSQL 额外支持 pgvector
10. **Writer Services**：Per-type 异步写入实现（本次实现基础写入，生产级批量/重试留 Phase 2）
11. **Frontend 全套**：Card Grid 选择器、配置 Modal、Schema Mapping UI、列表页增强
12. **依赖管理**：Azure SDK 默认，neo4j/mysql/postgresql 作为 extras

### 不包含

- Pipeline Runner 自动触发 Target 写入（需 Pipeline → Target 的 run 调度，属于 Run 模块 Phase 2）
- 增量同步 / Change Data Capture
- 目标端数据删除 / 回滚
- 批量写入重试策略的生产级优化

## 设计原则

1. **与 DataSource 模块一致**：类型选择 Card Grid、CONFIG_FIELDS、SECRET_FIELDS、connectivity test、SVG 图标 — 完全复用同一 pattern
2. **Schema Mapping 是核心差异**：Target 比 DataSource 多一层映射复杂度，需要专门的 mapping engine 和 UI
3. **从 Pipeline 推断**：vector 维度、输出字段列表尽可能从 Pipeline graph_data 自动推断，减少手动配置
4. **统一格式，按需适配**：图数据用统一 vertices/edges 格式，各 writer 负责转译为 Gremlin/Cypher
5. **Extras 依赖**：非 Azure 的数据库驱动作为 pip extras，缺失时给出友好安装提示
