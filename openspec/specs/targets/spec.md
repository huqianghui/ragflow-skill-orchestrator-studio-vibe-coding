# Output Targets Module Specification

## Purpose

输出目标模块负责管理 Pipeline 处理完成后的数据写入目标。Phase 1 支持 CRUD 管理，Phase 2 实现实际连接和写入。

### Requirement: Target Data Model

#### Scenario: Target 字段结构

- **GIVEN** 数据库中存在一个 Target 记录
- **THEN** 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符)
  - description (描述, 可选)
  - target_type (azure_ai_search | mysql | postgresql | cosmosdb | neo4j)
  - connection_config (JSON 对象, 连接配置)
  - field_mappings (JSON 对象, 字段映射配置)
  - status (active | inactive | error, 默认 active)
  - pipeline_id (关联 Pipeline, 可选, 外键 pipelines.id)
  - created_at / updated_at (时间戳)
  - [Phase 2]: last_write_at (最后写入时间)

### Requirement: Target CRUD [Phase 1 - 已实现]

#### Scenario: 创建 Target

- **WHEN** POST /api/v1/targets，body 包含:
  - name (必填)
  - target_type (必填)
  - description (可选)
  - connection_config (可选, 默认 {})
  - field_mappings (可选, 默认 {})
  - pipeline_id (可选)
- **THEN** 创建 Target 并返回 201

#### Scenario: 列出 Target（分页）

- **WHEN** GET /api/v1/targets?page=1&page_size=20
- **THEN** 返回分页响应，按 created_at 倒序排列

#### Scenario: 获取 Target 详情

- **WHEN** GET /api/v1/targets/{id}
- **THEN** 返回完整 Target 对象
- **AND** 若不存在返回 404 NOT_FOUND

#### Scenario: 更新 Target

- **WHEN** PUT /api/v1/targets/{id}
- **THEN** 支持更新 name / description / connection_config / field_mappings / status / pipeline_id

#### Scenario: 删除 Target

- **WHEN** DELETE /api/v1/targets/{id}
- **THEN** 删除并返回 204

### Requirement: 前端 Target 页面 [Phase 1 - 已实现]

#### Scenario: Target 列表展示

- **WHEN** 用户访问 /targets
- **THEN** 显示表格: Name / Type (蓝色 Tag) / Status (Tag, 颜色: active=green, inactive=default, error=red) / Actions
- **AND** 支持 "New Target" 按钮 (占位)
- **AND** Actions: Configure (占位)

### Requirement: Azure AI Search 配置 [Phase 2]

#### Scenario: 配置连接

- **WHEN** 用户填写 service_name / api_key / index_name
- **THEN** 验证连接有效性
- **AND** 索引存在时获取 schema，不存在时提示可自动创建

#### Scenario: 自动创建索引

- **GIVEN** 目标 index_name 不存在
- **WHEN** 用户选择自动创建
- **THEN** 根据 Pipeline 输出 schema 生成索引字段定义

### Requirement: 字段映射 [Phase 2]

#### Scenario: 配置字段映射

- **WHEN** 用户配置 Pipeline 输出字段到目标字段的映射
- **THEN** 支持手动映射和自动建议（完全匹配 + 近似匹配）

#### Scenario: 映射验证

- **THEN** 检查: 必需字段都有来源、类型兼容、key 字段已映射

### Requirement: 数据写入 [Phase 2]

#### Scenario: 写入 Azure AI Search

- **GIVEN** Pipeline 执行完成
- **THEN** 按批次上传 (每批最多 1000 条)，merge-or-upload 策略
- **AND** 失败自动重试 (最多 3 次, 指数退避)
