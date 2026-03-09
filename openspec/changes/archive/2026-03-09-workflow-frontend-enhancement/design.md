## Context

Workflow CRUD + Run 功能已上线。需要增强前端体验，让用户能查看运行历史并关联到具体 Workflow。

## Goals / Non-Goals

**Goals:**
- WorkflowRunHistory 页面（表格展示运行记录，可按 Workflow 过滤）
- Workflows 列表页增加 Last Run Status 列
- 导航菜单添加 Workflow Runs 入口

**Non-Goals:**
- 运行详情的可视化 DAG 展示（后续迭代）
- 实时运行状态更新（WebSocket 推送）

## Decisions

### 1. WorkflowRunHistory 页面复用现有模式
与 RunHistory 页面保持一致的 UI 模式：PageHeader + ListToolbar + Table。

### 2. Workflow 列表增加运行按钮跳转
每个 Workflow 行的 Run 结果可跳转到 WorkflowRunHistory 页面。

## Risks / Trade-offs
- 无显著风险
