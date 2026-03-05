# 技术设计：项目基础设施搭建

## 1. 项目整体结构

采用前后端分离架构，Monorepo 方式组织代码：

```
ragflow-skill-orchestrator-studio/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI 应用入口
│   │   ├── config.py           # 配置管理
│   │   ├── database.py         # 数据库连接与会话管理
│   │   ├── models/             # SQLAlchemy ORM 模型
│   │   │   ├── __init__.py
│   │   │   ├── base.py         # 模型基类（id, created_at, updated_at）
│   │   │   ├── skill.py
│   │   │   ├── pipeline.py
│   │   │   ├── data_source.py
│   │   │   ├── target.py
│   │   │   └── run.py
│   │   ├── schemas/            # Pydantic 请求/响应模型
│   │   │   ├── __init__.py
│   │   │   ├── skill.py
│   │   │   ├── pipeline.py
│   │   │   ├── data_source.py
│   │   │   ├── target.py
│   │   │   └── run.py
│   │   ├── api/                # API 路由
│   │   │   ├── __init__.py
│   │   │   ├── router.py       # 主路由注册
│   │   │   ├── health.py
│   │   │   ├── skills.py
│   │   │   ├── pipelines.py
│   │   │   ├── data_sources.py
│   │   │   ├── targets.py
│   │   │   └── runs.py
│   │   ├── services/           # 业务逻辑层
│   │   │   └── __init__.py
│   │   └── utils/              # 工具函数
│   │       ├── __init__.py
│   │       ├── pagination.py
│   │       └── exceptions.py
│   ├── alembic/                # 数据库迁移
│   │   ├── alembic.ini
│   │   ├── env.py
│   │   └── versions/
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   └── test_health.py
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/         # 通用组件
│   │   ├── pages/              # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── PipelineEditor.tsx
│   │   │   └── SkillLibrary.tsx
│   │   ├── hooks/              # 自定义 Hooks
│   │   ├── services/           # API 调用层
│   │   │   └── api.ts
│   │   ├── types/              # TypeScript 类型定义
│   │   │   └── index.ts
│   │   └── styles/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci.yml
└── README.md
```

## 2. 后端技术设计

### 2.1 技术栈

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| Web 框架 | FastAPI | >= 0.110 | 高性能异步 API 框架 |
| ORM | SQLAlchemy | >= 2.0 | 使用 2.0 风格的声明式映射 |
| 数据库 | SQLite | - | MVP 阶段使用，后续可切换为 PostgreSQL |
| 数据校验 | Pydantic | v2 | 与 FastAPI 深度集成 |
| 数据库迁移 | Alembic | >= 1.13 | 自动生成迁移脚本 |
| 测试 | pytest + httpx | - | 异步测试支持 |
| 代码规范 | ruff | - | 替代 flake8 + black + isort |

### 2.2 配置管理

使用 Pydantic Settings 管理配置，支持环境变量和 `.env` 文件：

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "RAGFlow Skill Orchestrator Studio"
    debug: bool = True
    database_url: str = "sqlite:///./data/app.db"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = ConfigDict(env_file=".env")
```

### 2.3 数据库连接

使用 SQLAlchemy 2.0 的异步引擎（SQLite 使用 aiosqlite）：

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(
    "sqlite+aiosqlite:///./data/app.db",
    echo=True,  # 开发阶段开启 SQL 日志
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

### 2.4 数据模型

#### 模型基类

所有模型继承统一的基类，提供通用字段：

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import func
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class BaseModel(Base):
    __abstract__ = True

    id: Mapped[str] = mapped_column(
        primary_key=True, default=lambda: str(uuid.uuid4())
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

#### 核心模型定义

**Skill（技能）** -- 可复用的处理单元：

```python
class Skill(BaseModel):
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(index=True)
    description: Mapped[str | None]
    skill_type: Mapped[str]          # 如 "document_parser", "embedding", "indexer"
    config_schema: Mapped[dict]       # JSON Schema，定义该 Skill 需要的配置参数
    is_builtin: Mapped[bool] = mapped_column(default=False)
```

**Pipeline（管道）** -- Skill 的编排流程：

```python
class Pipeline(BaseModel):
    __tablename__ = "pipelines"

    name: Mapped[str] = mapped_column(index=True)
    description: Mapped[str | None]
    status: Mapped[str] = mapped_column(default="draft")  # draft, active, archived
    graph_data: Mapped[dict]          # React Flow 导出的节点和边数据（JSON）
```

**DataSource（数据源）** -- Pipeline 的输入：

```python
class DataSource(BaseModel):
    __tablename__ = "data_sources"

    name: Mapped[str]
    source_type: Mapped[str]          # "local_file", "blob_storage", "database", "api"
    connection_config: Mapped[dict]   # 连接配置（JSON）
    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"))
```

**Target（目标）** -- Pipeline 的输出：

```python
class Target(BaseModel):
    __tablename__ = "targets"

    name: Mapped[str]
    target_type: Mapped[str]          # "knowledge_base", "vector_store", "database"
    connection_config: Mapped[dict]
    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"))
```

**Run（运行记录）** -- Pipeline 的执行历史：

```python
class Run(BaseModel):
    __tablename__ = "runs"

    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"))
    status: Mapped[str] = mapped_column(default="pending")
    # pending -> running -> completed / failed
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]
    error_message: Mapped[str | None]
    metrics: Mapped[dict | None]      # 运行指标（处理条数、耗时等）
```

### 2.5 API 路由结构

所有 API 统一前缀 `/api/v1`，遵循 RESTful 风格：

| 路径 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查（无前缀） |
| `/api/v1/skills` | GET | 获取 Skill 列表（分页） |
| `/api/v1/skills` | POST | 创建 Skill |
| `/api/v1/skills/{id}` | GET | 获取 Skill 详情 |
| `/api/v1/skills/{id}` | PUT | 更新 Skill |
| `/api/v1/skills/{id}` | DELETE | 删除 Skill |
| `/api/v1/pipelines` | GET | 获取 Pipeline 列表 |
| `/api/v1/pipelines` | POST | 创建 Pipeline |
| `/api/v1/pipelines/{id}` | GET | 获取 Pipeline 详情 |
| `/api/v1/pipelines/{id}` | PUT | 更新 Pipeline |
| `/api/v1/pipelines/{id}` | DELETE | 删除 Pipeline |
| `/api/v1/pipelines/{id}/run` | POST | 触发 Pipeline 执行 |
| `/api/v1/data-sources` | GET/POST | 数据源 CRUD |
| `/api/v1/targets` | GET/POST | 目标 CRUD |
| `/api/v1/runs` | GET | 获取运行记录 |
| `/api/v1/runs/{id}` | GET | 获取运行详情 |

### 2.6 统一响应格式与错误处理

#### 分页响应

```python
class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
```

#### 错误响应

```python
class ErrorResponse(BaseModel):
    code: str           # 错误码，如 "NOT_FOUND", "VALIDATION_ERROR"
    message: str        # 人类可读的错误信息
    details: dict | None = None

# 全局异常处理器
@app.exception_handler(AppException)
async def app_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(code=exc.code, message=exc.message).model_dump(),
    )
```

### 2.7 数据库迁移策略

使用 Alembic 进行版本化迁移管理：

```bash
# 初始化 Alembic
alembic init alembic

# 生成迁移脚本（自动检测模型变更）
alembic revision --autogenerate -m "init tables"

# 执行迁移
alembic upgrade head

# 回滚
alembic downgrade -1
```

配置 Alembic 的 `env.py` 使其自动发现所有 SQLAlchemy 模型，确保 `--autogenerate` 正常工作。

## 3. 前端技术设计

### 3.1 技术栈

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| 框架 | React 18 | 组件化 UI |
| 语言 | TypeScript | 类型安全 |
| 构建工具 | Vite | 快速 HMR |
| 路由 | React Router v6 | SPA 路由 |
| 画布 | React Flow | Pipeline 可视化编排 |
| HTTP 客户端 | Axios | API 调用 |
| 状态管理 | Zustand | 轻量级状态管理 |
| UI 组件库 | Ant Design | 企业级 UI 组件 |

### 3.2 页面结构

MVP 阶段包含以下页面：

- **Dashboard** (`/`)：概览页面，展示 Pipeline 列表和运行状态
- **Pipeline Editor** (`/pipelines/:id/edit`)：核心页面，使用 React Flow 拖拽编排 Skill
- **Skill Library** (`/skills`)：Skill 管理和浏览
- **Run History** (`/runs`)：运行历史记录

### 3.3 TypeScript 类型定义

```typescript
interface Skill {
  id: string;
  name: string;
  description?: string;
  skill_type: string;
  config_schema: Record<string, unknown>;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "archived";
  graph_data: {
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
  created_at: string;
  updated_at: string;
}

interface Run {
  id: string;
  pipeline_id: string;
  status: "pending" | "running" | "completed" | "failed";
  started_at?: string;
  finished_at?: string;
  error_message?: string;
  metrics?: Record<string, unknown>;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
```

### 3.4 API 调用层

封装统一的 API 调用客户端：

```typescript
import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
  timeout: 30000,
});

// 响应拦截器：统一错误处理
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || "请求失败";
    notification.error({ message });
    return Promise.reject(error);
  }
);
```

## 4. Docker 开发环境

### docker-compose.yml

```yaml
version: "3.8"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend/app:/app/app          # 热重载
      - ./backend/data:/app/data        # SQLite 数据文件持久化
    environment:
      - DEBUG=true
      - DATABASE_URL=sqlite+aiosqlite:///./data/app.db
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src         # 热重载
    environment:
      - VITE_API_BASE_URL=http://localhost:8000/api/v1
    command: npm run dev -- --host 0.0.0.0
```

### Backend Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e ".[dev]"
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Frontend Dockerfile

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json .
RUN npm ci
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

## 5. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据库 | SQLite | MVP 阶段零运维成本，单文件部署；后续可通过更换连接字符串切换为 PostgreSQL |
| ID 策略 | UUID v4（字符串） | 避免自增 ID 暴露业务量，便于分布式扩展 |
| Pipeline 图数据存储 | JSON 字段 | React Flow 的节点/边数据结构灵活，适合以 JSON 形式存储 |
| 异步框架 | 全异步（async/await） | FastAPI 原生支持，为后续并发处理 Pipeline 执行做准备 |
| API 版本 | URL 前缀 `/api/v1` | 简单直观，便于后续版本升级 |
