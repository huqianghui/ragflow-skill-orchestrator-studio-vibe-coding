# Connections Module Specification

## Purpose

Connection 管理外部服务的认证凭据，供 Python Code Skill 在执行时通过 `context.get_client(name)` 获取已认证的 SDK 客户端。所有敏感配置在数据库中加密存储，API 响应中自动脱敏。

### Requirement: Connection Data Model [Phase 1 - 已实现]

#### Scenario: Connection 字段结构

- **GIVEN** 数据库中存在一个 Connection 记录
- **THEN** 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符, **唯一约束**)
  - connection_type (azure_openai | openai | azure_doc_intelligence | azure_content_understanding | azure_ai_foundry | http_api)
  - description (描述, 可选)
  - config (JSON 对象, AES 加密存储, 包含认证凭据)
  - is_default (布尔值, 默认 false, 每种 connection_type 最多一个 true)
  - created_at / updated_at (时间戳)

### Requirement: Connection CRUD [Phase 1 - 已实现]

#### Scenario: 创建 Connection

- **WHEN** POST /api/v1/connections，body 包含:
  - name (必填)
  - connection_type (必填)
  - description (可选)
  - config (必填, 包含认证凭据)
- **THEN** 加密 config 后存储，返回 201 + 脱敏后的 Connection 对象

#### Scenario: 列出 Connection（分页）

- **WHEN** GET /api/v1/connections?page=1&page_size=20
- **THEN** 返回分页响应，config 中敏感字段用 "***" 脱敏
- **AND** 按 created_at 倒序排列

#### Scenario: 获取 Connection 详情

- **WHEN** GET /api/v1/connections/{id}
- **THEN** 返回脱敏后的 Connection 对象
- **AND** 若不存在返回 404 NOT_FOUND

#### Scenario: 更新 Connection

- **WHEN** PUT /api/v1/connections/{id}
- **THEN** 支持更新 name / description / connection_type / config
- **AND** 新 config 加密存储

#### Scenario: 删除 Connection

- **WHEN** DELETE /api/v1/connections/{id}
- **THEN** 删除并返回 204

### Requirement: 连接测试 [Phase 1 - 已实现]

#### Scenario: 测试连接

- **WHEN** POST /api/v1/connections/{id}/test
- **THEN** 根据 connection_type 执行真实连接测试:
  - azure_openai: 调用 list models
  - openai: 调用 list models
  - azure_doc_intelligence: 获取 resource info
  - azure_content_understanding: 获取 resource info
  - azure_ai_foundry: 调用 list models
  - http_api: 发送 GET 请求
- **AND** 返回 { success: bool, message: string, details: object | null }

### Requirement: 敏感信息保护 [Phase 1 - 已实现]

#### Scenario: 加密存储

- **GIVEN** ENCRYPTION_KEY 环境变量配置 (Fernet)
- **WHEN** 保存 Connection
- **THEN** config JSON 使用 AES 对称加密后存储到数据库

#### Scenario: 响应脱敏

- **GIVEN** 不同 connection_type 有各自的敏感字段
- **THEN** API 响应中以下字段值替换为 "***":
  - azure_openai: api_key
  - openai: api_key
  - azure_doc_intelligence: api_key
  - azure_content_understanding: api_key
  - azure_ai_foundry: api_key
  - http_api: headers (整个对象)

### Requirement: Default Connection [Phase 2 - 已实现]

#### Scenario: Connection 新增 is_default 字段

- **GIVEN** Connection model
- **THEN** 新增 `is_default` (Boolean, default=False) 字段
- **AND** 每种 connection_type 最多有一个 is_default=true 的 Connection

#### Scenario: 设置默认连接

- **WHEN** PUT /api/v1/connections/{id}/set-default
- **THEN** 将该 Connection 的 is_default 设为 true
- **AND** 同类型其他 Connection 的 is_default 设为 false

#### Scenario: 获取各类型默认连接

- **WHEN** GET /api/v1/connections/defaults
- **THEN** 返回每种 connection_type 的默认 Connection（或 null）

### Requirement: Connection 与 Skill 集成 [Phase 1 - 已实现]

#### Scenario: Skill 引用 Connection

- **GIVEN** python_code Skill 配置了 connection_mappings: {"llm": "<connection-id>"}
- **WHEN** Skill 执行时调用 context.get_client("llm")
- **THEN** 解密对应 Connection 的 config，创建类型化的 SDK 客户端:
  - azure_openai → AzureOpenAI 客户端
  - openai → OpenAI 客户端
  - http_api → httpx.Client (带预配置 headers)
  - 其他类型 → 返回解密后的 config dict
