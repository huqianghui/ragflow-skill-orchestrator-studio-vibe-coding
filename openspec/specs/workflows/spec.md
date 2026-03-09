# Workflows Module Specification

## Purpose

Workflow 是 DataSource → Pipeline → Target 的编排层。定义路由规则将文件按类型路由到不同 Pipeline 处理，结果写入多个 Target。

### Requirement: Workflow Data Model

系统 SHALL 提供 Workflow 实体，作为 DataSource → Pipeline → Target 的编排层。

#### Scenario: Workflow 字段结构

- **GIVEN** 数据库中存在一个 Workflow 记录
- **THEN** 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符)
  - description (描述, 可选)
  - status (draft | active | archived, 默认 draft)
  - data_source_ids (JSON 数组, 关联的 DataSource ID 列表)
  - routes (JSON 数组, 路由规则列表)
  - default_route (JSON 对象, 兜底路由规则, 可选)
  - created_at / updated_at (时间戳)

#### Scenario: Route 规则结构

- **GIVEN** Workflow 的 routes 数组中存在一条路由规则
- **THEN** 该规则包含以下字段:
  - name (str): 路由名称
  - priority (int): 优先级，值越小优先级越高
  - file_filter (object): 文件过滤条件
    - extensions (list[str], 可选): 文件扩展名列表 (如 ["pdf", "docx"])
    - mime_types (list[str], 可选): MIME 类型列表
    - size_range (object, 可选): { min_bytes: int, max_bytes: int }
    - path_pattern (str, 可选): 路径匹配模式 (如 "training/*")
  - pipeline_id (str): 关联的 Pipeline ID
  - target_ids (list[str]): 关联的 Target ID 列表

#### Scenario: Default Route 结构

- **GIVEN** Workflow 设置了 default_route
- **THEN** 结构与 Route 相同，但不包含 file_filter 和 priority 字段
- **AND** 未被任何路由匹配的文件将由 default_route 处理

### Requirement: Workflow CRUD API

系统 SHALL 提供 Workflow 的完整 CRUD API。

#### Scenario: 创建 Workflow

- **WHEN** POST /api/v1/workflows，body 包含:
  - name (必填, 1-255 字符)
  - description (可选)
  - data_source_ids (可选, 默认 [])
  - routes (可选, 默认 [])
  - default_route (可选, 默认 null)
- **THEN** 创建 Workflow (status=draft) 并返回 201

#### Scenario: 列出 Workflow（分页）

- **WHEN** GET /api/v1/workflows?page=1&page_size=20
- **THEN** 返回分页响应，按 created_at 倒序排列
- **AND** 响应包含 items, total, page, page_size, total_pages

#### Scenario: 获取 Workflow 详情

- **WHEN** GET /api/v1/workflows/{id}
- **THEN** 返回完整的 Workflow 数据
- **AND** 若不存在返回 404

#### Scenario: 更新 Workflow

- **WHEN** PUT /api/v1/workflows/{id}，body 包含要更新的字段
- **THEN** 仅更新提供的字段（partial update）
- **AND** 返回更新后的 Workflow

#### Scenario: 删除 Workflow

- **WHEN** DELETE /api/v1/workflows/{id}
- **THEN** 删除 Workflow 并返回 204
- **AND** 若不存在返回 404

### Requirement: Workflow 前端管理

系统 SHALL 提供 Workflows 管理页面，与现有模块（Connections、DataSources）保持一致的交互体验。

#### Scenario: Workflows 列表页

- **WHEN** 用户访问 Workflows 页面
- **THEN** 显示 Workflow 列表（表格形式）
- **AND** 包含列: Name, Status, Data Sources 数量, Routes 数量, Description, Created At
- **AND** 支持分页
- **AND** 提供搜索过滤功能

#### Scenario: 创建 Workflow

- **WHEN** 用户点击 "New Workflow" 按钮
- **THEN** 弹出 Modal 表单
- **AND** 表单包含: Name, Description, Data Sources 多选, 路由规则动态列表, Default Route

#### Scenario: 编辑 Workflow

- **WHEN** 用户点击列表中的 Workflow 名称
- **THEN** 弹出预填充的编辑 Modal
- **AND** 用户可修改所有字段包括 Status

### Requirement: WorkflowRun 执行引擎

系统 SHALL 提供 Workflow 执行引擎，将文件从 DataSource 路由到 Pipeline 处理。

#### Scenario: WorkflowRun 数据模型

- **GIVEN** 数据库中存在一个 WorkflowRun 记录
- **THEN** 包含字段: id, workflow_id, status (pending|running|completed|failed|cancelled), total_files, processed_files, failed_files, error_message, started_at, finished_at, created_at, updated_at

#### Scenario: PipelineRun 数据模型

- **GIVEN** 数据库中存在一个 PipelineRun 记录
- **THEN** 包含字段: id, workflow_run_id, pipeline_id, route_name, target_ids (JSON), status, total_files, processed_files, failed_files, error_message, started_at, finished_at, created_at, updated_at

#### Scenario: 触发执行

- **WHEN** POST /api/v1/workflows/{id}/run
- **THEN** 创建 WorkflowRun，按路由匹配文件到 Pipeline，逐文件执行，返回运行结果（含 PipelineRun 子记录）

#### Scenario: 路由匹配

- **GIVEN** Workflow 包含多条路由规则
- **WHEN** 执行时对每个文件按 priority 排序逐条检查 file_filter
- **THEN** 匹配成功的文件分配到对应 Pipeline
- **AND** 未匹配的文件使用 default_route 处理（若存在）

#### Scenario: 增量处理

- **GIVEN** 同一 Workflow 第二次执行
- **WHEN** 文件的 etag 未变化
- **THEN** 跳过该文件不再重复处理
- **AND** etag 变化的文件重新处理

#### Scenario: 查询运行列表

- **WHEN** GET /api/v1/workflow-runs?workflow_id={id}
- **THEN** 返回分页的 WorkflowRun 列表

#### Scenario: 查询运行详情

- **WHEN** GET /api/v1/workflow-runs/{id}
- **THEN** 返回 WorkflowRun 详情含 PipelineRun 子记录

### Requirement: Workflow Run 前端

#### Scenario: Run 按钮

- **WHEN** 用户在 Workflows 列表页点击 "Run" 按钮
- **THEN** 触发 POST /workflows/{id}/run
- **AND** 显示运行结果 Modal（状态、文件数、PipelineRun 列表）

#### Scenario: WorkflowRunHistory 页面

- **WHEN** 用户访问 Workflow Runs 页面
- **THEN** 显示所有 WorkflowRun 记录
- **AND** 支持按 Workflow 过滤
- **AND** 点击记录可查看详情（含 PipelineRun 子记录）
