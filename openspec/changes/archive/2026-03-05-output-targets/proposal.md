# 输出目标管理与数据写入

## 变更编号

CHANGE-005: output-targets

## 状态

Draft

## 问题陈述

RAGFlow Skill Orchestrator Studio 的 Pipeline 处理完成后，需要将结果数据写入目标存储系统。当前面临以下挑战：

1. **缺少输出目标管理**：Pipeline 处理后的数据（如向量化文档、结构化字段）没有标准化的写入通道，无法持久化到外部检索引擎或数据库
2. **Azure AI Search 写入能力缺失**：作为 Phase 1 核心目标，需要支持将处理后的文档批量写入 Azure AI Search Index，包括 Index 创建、Schema 读取、字段映射和批量上传
3. **连接配置管理不完善**：目标存储的连接信息（endpoint、API Key 等）需要安全存储，且缺少统一的连接测试和验证机制
4. **字段映射复杂**：Pipeline 输出的字段名与目标 Index 的字段名可能不一致，需要灵活的字段映射配置
5. **批量写入缺乏可靠性保障**：大规模数据写入时缺少重试机制、错误处理和进度追踪

## 提议方案

### 核心设计

构建输出目标管理与数据写入系统，包含以下子系统：

1. **Target CRUD API**：标准化的输出目标元数据管理，支持创建、查询、更新、删除
2. **连接管理**：
   - 连接配置加密存储（API Key、连接字符串等敏感信息 AES 加密）
   - 连接测试端点（验证目标存储可达性和权限）
3. **字段映射引擎**：
   - 手动映射：用户指定 Pipeline 输出字段到目标 Index 字段的对应关系
   - 自动建议：基于字段名称相似度（Levenshtein distance / fuzzy matching）自动推荐映射
4. **批量写入引擎**：
   - Batch upload 支持（单次最大 1000 条文档）
   - merge-or-upload 语义（存在则更新，不存在则插入）
   - Exponential backoff 重试机制（应对 429 / 503 等瞬时错误）
   - 写入进度追踪与错误报告

### Phase 1: Azure AI Search

- 使用 `azure-search-documents` Python SDK
- 支持 Index 管理（创建 Index、读取 Index Schema）
- 支持 SearchIndexClient 和 SearchClient 操作
- 批量文档上传（`merge_or_upload_documents`）

### Phase 2 扩展目标（未来规划）

```
Target (Abstract Base)
├── AzureAISearchTarget      # Phase 1 - Azure AI Search
├── MySQLTarget               # Phase 2 - MySQL / MariaDB
├── PostgreSQLTarget          # Phase 2 - PostgreSQL
├── CosmosDBTarget            # Phase 2 - Azure Cosmos DB
└── Neo4jTarget               # Phase 2 - Neo4j Graph DB
```

## 影响范围

### 核心影响

- **数据模型**：扩展 `targets` 表，新增 `field_mappings`、`encrypted_config` 等字段
- **API 层**：实现 `/api/v1/targets` 系列 endpoints，新增连接测试、Schema 读取、字段映射建议等端点
- **服务层**：新增 `TargetService`、`AzureSearchWriter`、`FieldMappingEngine` 等服务
- **依赖引入**：新增 `azure-search-documents`、`cryptography` 等 Python 包

### 依赖关系

- 依赖 `init-project-foundation`（CHANGE-001）：使用基础数据模型和 API 框架
- 依赖 `pipeline-orchestration`（CHANGE-002）：Pipeline 执行完成后触发数据写入
- 被 `react-frontend`（CHANGE-006）依赖：前端 Target 配置页面需要后端 API 支持

### 安全考量

- 连接配置中的敏感信息（API Key、密码）必须加密存储，不得明文出现在数据库或日志中
- 连接测试端点需要做 rate limiting，防止被滥用探测外部服务
- Azure AI Search 的 Admin Key 权限范围需限制为最小必要权限

## 成功指标

- Target CRUD API 完整可用，支持 Azure AI Search 类型
- 可成功连接到 Azure AI Search 实例并读取 Index Schema
- 字段映射（手动 + 自动建议）正常工作
- 批量写入 1000+ 文档到 Azure AI Search Index 成功率 >= 99.5%
- 写入失败时自动重试，最终错误有清晰的错误报告
- 连接配置加密存储，API 响应中不暴露明文密钥
