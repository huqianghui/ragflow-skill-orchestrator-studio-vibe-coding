# 项目基础设施搭建

## 变更编号

`init-project-foundation`

## 状态

`proposed`

## 问题描述

RAGFlow Skill Orchestrator Studio 是一个灵活的 Skill 编排工作台，类似于 Azure AI Search 的 "Import Data" 功能，但提供更高的灵活性和可扩展性。用户可以通过可视化界面将多个 Skill（如文档解析、向量化、知识库写入等）编排成 Pipeline，实现数据从源到目标的自动化处理。

当前项目从零开始，面临以下挑战：

- **缺少基础框架**：没有可运行的后端服务和前端应用，开发无法启动
- **数据模型未定义**：Skill、Pipeline、DataSource、Target、Run 等核心概念没有对应的数据结构
- **API 规范缺失**：前后端交互的接口规范尚未建立
- **开发环境不统一**：团队成员缺少一致的本地开发环境配置
- **没有持续集成**：代码质量缺少自动化保障

## 解决方案

搭建完整的项目基础设施，包括：

### 后端（Backend）

- 基于 **FastAPI** 构建 RESTful API 服务
- 使用 **SQLAlchemy** 作为 ORM，**SQLite** 作为 MVP 阶段数据库
- 使用 **Pydantic** 定义请求/响应数据模型
- 使用 **Alembic** 管理数据库迁移

### 前端（Frontend）

- 基于 **React + TypeScript + Vite** 构建单页应用
- 集成 **React Flow** 用于 Pipeline 可视化画布
- 建立组件库和路由结构

### 基础设施

- **Docker Compose** 统一开发环境
- 健康检查端点（Health Check Endpoint）
- 基础 CI 配置（Linting、Testing）

## 影响范围

| 维度 | 说明 |
|------|------|
| 影响模块 | 全部（这是第一个变更，为所有后续模块奠基） |
| 依赖关系 | 无前置依赖 |
| 被依赖方 | 后续所有变更都依赖此基础设施 |
| 风险等级 | 低（绿地项目，无需考虑向后兼容） |
| 预计工作量 | 3-5 个工作日 |

## 成功标准

1. 后端服务可启动，`/health` 端点返回正常
2. 前端应用可启动，显示基础页面布局
3. 数据库迁移可正常执行
4. Docker Compose 一键启动前后端服务
5. CI Pipeline 可运行 lint 和 test
