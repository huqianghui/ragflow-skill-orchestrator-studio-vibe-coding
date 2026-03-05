# 实施任务清单：输出目标管理与数据写入

## 概览

本文档列出 `output-targets`（CHANGE-005）变更的所有实施任务。任务按模块分组，标注优先级和依赖关系。

---

## 1. 数据模型与 Schema

### 1.1 Target 模型扩展

- [ ] 更新 `app/models/target.py`，扩展 Target ORM 模型
  - 新增字段：`description`、`field_mappings`（JSON）、`is_connected`（Boolean）、`last_write_at`、`last_write_status`
  - 确保 `connection_config` 字段存储加密后的内容
- [ ] 生成 Alembic 迁移脚本（`alembic revision --autogenerate -m "extend target model"`）
- [ ] 执行迁移并验证表结构正确

### 1.2 Pydantic Schema 定义

- [ ] 创建/更新 `app/schemas/target.py`，定义以下 Schema：
  - `TargetCreate`：创建请求体（name, description, target_type, connection_config, pipeline_id）
  - `TargetUpdate`：更新请求体（所有字段可选）
  - `TargetResponse`：响应体（敏感字段掩码处理）
  - `ConnectionTestResponse`：连接测试结果（success, message, latency_ms）
  - `SchemaResponse`：目标 Schema 响应（index_name, fields）
  - `FieldMappingSuggestion`：字段映射建议（source_field, target_field, confidence, auto_matched）
  - `WriteResultResponse`：写入结果（total, succeeded, failed, errors）
- [ ] 编写 Schema 的 unit test，验证序列化和反序列化

---

## 2. 连接配置加密

### 2.1 加密工具

- [ ] 添加 `cryptography` 依赖到 `pyproject.toml`
- [ ] 创建 `app/utils/encryption.py`，实现 `ConfigEncryption` 类
  - `encrypt(plaintext: str) -> str`：加密字符串
  - `decrypt(ciphertext: str) -> str`：解密字符串
  - `mask_sensitive(value: str, visible_chars: int = 4) -> str`：掩码处理（如 `***...abcd`）
- [ ] 更新 `app/config.py`，新增 `encryption_key` 配置项
  - 支持从环境变量 `ENCRYPTION_KEY` 读取
  - 未配置时自动生成并记录到日志（仅开发环境）
- [ ] 编写加密/解密的 unit test
- [ ] 定义敏感字段列表配置（`SENSITIVE_FIELDS = ["api_key", "password", "connection_string"]`）

### 2.2 加密集成

- [ ] 在 Target 创建时自动加密 `connection_config` 中的敏感字段
- [ ] 在 Target 读取时自动掩码 `connection_config` 中的敏感字段
- [ ] 在 Target 更新时，若敏感字段值为掩码值（`***...`），则保留原加密值不覆盖
- [ ] 内部使用（如 Writer 写入）时解密完整配置

---

## 3. Target CRUD API

### 3.1 基础 CRUD

- [ ] 实现 `app/services/target_service.py`：
  - `create_target()`：创建 Target，加密敏感字段后存储
  - `get_target()`：获取单个 Target，掩码敏感字段
  - `list_targets()`：分页列表，支持按 `target_type` 和 `pipeline_id` 过滤
  - `update_target()`：更新 Target，处理敏感字段的部分更新逻辑
  - `delete_target()`：删除 Target（软删除或硬删除）
- [ ] 实现 `app/api/targets.py` 路由：
  - `GET /api/v1/targets`：列表查询（分页 + 过滤）
  - `POST /api/v1/targets`：创建
  - `GET /api/v1/targets/{id}`：详情
  - `PUT /api/v1/targets/{id}`：更新
  - `DELETE /api/v1/targets/{id}`：删除
- [ ] 在 `app/api/router.py` 中注册 targets 路由
- [ ] 编写 CRUD API 的集成测试（conftest 中准备测试数据）

### 3.2 连接测试端点

- [ ] 实现 `POST /api/v1/targets/{id}/test-connection`
  - 解密连接配置
  - 调用对应 Writer 的 `test_connection()` 方法
  - 记录测试延迟（latency_ms）
  - 更新 Target 的 `is_connected` 状态
  - 返回 `ConnectionTestResponse`
- [ ] 添加 rate limiting（每个 Target 每分钟最多 5 次测试请求）
- [ ] 编写连接测试的集成测试（mock Azure SDK）

---

## 4. Writer 抽象层

### 4.1 基础接口

- [ ] 创建 `app/services/writers/base.py`，定义：
  - `WriteResult` dataclass
  - `BaseTargetWriter` 抽象基类（test_connection, get_schema, write_batch, validate_field_mapping）
- [ ] 创建 `app/services/writers/factory.py`，实现 `WriterFactory`
  - `register(target_type, writer_class)` 类方法
  - `create(target_type) -> BaseTargetWriter` 类方法
  - 不支持的类型抛出 `ValueError`
- [ ] 创建 `app/services/writers/__init__.py`，注册所有可用的 Writer
- [ ] 编写 WriterFactory 的 unit test

### 4.2 Azure AI Search Writer

- [ ] 添加 `azure-search-documents>=11.4.0` 和 `azure-core>=1.30.0` 到 `pyproject.toml`
- [ ] 创建 `app/services/writers/azure_search.py`，实现 `AzureSearchWriter`：
  - `test_connection()`：调用 `get_index()` 验证连接
  - `get_schema()`：读取 Index 的字段定义并返回结构化数据
  - `write_batch()`：批量写入文档，包含字段映射转换和分批上传
  - `validate_field_mapping()`：验证映射中的目标字段是否存在于 Index Schema
  - `_upload_with_retry()`：带 exponential backoff 的重试逻辑
- [ ] 在 WriterFactory 中注册 AzureSearchWriter：`WriterFactory.register("azure_ai_search", AzureSearchWriter)`
- [ ] 编写 AzureSearchWriter 的 unit test（mock azure-search-documents SDK）
  - 测试正常写入流程
  - 测试 429 重试逻辑
  - 测试 partial failure 处理
  - 测试连接失败场景

### 4.3 Azure AI Search Index 管理

- [ ] 创建 `app/services/writers/azure_search_index.py`，实现 `AzureSearchIndexManager`：
  - `create_index()`：根据字段定义创建新 Index
  - `list_indexes()`：列出所有可用 Index
- [ ] 实现 API 端点：
  - `GET /api/v1/targets/{id}/indexes`：列出 Azure AI Search 实例的所有 Index
  - `GET /api/v1/targets/{id}/schema`：读取指定 Index 的 Schema
- [ ] 编写 Index 管理的 unit test

---

## 5. 字段映射引擎

### 5.1 映射核心逻辑

- [ ] 创建 `app/services/field_mapping.py`，实现 `FieldMappingEngine`：
  - `suggest_mappings(source_fields, target_fields)`：基于名称相似度自动建议映射
  - `_calculate_similarity(source, target)`：综合 SequenceMatcher + 包含检测计算相似度
  - 可配置的相似度阈值（默认 0.6）
- [ ] 编写相似度计算的 unit test，覆盖以下场景：
  - 精确匹配：`content` -> `content`（score = 1.0）
  - 近似匹配：`doc_content` -> `document_content`（高分）
  - 大小写/分隔符归一化：`docContent` -> `doc_content`
  - 不匹配：`title` -> `embedding_vector`（低分，不建议）
  - 包含关系：`id` -> `document_id`

### 5.2 映射 API

- [ ] 实现 `GET /api/v1/targets/{id}/field-mappings`：获取当前映射配置
- [ ] 实现 `PUT /api/v1/targets/{id}/field-mappings`：保存映射配置
- [ ] 实现 `POST /api/v1/targets/{id}/field-mappings/suggest`：
  - 请求体：`{ "source_fields": ["id", "content", "embedding", ...] }`
  - 自动读取 Target 的 Index Schema
  - 调用 FieldMappingEngine 生成建议
  - 返回建议列表（含 confidence 分数）
- [ ] 编写字段映射 API 的集成测试

---

## 6. 批量写入端点

### 6.1 写入 API

- [ ] 实现 `POST /api/v1/targets/{id}/write`：
  - 请求体：`{ "documents": [...] }` 或引用 Pipeline Run 的输出
  - 加载 Target 配置并解密
  - 加载字段映射配置
  - 调用 WriterFactory 获取 Writer 实例
  - 执行 `write_batch()` 并返回 `WriteResult`
  - 更新 Target 的 `last_write_at` 和 `last_write_status`
- [ ] 实现 `GET /api/v1/targets/{id}/write-status`：查询最近写入状态
- [ ] 编写写入 API 的集成测试（mock Writer）

### 6.2 Pipeline 执行集成

- [ ] 在 Pipeline 执行引擎的完成回调中添加 Target 写入触发逻辑
  - 检查 Pipeline 是否关联了 Target
  - 若关联，则自动触发写入
- [ ] 编写 Pipeline -> Target 写入的端到端测试

---

## 7. 错误处理与日志

- [ ] 定义 Target 相关的自定义异常：
  - `TargetConnectionError`：连接失败
  - `TargetWriteError`：写入失败
  - `FieldMappingError`：字段映射错误
  - `UnsupportedTargetTypeError`：不支持的目标类型
- [ ] 在 `main.py` 中注册对应的异常处理器
- [ ] 添加结构化日志：
  - 连接测试：记录目标类型、endpoint、结果、延迟
  - 写入操作：记录文档数量、成功/失败数、耗时
  - 重试事件：记录重试原因、等待时间、重试次数
- [ ] 确保日志中不包含解密后的敏感信息

---

## 8. 配置与环境

- [ ] 更新 `.env.example`，新增以下配置项：
  - `ENCRYPTION_KEY`：加密密钥
  - `AZURE_SEARCH_DEFAULT_API_VERSION`：默认 API 版本（可选）
- [ ] 更新 `docker-compose.yml`，添加必要的环境变量
- [ ] 更新 `pyproject.toml`，添加新增依赖：
  - `azure-search-documents>=11.4.0`
  - `azure-core>=1.30.0`
  - `cryptography>=42.0`

---

## 任务依赖关系

```
1.1 Target 模型扩展
 └── 1.2 Pydantic Schema
      └── 3.1 基础 CRUD API
           ├── 3.2 连接测试端点
           └── 6.1 写入 API

2.1 加密工具
 └── 2.2 加密集成
      └── 3.1 基础 CRUD API

4.1 Writer 基础接口
 └── 4.2 Azure AI Search Writer
      ├── 3.2 连接测试端点
      ├── 4.3 Index 管理
      └── 6.1 写入 API

5.1 映射核心逻辑
 └── 5.2 映射 API
      └── 6.1 写入 API

6.1 写入 API
 └── 6.2 Pipeline 执行集成

7. 错误处理与日志（可与 3-6 并行）
8. 配置与环境（可与 1-2 并行）
```

---

## 验收标准

1. **CRUD 完整性**：Target 的创建、查询、更新、删除 API 全部可用，支持分页和过滤
2. **连接安全性**：敏感字段（api_key 等）加密存储，API 响应中不暴露明文
3. **连接测试**：可成功测试 Azure AI Search 连接，返回连接状态和延迟
4. **Schema 读取**：可读取 Azure AI Search Index 的完整字段定义
5. **字段映射**：手动映射可保存和加载；自动建议对常见字段名准确率 >= 80%
6. **批量写入**：1000+ 文档写入成功率 >= 99.5%，支持 merge-or-upload 语义
7. **重试机制**：模拟 429 错误时，系统自动重试并最终成功写入
8. **错误报告**：写入失败时返回清晰的错误信息，包括失败文档的 key 和具体原因
9. **日志安全**：日志中不出现解密后的 API Key 或密码
10. **测试覆盖**：核心模块（Writer、加密、字段映射）的 unit test 覆盖率 >= 85%
