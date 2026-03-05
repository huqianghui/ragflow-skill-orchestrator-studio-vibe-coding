# React 前端完整实现

## 变更编号

`react-frontend`

## 状态

`proposed`

## 问题描述

RAGFlow Skill Orchestrator Studio 需要一个直观的 Web UI，让业务开发人员可以可视化地构建和管理 Pipeline。当前系统仅有后端 API 和前端脚手架，缺少完整的用户界面，面临以下问题：

- **无法可视化编排 Pipeline**：业务开发人员无法通过拖拽方式组合 Skill，只能手动调用 API
- **缺少 Skill 管理界面**：Skill 的浏览、搜索、创建和配置没有友好的操作入口
- **数据源管理不便**：文件上传、Azure Blob Storage 配置等操作缺少可视化表单
- **运行监控缺失**：Pipeline 的执行状态、日志和指标无法实时查看
- **目标配置复杂**：输出目标的连接配置和字段映射需要直观的 UI 支持
- **系统运维困难**：存储统计、数据清理等运维操作没有管理界面

## 解决方案

基于 **React + TypeScript + Ant Design + React Flow** 技术栈，实现全部前端页面，覆盖系统的所有核心功能模块：

### 页面总览

| 页面 | 路由 | 说明 |
|------|------|------|
| Dashboard | `/` | 系统概览，展示关键指标、最近运行和快捷操作 |
| Skill Library | `/skills` | Skill 浏览、搜索、过滤、创建和编辑 |
| Pipeline Editor | `/pipelines/:id/edit` | 核心画布页面，拖拽编排 Skill，配置节点属性 |
| DataSource Manager | `/data-sources` | 文件上传、数据源配置和管理 |
| Run Monitor | `/runs` | Pipeline 运行列表、进度跟踪、日志查看 |
| Target Config | `/targets` | 输出目标的连接配置和字段映射 |
| System Settings | `/settings` | 系统配置、存储统计和数据清理 |

### 核心技术选型

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 前端框架，类型安全 |
| Ant Design 5 | 企业级 UI 组件库 |
| React Flow | Pipeline 可视化画布 |
| Zustand | 轻量级全局状态管理 |
| React Query (TanStack Query) | 服务端状态管理和缓存 |
| Axios | HTTP 请求客户端 |
| React Router v6 | SPA 路由管理 |

## 影响范围

| 维度 | 说明 |
|------|------|
| 影响模块 | `frontend/` 全部代码 |
| 依赖关系 | 依赖 `init-project-foundation`（前端脚手架和后端 API） |
| 被依赖方 | 无（用户层面的最终交付物） |
| 风险等级 | 中（页面数量多，需要与后端 API 紧密配合） |
| 预计工作量 | 10-15 个工作日 |

## 成功标准

1. 所有 7 个页面可正常访问和交互
2. Pipeline Editor 支持拖拽添加节点、连接边、配置属性
3. Skill Library 支持搜索、过滤、分页、创建和编辑
4. DataSource Manager 支持文件上传和 Azure Blob 配置
5. Run Monitor 可实时展示运行状态和日志
6. Target Config 支持连接测试和字段映射
7. 所有页面响应式布局，在 1280px 以上屏幕正常显示
8. TypeScript 编译零错误，ESLint 零警告
9. 核心组件（Pipeline Editor、Skill Library）有单元测试覆盖
