# Runs & Execution Module Specification

## MODIFIED Requirements

### Requirement: 统一 Pipeline Runs 查询 API

系统 SHALL 提供统一的 Pipeline Runs 查询端点，合并 `runs` 表和 `pipeline_runs` 表的数据。

#### Scenario: 统一列表查询

- **WHEN** GET /api/v1/pipeline-runs?page=1&page_size=20
- **THEN** 返回分页响应，合并两张表数据，按 created_at 倒序
- **AND** 每条记录包含:
  - id, pipeline_id, pipeline_name (Pipeline 名称), status, source ("standalone" | "workflow")
  - total_files, processed_files, failed_files
  - started_at, finished_at, created_at
  - workflow_run_id (仅 workflow 来源有值，standalone 为 null)

#### Scenario: 按来源过滤

- **WHEN** GET /api/v1/pipeline-runs?source=workflow
- **THEN** 仅返回来自 `pipeline_runs` 表的记录

#### Scenario: 按来源过滤 standalone

- **WHEN** GET /api/v1/pipeline-runs?source=standalone
- **THEN** 仅返回来自 `runs` 表的记录

### MODIFIED Requirement: 前端 Pipeline Runs 页面

原 "Run History" 页面 RENAMED 为 "Pipeline Runs"。

#### Scenario: Pipeline Runs 列表展示

- **WHEN** 用户访问 /pipeline-runs
- **THEN** 显示表格: Pipeline (名称) / Source (标签) / Status (Tag) / Files (processed/total) / Started / Actions
- **AND** Source 列: "Standalone" 或 "Workflow" 标签
- **AND** Status 颜色: pending=default, running=processing, completed=success, failed=error, cancelled=warning

#### Scenario: 详情弹窗

- **WHEN** 用户点击某行
- **THEN** 显示 Modal 展示完整 Run 信息: Pipeline 名称、来源、状态、文件进度、时间、错误信息

#### Scenario: 侧边栏和 Dashboard

- **WHEN** 用户查看侧边栏菜单
- **THEN** 原 "Run History" 显示为 "Pipeline Runs"
- **AND** Dashboard 卡片同步更新标题
