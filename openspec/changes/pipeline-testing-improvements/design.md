## Context

Pipeline 模块已完成核心功能（CRUD、模板、编辑器、Debug 执行），但测试覆盖严重不足：

- 后端：仅有 `test_health.py` 中 2 个最小化断言，无独立 CRUD 测试、无 Debug 端点测试、无 Templates/Available-skills 测试
- 前端 E2E：仅有 `editor-layout.spec.ts` 测试布局完整性，无功能测试
- Spec 中定义的 Pipeline 验证逻辑（source 路径可达性检查）在代码中完全没有实现

现有服务层（PipelineRunner + EnrichmentTree）测试较好（35+ 测试用例），但 API 层和前端功能层几乎是空白。

## Goals / Non-Goals

**Goals:**

- 为 Pipeline CRUD API 建立全面的后端测试（创建、读取、更新、删除、404、分页）
- 测试 `/available-skills` 和 `/templates` 端点
- 测试 `/debug` 端点（文件上传执行、空节点验证）
- 实现 `POST /validate` 端点：检查所有节点 input source 路径的可达性
- 新增 Playwright E2E 测试：Pipeline 列表页 CRUD 操作、编辑器基础功能

**Non-Goals:**

- 不重构 PipelineEditor 组件（虽然 1700+ 行过大，但这是代码质量问题，不在本次范围）
- 不改变现有 API 行为
- 不测试 PipelineRunner 的内部逻辑（已有充分覆盖）
- 不实现异步执行模式（Phase 2 范围）

## Decisions

### 1. 验证逻辑放在独立端点

**选择**: 新增 `POST /api/v1/pipelines/{id}/validate` 端点
**替代方案**: 在 PUT 更新时自动验证
**理由**: 用户可能在编辑过程中保存不完整的 Pipeline，自动验证会阻止保存。独立端点让验证成为显式操作，前端可在用户点击"验证"按钮时调用。

### 2. 验证逻辑实现方式

验证器遍历按 position 排序的节点：
1. 维护一个 `available_paths` 集合，初始包含 `/document/file_content` 和 `/document/file_name`
2. 对每个节点的每个 input：检查 source 路径是否在 `available_paths` 中（支持通配符匹配）
3. 处理完节点后，将其 outputs 产生的路径加入 `available_paths`
4. 返回验证结果（success/failure + 错误列表）

### 3. E2E 测试策略

**选择**: 使用 mock API（`page.route()`）替代真实后端
**理由**:
- Playwright E2E 测试应快速可靠，不依赖后端服务启动
- 现有 E2E 测试（agent-playground 等）已采用 mock API 模式
- 可以精确控制测试数据，避免数据清理问题

### 4. 后端测试复用 conftest

使用现有 `conftest.py` 的内存 SQLite + dependency override 模式，与其他测试文件一致。

## Risks / Trade-offs

- **[风险] 验证逻辑的通配符路径匹配可能不完整** → 先实现基础匹配（精确路径 + `/*` 扩展），后续按需扩展
- **[风险] E2E mock 可能与真实 API 行为偏离** → mock 数据结构严格遵循 TypeScript 类型定义
- **[取舍] 不测试 Debug 端点的超时场景** → 需要 mock PipelineRunner 执行耗时，测试价值低于实现成本
