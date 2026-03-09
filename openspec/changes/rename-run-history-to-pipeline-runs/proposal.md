## Why

侧边栏中 "Run History" 名称含义模糊，用户难以区分它与 "Workflow Runs" 的差异。实际上该页面是 Pipeline 级别的执行记录，应明确命名为 "Pipeline Runs"。同时 Workflow 执行时也会产生 PipelineRun 记录（存在 `pipeline_runs` 表中），但目前没有在任何列表中统一展示。需要将两种来源的 Pipeline 执行记录合并到同一个页面。

## What Changes

- 将侧边栏、Dashboard 卡片中的 "Run History" 统一重命名为 "Pipeline Runs"
- RunHistory 页面组件重命名为 PipelineRuns，文件名从 `RunHistory.tsx` 改为 `PipelineRuns.tsx`
- 新增后端 API `GET /api/v1/pipeline-runs` 统一查询两张表的 Pipeline 执行记录：
  - `runs` 表：独立 Pipeline 运行记录（来源标记为 "standalone"）
  - `pipeline_runs` 表：Workflow 触发的 Pipeline 运行记录（来源标记为 "workflow"，附带 workflow_run_id）
- 前端表格增强：显示 Pipeline 名称（而非 ID）、来源标签（Standalone/Workflow）、点击查看详情弹窗
- Dashboard 卡片 key 和标题同步更新

## Capabilities

### New Capabilities

（无新增 spec 级别能力）

### Modified Capabilities

- `runs`: 重命名为 "Pipeline Runs"，新增统一查询 API 合并两张表数据，前端增强展示

## Impact

- 后端新增: `backend/app/api/pipeline_runs.py` 统一查询路由
- 后端修改: `backend/app/api/router.py` 注册新路由
- 后端新增: `backend/app/schemas/pipeline_runs.py` 统一响应 schema
- 前端修改: `AppLayout.tsx`（侧边栏）、`Dashboard.tsx`（卡片）、路由配置
- 前端修改: `RunHistory.tsx` → `PipelineRuns.tsx`（重命名 + 数据源切换 + UI 增强）
- 前端修改: `services/api.ts`（新增 pipelineRunsApi）、`types/index.ts`（新增类型）
- 测试新增: `backend/tests/test_pipeline_runs_api.py`
