# Agentic RAGFlow Studio

AI Agent 驱动的智能编排工作室，用于构建数据摄取管道（Data Ingestion Pipeline）。集成 Claude Code、Codex、GitHub Copilot 等本地 CLI Agent，在 Skill 编写、Pipeline 编排和调试的每个环节提供智能辅助。灵感来源于 Azure AI Search 的 "Import Data" 功能，但提供更高的定制化能力和 AI 驱动的工作流。

## 架构概览

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                     │
│  Ant Design + Monaco Editor + TypeScript + Zustand         │
│  Port: 15173 (dev) / 80 (prod nginx)                      │
└────────────────────┬───────────────────────────────────────┘
                     │ /api/v1/*
┌────────────────────▼───────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│  SQLAlchemy 2.0 (async) + Pydantic v2 + Alembic             │
│  Port: 18000                                                │
└────────────────────┬───────────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │   SQLite      │
              │  (MVP 阶段)    │
              └──────────────┘
```

## 核心模块

| 模块 | 说明 | 已实现功能 |
|------|------|-----------|
| **Skills** | Skill 管理 — 16 个内置 + 3 种自定义 (Web API / 配置模板 / Python 代码) | CRUD、内置 Skill 自动播种、Python Code 执行引擎（隔离 venv）、内置 Skill 执行引擎（Azure AI Language/Vision/OpenAI）、Document Intelligence Studio、Connection 绑定、在线测试 |
| **Connections** | 外部服务认证凭据管理（Azure OpenAI / AI Foundry / Doc Intelligence 等） | CRUD、AES 加密存储、API 响应脱敏、连通性测试、Default Connection |
| **Pipelines** | Pipeline 有序 Skill 节点编排 | CRUD、节点管理（添加/删除/拖拽排序）、Enrichment Tree 数据结构、Pipeline Runner 执行引擎、Debug 模式（3 列调试布局）、5 个预置模板 |
| **Data Sources** | 16 种数据源类型（Local / Azure / AWS / Logic Apps 等） | CRUD、本地文件上传（配额管理）、连通性测试、Secret 掩码、过期清理 |
| **Targets** | 6 种输出目标（AI Search / Blob / CosmosDB / Neo4j / MySQL / PostgreSQL） | CRUD、连通性测试、Schema 发现、索引管理、字段映射引擎（含图数据映射）、Writer 服务 |
| **Workflows** | DataSource → Pipeline → Target 编排层 | CRUD、路由规则（按扩展名/MIME/大小/路径模式匹配文件到 Pipeline）、Default Route 兜底、WorkflowRun + PipelineRun 执行引擎、增量处理（etag 检测跳过已处理文件）、Workflow Runs 历史页、React Flow 可视化流程编辑器（拖拽式路由拓扑画布） |
| **Runs** | Pipeline 执行记录管理 | CRUD、统一 Pipeline Runs 视图（合并 standalone + workflow 来源） |
| **Dashboard** | 仪表板聚合统计 | 资源计数、Skill 分类统计、Agent 可用性统计、WorkflowRun 成功率、最近 5 次执行记录 |
| **Agents** | CLI Coding Agent 集成 | 25+ 社区 Agent 注册发现、Session 管理（自动恢复近期会话）、WebSocket 实时聊天（消息持久化）、配置文件读取（敏感值脱敏）、Playground 交互式对话、Agent History（Session ID 显示 + Detail Modal 预览 + 搜索/过滤/排序/分页）、Thinking 等待动画 |
| **System** | 全局功能 | 健康检查、配置管理、CORS、临时文件定期清理 |

## 快速开始

### 方式一：Docker Compose (推荐)

```bash
docker-compose up
```

- 前端: http://localhost:15173
- 后端 API: http://localhost:18000
- Swagger 文档: http://localhost:18000/docs

### 方式二：本地开发

> Backend 必须先于 Frontend 启动（Vite 会代理 `/api` 到后端）。

```bash
# Terminal 1: Backend (port 18000)
cd backend
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 18000

# Terminal 2: Frontend (port 15173)
cd frontend
npm install
npm run dev
```

## 在线访问

| 服务 | URL |
|------|-----|
| Frontend | https://skill-studio-frontend.wittydesert-1de78f5f.eastus.azurecontainerapps.io |
| Backend API | https://skill-studio-backend.wittydesert-1de78f5f.eastus.azurecontainerapps.io |
| Swagger Docs | https://skill-studio-backend.wittydesert-1de78f5f.eastus.azurecontainerapps.io/docs |

## API 端点

所有业务 API 统一前缀 `/api/v1`，健康检查在根路径。完整 API 文档见 Swagger UI (`/docs`)。

### Health

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |

### Skills

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/skills` | Skill 列表（分页） |
| POST | `/api/v1/skills` | 创建 Skill |
| GET | `/api/v1/skills/preloaded-imports` | 预装包列表 |
| GET | `/api/v1/skills/test-file/{file_id}` | 获取已上传测试文件 |
| GET | `/api/v1/skills/{id}` | Skill 详情 |
| PUT | `/api/v1/skills/{id}` | 更新 Skill |
| PUT | `/api/v1/skills/{id}/configure` | 配置内置 Skill（绑定连接 + 参数） |
| DELETE | `/api/v1/skills/{id}` | 删除 Skill |
| POST | `/api/v1/skills/upload-test-file` | 上传测试文件 |
| POST | `/api/v1/skills/{id}/test` | 测试已保存 Skill |
| POST | `/api/v1/skills/test-code` | 测试未保存代码 |

### Connections

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/connections` | Connection 列表（分页，config 脱敏） |
| GET | `/api/v1/connections/defaults` | 各类型默认 Connection |
| POST | `/api/v1/connections` | 创建 Connection |
| GET | `/api/v1/connections/{id}` | Connection 详情 |
| PUT | `/api/v1/connections/{id}` | 更新 Connection |
| DELETE | `/api/v1/connections/{id}` | 删除 Connection |
| POST | `/api/v1/connections/{id}/test` | 测试连接 |
| PUT | `/api/v1/connections/{id}/set-default` | 设为默认连接 |

### Pipelines

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/pipelines` | Pipeline 列表（分页） |
| POST | `/api/v1/pipelines` | 创建 Pipeline |
| GET | `/api/v1/pipelines/available-skills` | 可用 Skill 列表（含 pipeline_io） |
| GET | `/api/v1/pipelines/templates` | Pipeline 模板列表 |
| GET | `/api/v1/pipelines/{id}` | Pipeline 详情 |
| PUT | `/api/v1/pipelines/{id}` | 更新 Pipeline |
| DELETE | `/api/v1/pipelines/{id}` | 删除 Pipeline |
| POST | `/api/v1/pipelines/{id}/validate` | 验证节点 input source 路径可达性 |
| POST | `/api/v1/pipelines/{id}/debug` | Debug 执行（multipart 上传文件） |

### Dashboard

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/dashboard/stats` | 聚合统计（资源计数、Skill/Agent 分类、WorkflowRun 成功率、最近执行） |

### Data Sources

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/data-sources/upload-quota` | 上传配额信息 |
| POST | `/api/v1/data-sources/upload` | 上传本地文件 |
| GET | `/api/v1/data-sources` | 数据源列表（分页，config 脱敏） |
| POST | `/api/v1/data-sources` | 创建数据源 |
| GET | `/api/v1/data-sources/{id}` | 数据源详情 |
| PUT | `/api/v1/data-sources/{id}` | 更新数据源 |
| GET | `/api/v1/data-sources/{id}/files` | 列出数据源文件 |
| POST | `/api/v1/data-sources/{id}/test` | 测试连通性 |
| DELETE | `/api/v1/data-sources/{id}` | 删除数据源 |

### Targets

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/targets` | 目标列表（分页，config 脱敏） |
| POST | `/api/v1/targets` | 创建目标 |
| GET | `/api/v1/targets/{id}` | 目标详情 |
| PUT | `/api/v1/targets/{id}` | 更新目标 |
| GET | `/api/v1/targets/{id}/discover-schema` | 发现目标 Schema |
| POST | `/api/v1/targets/{id}/create-index` | 创建 AI Search 索引 |
| GET | `/api/v1/targets/{id}/pipeline-outputs` | Pipeline 输出字段推断 |
| POST | `/api/v1/targets/{id}/validate-mapping` | 验证字段映射 |
| POST | `/api/v1/targets/{id}/write` | 写入数据 |
| POST | `/api/v1/targets/{id}/test` | 测试连通性 |
| DELETE | `/api/v1/targets/{id}` | 删除目标 |

### Runs

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/runs` | Run 列表（分页） |
| POST | `/api/v1/runs` | 创建 Run 记录 |
| GET | `/api/v1/runs/{id}` | Run 详情 |

### Pipeline Runs

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/pipeline-runs` | 统一 Pipeline Run 列表（合并 standalone + workflow 来源，可按 source 过滤） |

### Workflows

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/workflows` | Workflow 列表（分页） |
| POST | `/api/v1/workflows` | 创建 Workflow |
| GET | `/api/v1/workflows/{id}` | Workflow 详情 |
| PUT | `/api/v1/workflows/{id}` | 更新 Workflow（含 graph_data 画布数据） |
| DELETE | `/api/v1/workflows/{id}` | 删除 Workflow |
| POST | `/api/v1/workflows/{id}/run` | 触发 Workflow 执行 |

### Workflow Runs

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/workflow-runs` | WorkflowRun 列表（分页，可按 workflow_id 过滤） |
| GET | `/api/v1/workflow-runs/{id}` | WorkflowRun 详情（含 PipelineRun 子记录） |

### Agents

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/agents/available` | 已注册 Agent 列表（含可用性检测） |
| POST | `/api/v1/agents/refresh` | 手动触发 Agent 可用性刷新 |
| GET | `/api/v1/agents/{name}/config` | 读取 Agent 配置文件（敏感值脱敏） |
| POST | `/api/v1/agents/sessions` | 创建 Agent 会话 |
| GET | `/api/v1/agents/sessions` | 会话列表（分页，可按 source 过滤） |
| GET | `/api/v1/agents/sessions/{id}` | 会话详情 |
| DELETE | `/api/v1/agents/sessions/{id}` | 删除会话（级联删除消息） |
| GET | `/api/v1/agents/sessions/{id}/messages` | 会话消息列表（按时间升序） |
| WS | `/api/v1/agents/sessions/{id}/ws` | WebSocket 实时聊天（消息自动持久化） |

### 通用规范

- **分页**: `?page=1&page_size=20` → `{ items, total, page, page_size, total_pages }`
- **成功响应**: 直接返回数据对象，创建返回 201，删除返回 204
- **错误响应**: `{ "code": "NOT_FOUND", "message": "...", "details": null }`
- 详细规格见 `openspec/specs/system/spec.md`

## 技术栈

| 层 | 技术 |
|----|------|
| Backend | Python 3.12, FastAPI >= 0.110, SQLAlchemy 2.0 (async), aiosqlite, Pydantic v2, Alembic |
| Frontend | React 19, TypeScript 5.9, Vite 7, Ant Design 6, Monaco Editor, Zustand, Axios |
| Lint/Test | ruff (lint + format), pytest, tsc -b |
| DevOps | Docker Compose, GitHub Actions CI/CD, Azure Container Apps (OIDC 零密钥) |

## 文档指引

| 文档 | 面向对象 | 内容 |
|------|---------|------|
| `CLAUDE.md` | Claude Code / Agent | 开发流程、编码规范、提交检查、踩坑清单 |
| `openspec/config.yaml` | 所有人 | 技术栈决策、spec 索引 |
| `openspec/specs/` | 开发者 | 22 个模块的系统行为规格（GIVEN/WHEN/THEN） |
| `openspec/changes/archive/` | 开发者 | 37 个已归档的变更（proposal → design → tasks） |
| [GitHub Wiki](../../wiki) | 所有人 | 架构图、模块索引、变更时间线、路线图、新人指南 |

## 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据库 | SQLite (MVP) | 零运维，后续可切换 PostgreSQL |
| ID 策略 | UUID v4 | 避免暴露业务量，支持分布式扩展 |
| Pipeline 编排 | 有序 Skill 节点列表 + Enrichment Tree | 简单直观，通过 context 路径实现扇出执行 |
| 自定义 Skill | Web API + 配置模板 + Python 代码 | 三种方式覆盖不同场景 |
| Skill 执行隔离 | Python venv | 每个 Skill 可有独立依赖 |
| Workflow 编排 | DataSource → Route → Pipeline → Target | 路由规则按优先级匹配文件到不同 Pipeline，增量处理避免重复，React Flow 可视化画布 |
| 认证 | 无 (MVP) | 单用户模式 |

## License

MIT
