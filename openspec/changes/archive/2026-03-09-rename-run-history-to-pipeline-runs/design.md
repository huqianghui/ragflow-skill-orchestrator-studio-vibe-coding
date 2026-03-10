## Context

当前系统有两张表存储 Pipeline 执行记录：`runs`（独立执行）和 `pipeline_runs`（Workflow 触发的执行）。前端 "Run History" 页面仅展示 `runs` 表数据，命名模糊。需要统一为 "Pipeline Runs" 并合并两个来源的数据。

## Goals / Non-Goals

**Goals:**

- 新增 `GET /api/v1/pipeline-runs` 统一查询端点，合并 `runs` 和 `pipeline_runs` 两张表
- 前端页面从 `RunHistory` 重命名为 `PipelineRuns`，切换到新 API
- 表格显示 Pipeline 名称（通过 join 查询）、来源标签（Standalone / Workflow）
- 侧边栏和 Dashboard 卡片同步重命名
- 新增详情弹窗（Modal）展示完整 Run 信息

**Non-Goals:**

- 不修改现有 `runs` 和 `pipeline_runs` 的表结构
- 不修改现有 `/api/v1/runs` 端点（保留兼容）
- 不做 Phase 2 的执行引擎功能

## Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据合并方式 | 后端新 API 做 UNION 查询 | 两张表结构不同，后端统一适配比前端调两个 API 更简洁 |
| 新 API 路径 | `GET /api/v1/pipeline-runs` | 独立新路由，不影响旧 `/api/v1/runs` |
| 统一响应模型 | `UnifiedPipelineRun` | 提取两表共同字段 + source 标记 + pipeline_name |
| Pipeline 名称 | 后端 JOIN 查询返回 | 避免前端额外请求 Pipeline 列表 |
| 旧 API | 保留不变 | 其他地方可能引用，渐进式迁移 |

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| UNION 查询性能 | 两表数据量小（SQLite），UNION ALL + ORDER BY + LIMIT 性能无压力 |
| 两表字段不完全对齐 | UnifiedPipelineRun 取交集字段，source 字段标记来源 |
| localStorage 布局缓存使用旧 key | Dashboard 新 key `pipeline_runs` 自动追加到布局末尾 |
