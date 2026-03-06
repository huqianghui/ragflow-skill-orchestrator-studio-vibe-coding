# Data Sources Module Specification

## Purpose

数据源模块负责管理 Pipeline 的输入数据来源。支持本地文件上传和 Azure Blob Storage 两种类型。

### Requirement: 数据源 Data Model

#### Scenario: 数据源字段结构

- **GIVEN** 数据库中存在一个 DataSource 记录
- **THEN** 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符)
  - description (描述, 可选)
  - source_type (local_upload | azure_blob)
  - connection_config (JSON 对象, 类型相关配置)
  - status (active | inactive | error, 默认 active)
  - file_count (文件数量, 默认 0)
  - total_size (总大小 bytes, 默认 0)
  - pipeline_id (关联 Pipeline, 可选, 外键 pipelines.id)
  - created_at / updated_at (时间戳)
  - [Phase 2]: last_synced_at (最后同步时间, 仅 azure_blob)

### Requirement: 数据源 CRUD [Phase 1 - 已实现]

#### Scenario: 创建数据源

- **WHEN** POST /api/v1/data-sources，body 包含:
  - name (必填)
  - source_type (必填, local_upload | azure_blob)
  - description (可选)
  - connection_config (可选, 默认 {})
  - pipeline_id (可选)
- **THEN** 创建数据源并返回 201

#### Scenario: 列出数据源（分页）

- **WHEN** GET /api/v1/data-sources?page=1&page_size=20
- **THEN** 返回分页响应，按 created_at 倒序排列

#### Scenario: 获取数据源详情

- **WHEN** GET /api/v1/data-sources/{id}
- **THEN** 返回完整数据源对象
- **AND** 若不存在返回 404 NOT_FOUND

#### Scenario: 更新数据源

- **WHEN** PUT /api/v1/data-sources/{id}
- **THEN** 支持更新 name / description / connection_config / status / pipeline_id

#### Scenario: 删除数据源

- **WHEN** DELETE /api/v1/data-sources/{id}
- **THEN** 删除并返回 204

### Requirement: 前端数据源页面 [Phase 1 - 已实现]

#### Scenario: 数据源列表展示

- **WHEN** 用户访问 /data-sources
- **THEN** 显示表格: Name / Type (Tag) / Status (Tag, 颜色: active=green, inactive=default, error=red) / Files / Actions
- **AND** 支持 "New Data Source" 按钮 (占位)
- **AND** Actions: Manage (占位)

### Requirement: 本地文件上传 [Phase 2]

#### Scenario: 上传文件

- **WHEN** 用户选择文件上传
- **THEN** 显示上传进度，完成后文件出现在文件列表

#### Scenario: 支持的文件格式

- **THEN** 支持: PDF / Word (.docx, .doc) / 纯文本 (.txt, .md, .csv) / HTML / 图片 (.png, .jpg, .jpeg, .tiff) / JSON (.json, .jsonl) / Excel (.xlsx, .xls)

#### Scenario: 文件大小限制

- **WHEN** 单个文件超过 100MB (可配置 MAX_UPLOAD_SIZE_MB)
- **THEN** 拒绝上传并提示

### Requirement: Azure Blob Storage [Phase 2]

#### Scenario: 配置连接

- **WHEN** 用户填写 connection_string (或 account_name + account_key) + container_name
- **THEN** 验证连接有效性，列出匹配文件

#### Scenario: 同步文件列表

- **WHEN** 用户点击 "同步"
- **THEN** 扫描 container 文件，更新文件列表和 last_synced_at
