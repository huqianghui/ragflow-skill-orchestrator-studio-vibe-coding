## 1. Backend — Pipeline CRUD API 测试

- [x] 1.1 创建 `backend/tests/test_pipelines_api.py`，测试 POST 创建 Pipeline（name 必填、默认 status=draft、默认 graph_data）
- [x] 1.2 测试 GET 列表（分页、排序）和 GET 详情（成功 + 404）
- [x] 1.3 测试 PUT 更新（name、description、status、graph_data 各字段）和 DELETE（成功 + 404）
- [x] 1.4 测试 GET `/available-skills` 和 GET `/templates` 端点返回正确结构

## 2. Backend — Pipeline Debug 端点测试

- [x] 2.1 在 `test_pipelines_api.py` 中新增 Debug 端点测试：上传文件执行成功（mock PipelineRunner）
- [x] 2.2 测试 Debug 端点边界情况：Pipeline 不存在 404、Pipeline 无节点 422

## 3. Backend — Pipeline 验证端点

- [x] 3.1 在 `backend/app/api/pipelines.py` 实现 `POST /{id}/validate` 端点和验证逻辑（遍历按 position 排序节点，检查 source 路径可达性，通配符路径支持）
- [x] 3.2 创建验证端点测试：验证通过（更新 status=validated）、source 路径不可用、空节点、通配符路径

## 4. Frontend — Pipeline E2E 测试

- [x] 4.1 创建 `frontend/e2e/pipeline-crud.spec.ts`：Pipeline 列表页加载、创建新 Pipeline、删除 Pipeline、搜索（使用真实后端 API）
- [x] 4.2 创建 `frontend/e2e/pipeline-editor.spec.ts`：编辑器加载、模式切换、节点展示、保存按钮（使用真实后端 API）

## 5. 验证

- [x] 5.1 运行后端检查: `ruff check .` + `ruff format --check .` + `pytest tests/ -v`
- [x] 5.2 运行前端检查: `npx tsc -b` + `npm run build`
- [x] 5.3 运行 Playwright E2E 测试: `npx playwright test`（需本地启动后端 port 18000）
