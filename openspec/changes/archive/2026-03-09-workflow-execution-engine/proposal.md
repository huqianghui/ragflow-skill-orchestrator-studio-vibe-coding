## Why

Change 1 (Workflow 模型) 和 Change 2 (DataSource File Reader) 已就绪。现在需要执行引擎将它们串联：从 DataSource 读取文件，按路由规则匹配到 Pipeline，执行后将结果写入 Target。

## What Changes

- 新增 `WorkflowRun` ORM 模型（整体运行记录）
- 新增 `PipelineRun` ORM 模型（子运行记录，含 target_ids）
- 新增 `WorkflowExecutor` 服务（路由匹配 + 执行编排）
- 新增执行 API 端点（触发/查询运行）
- 新增 Alembic migration
- 新增前端 WorkflowRun 查看功能

## Capabilities

### New Capabilities

- `workflow-runs`: WorkflowRun 和 PipelineRun 的数据模型、执行引擎、API 端点

### Modified Capabilities

- `workflows`: 新增 POST /{id}/run 触发执行端点

## Impact

- **后端**: 新增 2 个 model, 1 个 service, 修改 API, 新增 migration
- **数据库**: 新增 workflow_runs 和 pipeline_runs 表
- **前端**: Workflow 页面新增运行按钮和运行历史
