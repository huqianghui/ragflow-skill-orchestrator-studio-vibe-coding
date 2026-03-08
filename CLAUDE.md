# CLAUDE.md — Agentic RAGFlow Studio

> **定位**: 这是 Claude Code 的工程操作手册 — 只关注 **HOW**（怎么开发），不重复 **WHAT**（系统做什么）。
> 产品需求、API 契约、数据模型等 WHAT 内容由 `openspec/` 管理。
> 本文件中的所有指令 OVERRIDE 默认行为，MUST 严格遵循。

---

## 1. 文档分层体系

```
CLAUDE.md                     ← 工程手册：HOW（流程、规范、约束、踩坑）
openspec/
  ├── config.yaml             ← 项目元信息：WHO + WHAT 概览（技术栈、决策）
  ├── specs/                  ← 产品规格：WHAT 详细（需求场景、API 契约、数据模型）
  └── changes/                ← 变更追踪：WHY + WHEN（每次功能变更的 proposal → design → tasks）
```

### 查阅指引

| 你想知道… | 去看… |
|-----------|-------|
| 项目用了什么技术栈？有哪些关键决策？ | `openspec/config.yaml` |
| 某个模块的 API 接口、字段结构、行为规格？ | `openspec/specs/<module>/spec.md` |
| 某个功能是怎么设计的？为什么这么做？ | `openspec/changes/archive/<date>-<name>/` |
| 当前正在开发的变更？ | `openspec/changes/` (非 archive 目录) |
| 怎么跑项目？提交前要做什么？代码怎么写？ | **本文件 (CLAUDE.md)** |

### 不重叠原则

- **CLAUDE.md 绝不重复** openspec 中已有的产品规格（API 格式、字段定义、Skill 列表等）
- 需要引用产品规格时，**写路径引用**，不复制内容
- 唯一的例外：编码约定中的"简短提醒"（如 "201 for create, 204 for delete"）可以保留，因为这是编码操作指引

---

## 2. OpenSpec 驱动的开发流程

每个功能变更遵循三步走：

```
/openspec-propose  →  /openspec-apply-change  →  /openspec-archive-change
   (提案)                (逐 task 实现)               (归档 + 同步 specs)
```

### 关键原则

- `openspec/specs/` 是**活文档**，是系统行为的唯一真相源
- 实现代码前**先读相关 spec**，确保理解需求
- 每个 change 的 `tasks.md` 中的 task 应能独立实现
- 提 change 前先看现有 specs，避免冲突

---

## 3. 项目结构速查

```
backend/
  app/
    api/           # FastAPI 路由: health, skills, connections, pipelines,
                   #   runs, targets, data_sources, agents
    models/        # SQLAlchemy ORM (10 模型): connection, skill, pipeline, run,
                   #   data_source, target, agent_session, agent_config, agent_message
    schemas/       # Pydantic 请求/响应 schema:
                   #   skill, connection, pipeline, run, data_source, target, agent, common
    services/      # 业务逻辑层
                   #   skill_runner, venv_manager, skill_seeder, skill_context
                   #   upload_manager, temp_file_manager
                   #   data_source_tester, target_tester, target_writer
                   #   target_index_manager, target_schema_discovery, mapping_engine
                   #   builtin_skills/ (base, runner, 7 类内置 Skill 实现)
                   #   pipeline/ (enrichment_tree, runner)
                   #   agents/ (base, registry, session_proxy, context_builder,
                   #            adapters/: claude_code, codex, copilot)
    utils/         # 工具类 (encryption, exceptions, pagination, time)
    data/          # 内置数据定义 (builtin_skills, pipeline_templates, pipeline_defaults)
    config.py      # pydantic-settings 配置
    database.py    # 异步引擎 & session 工厂
    main.py        # FastAPI app, lifespan, 路由注册, 后台刷新任务
  alembic/         # 数据库迁移脚本
  tests/           # pytest 测试 (27 个测试文件)
  data/            # 运行时数据 (app.db, venvs/, uploads/) — 不提交
  pyproject.toml   # 依赖、ruff 配置、pytest 配置

frontend/
  src/
    pages/         # 15 个路由级页面组件 (Dashboard, SkillLibrary, SkillEditor,
                   #   BuiltinSkillEditor, Connections, Pipelines, PipelineEditor,
                   #   DataSources, DataSourceNew, Targets, TargetNew,
                   #   RunHistory, Settings, AgentPlayground, AgentHistory)
    components/    # 可复用 UI 组件:
                   #   AppLayout, PageHeader, ListToolbar, TableUtils,
                   #   ConfigSchemaForm, ThemeSwitcher
                   #   agent/ (AgentChatWidget, AgentSelector, AgentIcon,
                   #           SessionBar, ModeBar, MessageBubble, ContextPanel,
                   #           AgentDetailPanel, ApplyActions)
    services/      # API 客户端 (axios): api.ts, agentApi.ts
    stores/        # Zustand 状态管理: themeStore.ts
    utils/         # 工具函数: time.ts (UTC 时间处理)
    types/         # TypeScript 类型定义: index.ts, agent.ts
  e2e/             # Playwright E2E 测试 (5 个 spec 文件):
                   #   agent-playground, agent-history-table, agent-session-restore,
                   #   agent-chat-ui, editor-layout
  public/
    icons/         # SVG 图标 (data-sources/, targets/)

openspec/          # 产品规格 — 19 个 spec (详见上方文档分层体系)
```

---

## 4. 本地开发

### 启动顺序 (CRITICAL)

Backend 必须先于 Frontend 启动（Vite 会代理 `/api` 到后端）。

```bash
# Terminal 1: Backend (port 18000)
cd backend && uvicorn app.main:app --reload --port 18000

# Terminal 2: Frontend (port 15173)
cd frontend && npm run dev
```

- Swagger UI: http://localhost:18000/docs
- API 前缀: `/api/v1`
- 前端出现 `ECONNREFUSED` = 后端没启动，不是代码 bug

---

## 5. 提交前检查 (CRITICAL)

**每次代码变更，提交前 MUST 全部通过：**

```bash
# Backend (每次都跑)
cd backend
ruff check .              # lint 错误
ruff format --check .     # 格式检查 (比 ruff check 更严格!)
pytest tests/ -v          # 全部测试通过

# Frontend (改了 .tsx/.ts 文件才需要)
cd frontend
npx tsc -b                # TypeScript 类型检查 (未使用 import = 硬错误!)
npm run build             # 完整 Vite 构建
```

`ruff format --check` 失败时：跑 `ruff format <files>` 自动修复，再 review 改动。

---

## 6. 编码规范

### Python / Backend

- **行宽**: 100 字符 (见 `pyproject.toml`)
- **Import 顺序**: stdlib → third-party → local (ruff I001 强制)
- **禁止未使用 import** (ruff F401)
- **全异步**: 所有 DB 操作用 `async/await` + `AsyncSession`
- **路由顺序**: 静态路径 (`/defaults`) 必须定义在参数化路径 (`/{id}`) **之前**
- **API 惯例**: 创建返回 201, 删除返回 204, 直接返回数据对象无外层包装
  - → 完整格式规范见 `openspec/specs/system/spec.md`

### TypeScript / Frontend

- **未使用 import = 构建失败** (TS6133, `tsc -b` 视为硬错误)
- **状态管理**: Zustand (不用 Redux / Context)
- **API 调用**: 通过 `services/` 层使用 Axios
- **UI 框架**: Ant Design (`antd`) 全部 UI 元素
- **严格模式**: TypeScript strict 已开启

### 多语言 / i18n (CRITICAL)

平台必须支持中文、日文、韩文等非 ASCII 内容。

- **HTTP headers**: 绝不放裸 Unicode。用 RFC 5987:
  ```python
  encoded = urllib.parse.quote(filename)
  headers = {"Content-Disposition": f"inline; filename*=UTF-8''{encoded}"}
  ```
- **文件名**: 放入 headers / URLs / shell 命令前必须 `urllib.parse.quote()`
- **测试心态**: 每个涉及用户文本的功能，心里都用 `文档分析报告.pdf` 测一遍

---

## 7. 数据库规则 (CRITICAL)

### 禁止删除 `backend/data/app.db`

DB 包含用户手动创建的 connections、skills、pipelines。已在 `.gitignore` 排除。

### Schema 变更必须走 Alembic

`create_all()` 只建新表，不改已有表。修改模型（加/删/改列）时 **必须** 全做：

1. 更新 **init migration** (`alembic/versions/d750dfb7d5f0_init_tables.py`)
2. 写 **新 Alembic migration**
3. 执行 `alembic upgrade head`

自动守护: `test_schema_integrity.py::test_alembic_migration_matches_models` 在 CI 中检测漂移。

### Model 导入

`main.py` 必须 `from app.models import Base` (不是 `from app.models.base`)，确保所有 model 注册到 `Base.metadata`。

---

## 8. CI Pipeline

GitHub Actions 在 push/PR 到 `main` 时运行 (`.github/workflows/ci.yml`):

| Job | 步骤 |
|-----|------|
| `backend-test` | `ruff check .` → `ruff format --check .` → `pytest -v` |
| `frontend-test` | `npm ci` → `npx tsc -b` → `npm run build` |
| `deploy` | 构建 Docker → 推送 ACR → 部署 Azure Container Apps |

---

## 9. 踩坑清单

| # | 陷阱 | 教训 |
|---|------|------|
| 1 | `ruff check` ≠ `ruff format` | lint 通过不代表格式通过，两个都跑 |
| 2 | 中文长行 | 中文字符看着短但字符数多，用括号换行拼接 |
| 3 | TS 未使用 import | CI 的 `tsc -b` 会失败，本地 `--noEmit` 不够 |
| 4 | Alembic 漂移 | 加 model 列但没更新 init migration → 新环境崩溃 |
| 5 | FastAPI 路由顺序 | `/defaults` 必须在 `/{id}` 前面 |
| 6 | HTTP header 中文 | `UnicodeEncodeError`，必须 URL-encode |
| 7 | 前端 ECONNREFUSED | 后端没启动，不是代码问题 |
| 8 | WebSocket handler DB | Agent WS 用 `AsyncSessionLocal()`（不走 Depends），测试 mock `session_proxy` |
| 9 | UTC 时间偏移 | 后端 SQLite `func.now()` 返回 UTC 无 Z 后缀，前端解析前需追加 `Z` |

---

## 10. 本地工具路径

- pytest: `/opt/homebrew/bin/pytest` (macOS Homebrew)
- 测试 conftest: `backend/tests/conftest.py` (内存 SQLite, 依赖覆盖)
