## ADDED Requirements

### Requirement: WorkflowRun Data Model

#### Scenario: WorkflowRun 字段结构
- **GIVEN** 数据库中存在一个 WorkflowRun 记录
- **THEN** 包含字段: id, workflow_id, status (pending|running|completed|failed|cancelled), total_files, processed_files, failed_files, error_message, started_at, finished_at, created_at, updated_at

### Requirement: PipelineRun Data Model

#### Scenario: PipelineRun 字段结构
- **GIVEN** 数据库中存在一个 PipelineRun 记录
- **THEN** 包含字段: id, workflow_run_id, pipeline_id, route_name, target_ids (JSON), status, total_files, processed_files, failed_files, error_message, started_at, finished_at, created_at, updated_at

### Requirement: Workflow Execution API

#### Scenario: 触发执行
- **WHEN** POST /api/v1/workflows/{id}/run
- **THEN** 创建 WorkflowRun，按路由匹配文件到 Pipeline，逐文件执行，返回运行结果

#### Scenario: 查询运行列表
- **WHEN** GET /api/v1/workflow-runs?workflow_id={id}
- **THEN** 返回分页的 WorkflowRun 列表

#### Scenario: 查询运行详情
- **WHEN** GET /api/v1/workflow-runs/{id}
- **THEN** 返回 WorkflowRun 详情含 PipelineRun 子记录

### Requirement: Route Matching Engine

#### Scenario: 按 extensions 匹配
- **WHEN** 文件扩展名在 route 的 file_filter.extensions 中
- **THEN** 匹配该 route

#### Scenario: 默认路由
- **WHEN** 文件未匹配任何 route 且存在 default_route
- **THEN** 使用 default_route 处理
