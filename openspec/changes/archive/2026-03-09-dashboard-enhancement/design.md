## Context

Dashboard 现状：7 张纯计数卡片，前端通过 7 个独立 list API 获取 `total` 字段作为计数。缺少 Workflow 模块统计、状态分布、最近活动等信息。新增的 Workflow 编排功能（WorkflowRun、PipelineRun）已上线但未在 Dashboard 中体现。

## Goals / Non-Goals

**Goals:**

- 新增后端 `GET /api/v1/dashboard/stats` 聚合端点，一次返回所有统计
- Dashboard 新增 Workflows 和 Workflow Runs 卡片
- 展示最近 5 条 WorkflowRun 记录（状态、时间、文件数）
- 展示 WorkflowRun 成功率（completed / total）
- 前端从 7 个并行 API 切换为单一 stats API，减少请求数

**Non-Goals:**

- 不做图表/可视化（饼图、折线图等），保持卡片 + 列表简洁风格
- 不做实时刷新/WebSocket 推送，保持手动刷新
- 不做时间范围过滤（今日/本周/本月），MVP 只展示全量统计

## Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 统计数据获取 | 后端聚合 API | 减少前端 7→1 次请求，DB count 查询在后端更高效 |
| API 路由 | `GET /api/v1/dashboard/stats` | 独立路由模块，与业务 CRUD 解耦 |
| 最近活动 | 只展示 WorkflowRun | 这是端到端执行的主要入口，比 Run 更有价值 |
| 成功率计算 | 后端计算返回百分比 | 避免前端额外计算，数据一致性更好 |
| 卡片布局 | 复用现有 react-grid-layout | 新卡片自动融入网格，用户可自定义位置 |

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Stats API 查询多表可能慢 | 全部用 `count()` 聚合，SQLite 轻量表性能无压力 |
| localStorage 布局缓存不含新卡片 | 新卡片追加到布局末尾，不影响已保存位置 |
| 前端需兼容 stats API 不可用 | 保留 fallback 逻辑，stats 失败时显示 "-" |
