# Dev Onboarding

新人上手指南 — 链接到各文档的对应章节，避免重复。

## 第一步：理解项目

1. 阅读 [`README.md`](../blob/main/README.md) — 了解项目做什么、核心模块、API 概览
2. 浏览 [Architecture](Architecture) — 理解系统架构和数据流
3. 查看 [Module Index](Module-Index) — 22 个模块的一句话摘要

## 第二步：搭建环境

按 [`CLAUDE.md § 4. 本地开发`](../blob/main/CLAUDE.md#4-本地开发) 操作：

```bash
# Terminal 1: Backend (port 18000)
cd backend && pip install -e ".[dev]" && alembic upgrade head
uvicorn app.main:app --reload --port 18000

# Terminal 2: Frontend (port 15173)
cd frontend && npm install && npm run dev
```

> Backend 必须先于 Frontend 启动（Vite 代理 `/api` 到后端）

## 第三步：了解开发规范

| 主题 | 文档位置 |
|------|---------|
| 提交前检查 | [`CLAUDE.md § 5`](../blob/main/CLAUDE.md#5-提交前检查-critical) |
| Python 编码规范 | [`CLAUDE.md § 6`](../blob/main/CLAUDE.md#6-编码规范) |
| TypeScript 编码规范 | [`CLAUDE.md § 6`](../blob/main/CLAUDE.md#6-编码规范) |
| 数据库迁移 | [`CLAUDE.md § 7`](../blob/main/CLAUDE.md#7-数据库规则-critical) |
| 多语言/i18n | [`CLAUDE.md § 6`](../blob/main/CLAUDE.md#6-编码规范) |
| 常见踩坑 | [`CLAUDE.md § 9`](../blob/main/CLAUDE.md#9-踩坑清单) |

## 第四步：理解开发流程

本项目使用 **OpenSpec 驱动开发**，每个功能变更遵循：

```
/opsx:propose  →  /opsx:apply  →  /opsx:archive
   (提案)            (逐 task 实现)    (归档 + 同步 specs)
```

- Spec 目录：[`openspec/specs/`](../tree/main/openspec/specs) — 22 个模块的行为规格
- 变更归档：[`openspec/changes/archive/`](../tree/main/openspec/changes/archive) — 37 个已完成变更
- 详见 [`CLAUDE.md § 2`](../blob/main/CLAUDE.md#2-openspec-驱动的开发流程)

## 第五步：运行测试

```bash
# Backend
cd backend
ruff check .              # lint
ruff format --check .     # 格式
pytest tests/ -v          # 35 个测试文件

# Frontend
cd frontend
npx tsc -b                # TypeScript 类型检查
npm run build             # Vite 构建

# E2E (需要 backend + frontend 都在运行)
cd frontend
npx playwright install chromium
npx playwright test       # 11 个 spec 文件
```

## 关键路径速查

| 你要找… | 路径 |
|---------|------|
| API 路由 | `backend/app/api/` |
| 数据模型 | `backend/app/models/` |
| 业务逻辑 | `backend/app/services/` |
| 前端页面 | `frontend/src/pages/` |
| 前端组件 | `frontend/src/components/` |
| E2E 测试 | `frontend/e2e/` |
| 模块规格 | `openspec/specs/<module>/spec.md` |
