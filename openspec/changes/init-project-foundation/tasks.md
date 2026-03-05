# 实施任务清单：项目基础设施搭建

## 概览

本文档列出 `init-project-foundation` 变更的所有实施任务。任务按模块分组，标注优先级和依赖关系。

---

## 1. 后端脚手架搭建

### 1.1 项目初始化

- [ ] 创建 `backend/` 目录结构
- [ ] 编写 `pyproject.toml`，定义项目依赖：
  - FastAPI >= 0.110
  - SQLAlchemy >= 2.0
  - aiosqlite
  - Pydantic v2
  - pydantic-settings
  - Alembic >= 1.13
  - uvicorn
  - 开发依赖：pytest, httpx, ruff, pytest-asyncio
- [ ] 创建 `app/__init__.py`, `app/main.py` 入口文件
- [ ] 配置 FastAPI 应用实例（标题、描述、版本号、CORS 中间件）

### 1.2 配置管理

- [ ] 创建 `app/config.py`，使用 Pydantic Settings 管理配置
- [ ] 支持 `.env` 文件加载
- [ ] 定义配置项：`database_url`, `debug`, `api_prefix`, `cors_origins`
- [ ] 创建 `.env.example` 模板文件

### 1.3 数据库连接

- [ ] 创建 `app/database.py`
- [ ] 配置 SQLAlchemy 异步引擎（`create_async_engine`）
- [ ] 配置异步 Session 工厂（`async_sessionmaker`）
- [ ] 实现 `get_db` 依赖注入函数
- [ ] 确保 `data/` 目录存在（SQLite 文件存放位置）

---

## 2. 数据模型与迁移

### 2.1 ORM 模型定义

- [ ] 创建 `app/models/base.py` -- 模型基类（id, created_at, updated_at）
- [ ] 创建 `app/models/skill.py` -- Skill 模型
  - 字段：name, description, skill_type, config_schema (JSON), is_builtin
- [ ] 创建 `app/models/pipeline.py` -- Pipeline 模型
  - 字段：name, description, status, graph_data (JSON)
- [ ] 创建 `app/models/data_source.py` -- DataSource 模型
  - 字段：name, source_type, connection_config (JSON), pipeline_id (FK)
- [ ] 创建 `app/models/target.py` -- Target 模型
  - 字段：name, target_type, connection_config (JSON), pipeline_id (FK)
- [ ] 创建 `app/models/run.py` -- Run 模型
  - 字段：pipeline_id (FK), status, started_at, finished_at, error_message, metrics (JSON)
- [ ] 创建 `app/models/__init__.py`，统一导出所有模型

### 2.2 Pydantic Schema 定义

- [ ] 为每个模型创建对应的 Pydantic Schema（Create / Update / Response）
- [ ] 创建 `app/schemas/common.py` -- 通用 Schema（PaginatedResponse, ErrorResponse）
- [ ] 确保 Schema 与 ORM 模型字段对齐

### 2.3 数据库迁移

- [ ] 初始化 Alembic（`alembic init`）
- [ ] 配置 `alembic/env.py`，正确引入所有模型的 metadata
- [ ] 配置 `alembic.ini`，使用与应用相同的 database_url
- [ ] 生成初始迁移脚本（`alembic revision --autogenerate -m "init tables"`）
- [ ] 验证迁移脚本内容正确
- [ ] 执行迁移（`alembic upgrade head`），确认表结构正确

---

## 3. API 框架搭建

### 3.1 路由结构

- [ ] 创建 `app/api/router.py` -- 主路由，注册所有子路由
- [ ] 创建 `app/api/health.py` -- 健康检查端点
  - `GET /health` 返回 `{ "status": "ok", "version": "0.1.0" }`
- [ ] 创建 `app/api/skills.py` -- Skill CRUD 路由（空壳，返回 501）
- [ ] 创建 `app/api/pipelines.py` -- Pipeline CRUD 路由（空壳，返回 501）
- [ ] 创建 `app/api/data_sources.py` -- DataSource CRUD 路由（空壳）
- [ ] 创建 `app/api/targets.py` -- Target CRUD 路由（空壳）
- [ ] 创建 `app/api/runs.py` -- Run 查询路由（空壳）
- [ ] 在 `main.py` 中注册主路由，设置 `/api/v1` 前缀

### 3.2 错误处理

- [ ] 创建 `app/utils/exceptions.py` -- 自定义异常类
  - `AppException`（基类）
  - `NotFoundException`
  - `ValidationException`
  - `ConflictException`
- [ ] 在 `main.py` 中注册全局异常处理器
- [ ] 统一错误响应格式 `{ "code": "...", "message": "...", "details": null }`

### 3.3 分页支持

- [ ] 创建 `app/utils/pagination.py`
- [ ] 实现分页查询参数依赖（page, page_size，带默认值和上限）
- [ ] 实现分页响应构造函数

---

## 4. 前端脚手架搭建

### 4.1 项目初始化

- [ ] 使用 Vite 创建 React + TypeScript 项目（`npm create vite@latest`）
- [ ] 安装核心依赖：
  - react-router-dom
  - reactflow
  - axios
  - zustand
  - antd
- [ ] 安装开发依赖：
  - eslint + typescript-eslint
  - prettier
- [ ] 配置 `vite.config.ts`（开发代理指向后端）

### 4.2 基础布局

- [ ] 创建应用主布局组件（侧边栏 + 顶栏 + 内容区）
- [ ] 配置 React Router 路由表：
  - `/` -- Dashboard 页面
  - `/pipelines/:id/edit` -- Pipeline 编辑器
  - `/skills` -- Skill 库
  - `/runs` -- 运行历史
- [ ] 创建各页面的占位组件

### 4.3 API 调用层

- [ ] 创建 `src/services/api.ts` -- Axios 实例配置
- [ ] 配置请求/响应拦截器
- [ ] 定义环境变量 `VITE_API_BASE_URL`

### 4.4 TypeScript 类型定义

- [ ] 创建 `src/types/index.ts`
- [ ] 定义核心类型：Skill, Pipeline, DataSource, Target, Run
- [ ] 定义通用类型：PaginatedResponse, ErrorResponse

---

## 5. Docker 开发环境

- [ ] 编写 `backend/Dockerfile`（基于 python:3.12-slim）
- [ ] 编写 `frontend/Dockerfile`（基于 node:20-slim）
- [ ] 编写 `docker-compose.yml`
  - backend 服务：端口 8000，挂载代码目录实现热重载
  - frontend 服务：端口 5173，挂载 src 目录实现热重载
- [ ] 添加 `.dockerignore` 文件（排除 node_modules, __pycache__, .venv 等）
- [ ] 验证 `docker-compose up` 可一键启动所有服务

---

## 6. 健康检查与冒烟测试

- [ ] 实现后端 `GET /health` 端点
  - 返回应用状态、版本号
  - 检测数据库连接是否正常
- [ ] 编写 `tests/test_health.py` 测试用例
  - 验证返回状态码 200
  - 验证响应体包含 `status: "ok"`
- [ ] 编写 `tests/conftest.py`
  - 配置测试数据库（使用内存 SQLite）
  - 创建测试用 AsyncClient

---

## 7. CI 基础配置

- [ ] 创建 `.github/workflows/ci.yml`
- [ ] 配置后端 CI 步骤：
  - 安装 Python 依赖
  - 运行 `ruff check`（Linting）
  - 运行 `ruff format --check`（格式检查）
  - 运行 `pytest`（单元测试）
- [ ] 配置前端 CI 步骤：
  - 安装 Node.js 依赖
  - 运行 `eslint`
  - 运行 `tsc --noEmit`（类型检查）
  - 运行 `npm run build`（构建验证）

---

## 任务依赖关系

```
1.1 项目初始化
 └── 1.2 配置管理
      └── 1.3 数据库连接
           └── 2.1 ORM 模型
                ├── 2.2 Pydantic Schema
                │    └── 3.1 路由结构
                └── 2.3 数据库迁移
                     └── 6. 健康检查与冒烟测试

4.1 前端初始化
 └── 4.2 基础布局
      └── 4.3 API 调用层

5. Docker（可与 1-4 并行，最后集成验证）
7. CI（最后配置）
```

## 验收标准

1. `docker-compose up` 成功启动前后端服务
2. `curl http://localhost:8000/health` 返回 `{"status": "ok"}`
3. 浏览器访问 `http://localhost:5173` 可看到基础页面布局
4. `alembic upgrade head` 成功创建所有数据表
5. `pytest` 通过所有测试用例
6. `ruff check` 和 `ruff format --check` 无报错
7. 前端 `tsc --noEmit` 无类型错误
