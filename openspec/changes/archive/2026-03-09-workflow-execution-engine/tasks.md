## 1. Models

- [x] 1.1 创建 WorkflowRun 和 PipelineRun ORM 模型
- [x] 1.2 在 models/__init__.py 导出
- [x] 1.3 创建 Pydantic schemas
- [x] 1.4 更新 Alembic init migration + 新建 migration

## 2. Executor Service

- [x] 2.1 创建 workflow_executor.py — 路由匹配 + 执行编排

## 3. API

- [x] 3.1 新增 POST /workflows/{id}/run 端点
- [x] 3.2 新增 GET/workflow-runs 端点（列表 + 详情）
- [x] 3.3 注册路由

## 4. Tests

- [x] 4.1 WorkflowRun CRUD + 路由匹配测试
- [x] 4.2 ruff + pytest 全部通过

## 5. Frontend

- [x] 5.1 Workflow 列表页添加 Run 按钮和状态列
- [x] 5.2 tsc + build 通过

## 6. 提交

- [ ] 6.1 提交代码并推送，CI/CD 通过
