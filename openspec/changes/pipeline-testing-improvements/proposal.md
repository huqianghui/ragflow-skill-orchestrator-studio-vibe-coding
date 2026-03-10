## Why

Pipeline 模块是系统的核心数据处理编排引擎，但当前测试覆盖严重不足。后端 CRUD API 没有独立测试文件（仅在 `test_health.py` 中有最小化的 POST+GET），最复杂的 Debug 端点完全未测试，Templates/Available-skills 端点未测试。前端 E2E 仅测试编辑器布局，没有任何功能测试。此外，Spec 中定义的 Pipeline 验证逻辑（source 路径可达性检查）在后端代码中完全没有实现。需要补充全面的测试并实现缺失的验证逻辑，确保模块的可靠性。

## What Changes

### 后端测试补全
- 新增 `test_pipelines_api.py`：全面测试 Pipeline CRUD 端点（创建、列表、详情、更新、删除、404 路径）
- 新增对 `/available-skills` 和 `/templates` 端点的测试
- 新增对 `POST /{id}/debug` 端点的测试（文件上传执行、超时 partial 返回、空节点 422 错误）
- 补充 PipelineRunner 的 connection 三级优先级解析测试

### 后端功能补全
- 实现 Pipeline 验证逻辑：检查所有节点的 input source 路径是否可从前序节点的输出中解析
- 添加 `POST /api/v1/pipelines/{id}/validate` 端点
- 验证通过自动更新 `status=validated`

### 前端 E2E 功能测试
- Pipeline 列表页：创建（空白 + 模板）、搜索、删除
- Pipeline 编辑器：添加节点、配置输入输出、保存、JSON 导入导出
- Pipeline Debug：文件上传执行、结果展示

## Capabilities

### New Capabilities

(无新 capability)

### Modified Capabilities

- `pipelines`: 新增验证端点 `POST /validate`，验证逻辑实现

## Impact

- 后端: 新增 `backend/app/api/pipelines.py` 验证端点、新增 3+ 个测试文件
- 前端: 新增 `frontend/e2e/pipeline-crud.spec.ts` 和 `frontend/e2e/pipeline-editor.spec.ts`
- 不影响现有 API 行为，验证端点为新增
