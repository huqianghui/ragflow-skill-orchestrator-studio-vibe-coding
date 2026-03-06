# Runs & Execution Module Specification

## Purpose

运行模块负责 Pipeline 的执行记录管理。Phase 1 提供 Run 记录的 CRUD，Phase 2 实现完整的执行引擎、步骤可观测性和中间结果管理。

### Requirement: Run Data Model

#### Scenario: Run 字段结构

- **GIVEN** 数据库中存在一个 Run 记录
- **THEN** 包含以下字段:
  - id (UUID v4 字符串主键)
  - pipeline_id (关联 Pipeline, 外键 pipelines.id, 有索引)
  - datasource_id (输入数据源, 可选, 外键 data_sources.id)
  - target_id (输出目标, 可选, 外键 targets.id)
  - status (pending | running | completed | failed | cancelled, 默认 pending)
  - mode (sync | async, 默认 sync)
  - started_at / finished_at (时间戳, 可选)
  - total_documents / processed_documents / failed_documents (整数, 默认 0)
  - error_message (顶层错误信息, 可选)
  - metrics (运行指标, JSON, 可选)
  - created_at / updated_at (时间戳)

- **AND** [Phase 2] 每个 Run 包含多个 StepResult:
  - id, run_id, node_id, document_id
  - status (pending | running | completed | failed | skipped)
  - input_data / output_data (JSON)
  - error_message, started_at / finished_at, duration_ms

### Requirement: Run CRUD [Phase 1 - 已实现]

注: Phase 1 仅提供创建记录和查询，不包含实际执行逻辑。Run 没有 update 和 delete 端点。

#### Scenario: 创建 Run 记录

- **WHEN** POST /api/v1/runs，body 包含:
  - pipeline_id (必填)
  - datasource_id (可选)
  - target_id (可选)
  - mode (可选, sync | async, 默认 sync)
- **THEN** 创建 Run 记录 (status=pending) 并返回 201

#### Scenario: 列出 Run（分页）

- **WHEN** GET /api/v1/runs?page=1&page_size=20
- **THEN** 返回分页响应，按 created_at 倒序排列

#### Scenario: 获取 Run 详情

- **WHEN** GET /api/v1/runs/{id}
- **THEN** 返回完整 Run 对象
- **AND** 若不存在返回 404 NOT_FOUND

### Requirement: 前端 Run 历史页 [Phase 1 - 已实现]

#### Scenario: Run 列表展示

- **WHEN** 用户访问 /runs
- **THEN** 显示表格: ID / Pipeline / Status (Tag, 颜色映射) / Mode / Documents / Started / Actions
- **AND** Status 颜色: pending=default, running=processing, completed=success, failed=error, cancelled=warning
- **AND** Actions: View Details (占位)

### Requirement: 同步执行 [Phase 2]

#### Scenario: 同步执行单个文档

- **GIVEN** 已验证的 Pipeline + 单个文件
- **WHEN** 用户点击 "测试运行"
- **THEN** 同步执行，实时显示每个节点状态，单个请求-响应周期完成

#### Scenario: 同步超时

- **WHEN** 执行超过 300s (可配置 SYNC_EXECUTION_TIMEOUT_S)
- **THEN** 终止执行，返回已完成步骤结果，标记 status=failed

### Requirement: 异步执行 [Phase 2]

#### Scenario: 启动异步执行

- **WHEN** 用户点击 "开始运行"
- **THEN** 创建异步任务，返回 Run ID，后台逐文档处理

#### Scenario: 取消执行

- **WHEN** 用户点击 "取消"
- **THEN** 停止处理新文档，等待当前文档完成，标记 status=cancelled

### Requirement: 步骤可观测性 [Phase 2]

#### Scenario: 查看步骤详情

- **GIVEN** 一个 Run 已完成
- **THEN** 每个文档每个节点显示: 状态、输入/输出 JSON、耗时、错误信息

#### Scenario: 步骤失败处理

- **WHEN** 某节点处理某文档失败
- **THEN** 记录错误到 StepResult，该文档标记 failed，继续处理其他文档

### Requirement: 中间结果管理 [Phase 2]

#### Scenario: 查看中间结果

- **THEN** 支持 JSON 格式化查看、大文本折叠/展开

#### Scenario: 清理策略

- **GIVEN** CLEANUP_RETENTION_DAYS = 7
- **THEN** 每日自动清理超过 7 天的 Run 中间结果 (保留元数据)
- **AND** 标记为 "保留" 的 Run 不被清理

### Requirement: 运行日志 [Phase 2]

#### Scenario: 查看日志

- **THEN** 显示结构化日志: 时间戳 / 级别 / 节点名称 / 消息
- **AND** 支持按级别筛选和关键词搜索
- **AND** 运行中的 Run 支持实时日志流 (WebSocket/SSE)
