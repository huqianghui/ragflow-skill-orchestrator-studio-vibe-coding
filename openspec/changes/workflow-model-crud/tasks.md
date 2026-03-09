## 1. Backend Model & Schema

- [ ] 1.1 创建 `backend/app/models/workflow.py` — Workflow ORM 模型
- [ ] 1.2 在 `backend/app/models/__init__.py` 中导出 Workflow 模型
- [ ] 1.3 创建 `backend/app/schemas/workflow.py` — WorkflowCreate / WorkflowUpdate / WorkflowResponse + Route 子结构

## 2. Database Migration

- [ ] 2.1 更新 Alembic init migration (`d750dfb7d5f0`) 加入 workflows 表
- [ ] 2.2 新建 Alembic migration 添加 workflows 表
- [ ] 2.3 执行 `alembic upgrade head` 验证

## 3. Backend API

- [ ] 3.1 创建 `backend/app/api/workflows.py` — CRUD 路由 (POST/GET/PUT/DELETE)
- [ ] 3.2 在 `backend/app/api/router.py` 中注册 workflows 路由

## 4. Backend Tests

- [ ] 4.1 创建 `backend/tests/test_workflows.py` — Workflow CRUD 单元测试
- [ ] 4.2 运行 `ruff check` + `ruff format --check` + `pytest` 全部通过

## 5. OpenSpec

- [ ] 5.1 创建 `openspec/specs/workflows/spec.md` — 从 change specs 同步

## 6. Frontend

- [ ] 6.1 新增 `frontend/src/services/api.ts` 中的 Workflow API 客户端方法
- [ ] 6.2 新增 `frontend/src/types/index.ts` 中的 Workflow 类型定义
- [ ] 6.3 创建 `frontend/src/pages/Workflows.tsx` — 列表页 + 创建/编辑 Modal
- [ ] 6.4 在 `frontend/src/App.tsx` 中注册 /workflows 路由
- [ ] 6.5 在 AppLayout 导航中添加 Workflows 入口
- [ ] 6.6 运行 `npx tsc -b` + `npm run build` 全部通过

## 7. E2E & 提交

- [ ] 7.1 运行 Playwright E2E 测试确保无回归
- [ ] 7.2 提交代码并推送，确保 CI/CD 通过
