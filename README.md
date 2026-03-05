# RAGFlow Skill Orchestrator Studio

一个灵活的 Skill 编排工作室，用于构建数据摄取管道（Data Ingestion Pipeline）。灵感来源于 Azure AI Search 的 "Import Data" 功能，但提供更高的定制化能力：自定义 Skill、可视化 Pipeline 构建、快速测试调试。

## 架构概览

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│  Ant Design + React Flow + TypeScript + Zustand           │
│  Port: 5173 (dev) / 80 (prod nginx)                      │
└────────────────────┬─────────────────────────────────────┘
                     │ /api/v1/*
┌────────────────────▼─────────────────────────────────────┐
│                   Backend (FastAPI)                        │
│  SQLAlchemy 2.0 (async) + Pydantic v2 + Alembic           │
│  Port: 8000                                               │
└────────────────────┬─────────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │   SQLite     │
              │  (MVP 阶段)   │
              └─────────────┘
```

## 核心模块

| 模块 | 说明 | 状态 |
|------|------|------|
| **Skills** | Skill 管理 — 内置 + 自定义 (Web API / 配置模板 / Python 代码) | Phase 1 CRUD 完成 |
| **Pipelines** | Pipeline DAG 编排 — 节点管理、字段映射、验证、模板库 | Phase 1 CRUD 完成 |
| **Data Sources** | 数据源管理 — 本地文件上传、Azure Blob Storage | Phase 1 CRUD 完成 |
| **Targets** | 输出目标 — Azure AI Search (Phase 1)，MySQL/PgSQL/CosmosDB/Neo4j (Phase 2) | Phase 1 CRUD 完成 |
| **Runs** | Pipeline 执行 — 同步/异步、步骤可观测性、中间结果、日志 | Phase 1 CRUD 完成 |
| **System** | 健康检查、配置管理、存储清理 | 已实现 |

## 技术栈

### Backend
- **Python 3.12** + **FastAPI** >= 0.110
- **SQLAlchemy 2.0** (async) + **aiosqlite** (SQLite)
- **Pydantic v2** + **pydantic-settings**
- **Alembic** 数据库迁移
- **ruff** 代码规范 + **pytest** 测试

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **Ant Design** UI 组件库
- **React Flow** (@xyflow/react) Pipeline 画布
- **Zustand** 状态管理
- **Axios** HTTP 客户端

### DevOps
- **Docker** + **Docker Compose** 本地开发
- **Azure Container Apps** 生产部署
- **Azure Container Registry (ACR)** 镜像管理
- **GitHub Actions** CI/CD (OIDC 认证，零长期密钥)

## 快速开始

### 方式一：Docker Compose (推荐)

```bash
docker-compose up
```

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000
- Swagger 文档: http://localhost:8000/docs

### 方式二：本地开发

**后端：**
```bash
cd backend
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**前端：**
```bash
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
| Health Check | https://skill-studio-backend.wittydesert-1de78f5f.eastus.azurecontainerapps.io/health |

## API 端点

所有业务 API 统一前缀 `/api/v1`，健康检查在根路径。

| 路径 | 方法 | 说明 |
|------|------|------|
| `GET /health` | GET | 健康检查 |
| `/api/v1/skills` | GET, POST | Skill 列表（分页）/ 创建 |
| `/api/v1/skills/{id}` | GET, PUT, DELETE | Skill 详情 / 更新 / 删除 |
| `/api/v1/pipelines` | GET, POST | Pipeline 列表 / 创建 |
| `/api/v1/pipelines/{id}` | GET, PUT, DELETE | Pipeline 详情 / 更新 / 删除 |
| `/api/v1/data-sources` | GET, POST | 数据源列表 / 创建 |
| `/api/v1/data-sources/{id}` | GET, PUT, DELETE | 数据源详情 / 更新 / 删除 |
| `/api/v1/targets` | GET, POST | 输出目标列表 / 创建 |
| `/api/v1/targets/{id}` | GET, PUT, DELETE | 目标详情 / 更新 / 删除 |
| `/api/v1/runs` | GET, POST | 运行记录列表 / 创建 |
| `/api/v1/runs/{id}` | GET | 运行详情 |

### 分页

列表接口支持分页参数：`?page=1&page_size=20`

响应格式：
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

### 错误响应

```json
{
  "code": "NOT_FOUND",
  "message": "Skill with id 'xxx' not found",
  "details": null
}
```

## 项目结构

```
.
├── backend/                      # FastAPI 后端
│   ├── app/
│   │   ├── main.py               # 应用入口
│   │   ├── config.py             # 配置管理 (pydantic-settings)
│   │   ├── database.py           # 数据库连接
│   │   ├── models/               # SQLAlchemy ORM 模型
│   │   │   ├── base.py           # 基类 (id, created_at, updated_at)
│   │   │   ├── skill.py
│   │   │   ├── pipeline.py
│   │   │   ├── data_source.py
│   │   │   ├── target.py
│   │   │   └── run.py
│   │   ├── schemas/              # Pydantic 请求/响应模型
│   │   ├── api/                  # API 路由
│   │   │   ├── health.py
│   │   │   ├── skills.py
│   │   │   ├── pipelines.py
│   │   │   ├── data_sources.py
│   │   │   ├── targets.py
│   │   │   └── runs.py
│   │   └── utils/                # 异常处理、分页
│   ├── alembic/                  # 数据库迁移
│   ├── tests/                    # pytest 测试
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/                     # React 前端
│   ├── src/
│   │   ├── App.tsx               # 路由配置
│   │   ├── components/
│   │   │   └── AppLayout.tsx     # 侧边栏 + 内容区布局
│   │   ├── pages/                # 8 个页面
│   │   ├── services/api.ts       # Axios API 封装
│   │   └── types/index.ts        # TypeScript 类型定义
│   ├── nginx.conf                # 生产 nginx 配置
│   ├── vite.config.ts
│   └── Dockerfile                # 多阶段构建 (node → nginx)
├── openspec/                     # OpenSpec 需求文档
│   ├── specs/                    # 系统行为规格 (6 个模块)
│   └── changes/                  # 变更提案 (6 个 change)
├── docker-compose.yml
└── .github/workflows/ci.yml      # CI/CD
```

## CI/CD 流程

每次 push 到 `main` 分支自动执行：

```
backend-test ──┐
               ├──→ deploy (ACR build → Container Apps update)
frontend-test ─┘
```

1. **backend-test** — ruff lint + format check + pytest
2. **frontend-test** — TypeScript type check + vite build
3. **deploy** — 构建 Docker 镜像推送 ACR，更新 Azure Container Apps

认证方式：GitHub Actions OIDC → Azure AD federated credentials（零长期密钥）。

## OpenSpec 文档

项目使用 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 管理需求文档：

- `openspec/specs/` — 6 个模块的系统行为规格（Requirement + Scenario + GIVEN/WHEN/THEN）
- `openspec/changes/` — 6 个变更提案（proposal + design + tasks）

### 实现路线图

| # | Change | 说明 | 状态 |
|---|--------|------|------|
| 1 | `init-project-foundation` | 项目脚手架、数据模型、API 框架 | **已完成** |
| 2 | `skill-management` | Skill 执行引擎 + 内置 Skill + Skill 库 | 待实现 |
| 3 | `pipeline-orchestration` | Pipeline DAG 编排 + React Flow 画布 | 待实现 |
| 4 | `datasource-and-execution` | 数据源管理 + 执行引擎 + 日志 | 待实现 |
| 5 | `output-targets` | Azure AI Search 写入 + 字段映射 | 待实现 |
| 6 | `react-frontend` | 完整 React UI | 待实现 |

## 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据库 | SQLite (MVP) | 零运维，后续可切换 PostgreSQL |
| ID 策略 | UUID v4 | 避免暴露业务量，支持分布式扩展 |
| Pipeline 图存储 | JSON 字段 | React Flow 节点/边结构灵活 |
| 异步框架 | 全 async/await | FastAPI 原生支持 |
| 认证 | 无 (MVP) | 单用户模式 |
| 自定义 Skill | Web API + 配置模板 + Python 代码 | 三种方式覆盖不同场景 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/app.db` | 数据库连接 |
| `DEBUG` | `true` | 调试模式 |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | 允许的跨域来源 |
| `MAX_UPLOAD_SIZE_MB` | `100` | 最大上传文件大小 |
| `SYNC_EXECUTION_TIMEOUT_S` | `300` | 同步执行超时 |
| `CLEANUP_RETENTION_DAYS` | `7` | 中间结果保留天数 |
| `LOG_LEVEL` | `INFO` | 日志级别 |

## 开发命令

```bash
# 后端
cd backend
ruff check .                # Lint
ruff format .               # 格式化
pytest -v                   # 测试
alembic revision --autogenerate -m "description"  # 生成迁移
alembic upgrade head        # 执行迁移

# 前端
cd frontend
npm run dev                 # 开发服务器
npm run build               # 构建
npx tsc --noEmit            # 类型检查
```

## License

MIT
