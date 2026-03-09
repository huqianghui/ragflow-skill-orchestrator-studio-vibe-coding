# Dashboard Module Specification

## Purpose

Dashboard 提供系统全局统计概览，包括各资源总数、Workflow 执行状态分布、最近活动和成功率。

## ADDED Requirements

### Requirement: Dashboard Stats API

系统 SHALL 提供聚合统计 API，一次返回 Dashboard 所需的全部数据。

#### Scenario: 获取统计数据

- **WHEN** GET /api/v1/dashboard/stats
- **THEN** 返回 JSON 对象包含:
  - counts: { skills, connections, pipelines, data_sources, targets, workflows, workflow_runs, runs, agents }
  - skill_breakdown: { builtin, custom }
  - agent_breakdown: { available, unavailable }
  - workflow_run_stats: { success_rate (float 0-100), completed, failed, running, pending }
  - recent_workflow_runs: 最近 5 条 WorkflowRun 记录 (id, workflow_id, status, total_files, processed_files, failed_files, started_at, finished_at)

#### Scenario: 空数据库

- **WHEN** GET /api/v1/dashboard/stats 且数据库无数据
- **THEN** 所有 counts 返回 0
- **AND** success_rate 返回 0
- **AND** recent_workflow_runs 返回空数组

### Requirement: Dashboard 前端展示

系统 SHALL 在 Dashboard 页面展示完整的系统概览信息。

#### Scenario: 统计卡片

- **WHEN** 用户访问 Dashboard 页面
- **THEN** 显示 9 张统计卡片: Skills, Connections, Pipelines, Data Sources, Targets, Workflows, Workflow Runs, Run History, Agents
- **AND** 每张卡片显示对应资源的总数
- **AND** Skills 卡片显示 builtin/custom 细分
- **AND** Agents 卡片显示 online/offline 细分

#### Scenario: Workflow Runs 卡片增强

- **WHEN** Dashboard 加载完成
- **THEN** Workflow Runs 卡片除总数外还显示成功率百分比

#### Scenario: 最近活动区域

- **WHEN** Dashboard 加载完成
- **THEN** 显示"Recent Workflow Runs"区域
- **AND** 列出最近 5 条 WorkflowRun 记录
- **AND** 每条记录显示: 状态标签、文件处理进度 (processed/total)、开始时间
- **AND** 点击记录可跳转到 Workflow Runs 详情

#### Scenario: 数据加载

- **WHEN** Dashboard 初次加载
- **THEN** 调用 `GET /api/v1/dashboard/stats` 获取所有统计数据
- **AND** 加载中显示 Spin 组件
- **AND** API 失败时卡片显示 "-" 而非报错
