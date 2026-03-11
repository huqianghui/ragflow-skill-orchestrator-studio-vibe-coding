# Architecture

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                        │
│  Ant Design + Monaco Editor + React Flow + Zustand           │
│  18 Pages | 15 Components | 11 E2E Tests                    │
│  Port: 15173 (dev) / 80 (prod nginx)                        │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTP /api/v1/*  +  WebSocket /api/v1/agents/sessions/{id}/ws
┌────────────────────▼─────────────────────────────────────────┐
│                   Backend (FastAPI)                            │
│  12 API Modules | 13 ORM Models | 35 Tests                   │
│  Port: 18000                                                  │
├───────────────────────────────────────────────────────────────┤
│  Services Layer                                               │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ Skill Runner │ │Pipeline Runner│ │ Workflow Executor      │ │
│  │ (venv隔离)   │ │(Enrichment   │ │ (路由匹配+增量处理     │ │
│  │             │ │ Tree)        │ │  +执行编排)            │ │
│  └─────────────┘ └──────────────┘ └────────────────────────┘ │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ Builtin     │ │ Data Source  │ │ Target Writer          │ │
│  │ Skills (6类) │ │ Reader      │ │ (6种输出目标)           │ │
│  └─────────────┘ └──────────────┘ └────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Agent Adapters (Claude Code / Codex / Copilot + 社区)   │ │
│  └─────────────────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │   SQLite     │
              │  (async,     │
              │   Alembic)   │
              └──────────────┘
```

## 核心数据流

### Workflow 执行流

```
DataSource(s)            Workflow Router              Pipeline(s)           Target(s)
┌──────────┐         ┌────────────────────┐      ┌──────────────┐     ┌──────────┐
│ Local    │         │ Route 1: *.pdf     │─────▶│ 文档索引      │────▶│ AI Search│
│ Azure    │─files──▶│ Route 2: *.mp4     │─────▶│ 视频处理      │────▶│ Blob     │
│ AWS ...  │         │ Route 3: *.png     │─────▶│ 图片分析      │────▶│ CosmosDB │
└──────────┘         │ Default Route      │─────▶│ 通用处理      │     └──────────┘
                     └────────────────────┘      └──────────────┘
                             │
                     WorkflowRun + PipelineRun 记录
                     增量处理 (etag 检测跳过已处理文件)
```

### Pipeline 执行流

```
Input File
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  Pipeline (有序 Skill 节点列表)                        │
│                                                       │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐          │
│  │ Skill 1 │───▶│ Skill 2 │───▶│ Skill 3 │───▶ ... │
│  │(文档解析)│    │(翻译)    │    │(摘要)    │          │
│  └─────────┘    └─────────┘    └─────────┘          │
│       │              │              │                 │
│       ▼              ▼              ▼                 │
│  ┌────────────────────────────────────────┐          │
│  │        Enrichment Tree (context)       │          │
│  │  /document/content → /document/        │          │
│  │  translated_content → /document/summary │          │
│  └────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────┘
```

### Agent 交互流

```
Frontend (AgentPlayground)
    │
    ├── REST: POST /agents/sessions       ← 创建/恢复会话
    ├── REST: GET  /agents/available      ← Agent 列表
    │
    └── WebSocket: /agents/sessions/{id}/ws
            │
            ▼
    ┌────────────────┐
    │ Session Proxy  │
    │ (消息持久化)    │
    └───────┬────────┘
            │
            ▼
    ┌────────────────┐
    │ Agent Adapter  │
    │ ┌────────────┐ │
    │ │Claude Code │ │
    │ │Codex       │ │
    │ │Copilot     │ │
    │ │社区 Agent   │ │
    │ └────────────┘ │
    └────────────────┘
```

## 模块关系图

```
         Connections
              │
    ┌─────────┼──────────┐
    ▼         ▼          ▼
  Skills  DataSources  Targets
    │         │          │
    ▼         │          │
 Pipelines    │          │
    │         │          │
    └────┬────┘──────────┘
         ▼
     Workflows
         │
         ▼
   WorkflowRuns
    └── PipelineRuns
```

## 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| Backend | FastAPI + async | 高性能异步，原生 OpenAPI 文档 |
| ORM | SQLAlchemy 2.0 async | 类型安全、现代异步支持 |
| DB | SQLite → PostgreSQL | MVP 零运维，后续可切换 |
| Frontend | React 19 + Ant Design | 企业级 UI 组件库 |
| 画布编辑器 | React Flow (@xyflow/react) | 成熟的节点图编辑库 |
| 状态管理 | Zustand | 轻量、无 boilerplate |
| Agent 集成 | WebSocket + subprocess | 实时通信 + CLI Agent 进程管理 |

> 详细技术栈版本见 [`README.md`](../blob/main/README.md#技术栈)
