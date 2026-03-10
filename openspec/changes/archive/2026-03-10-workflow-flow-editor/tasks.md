## 1. Backend: Workflow graph_data 字段

- [x] 1.1 在 `backend/app/models/workflow.py` 中给 Workflow 模型添加 `graph_data` 列 (JSON, nullable, default null)
- [x] 1.2 在 `backend/app/schemas/workflow.py` 中给 WorkflowCreate / WorkflowUpdate / WorkflowResponse 添加 `graph_data` 可选字段
- [x] 1.3 更新 Alembic init migration 包含 graph_data 列，并编写新 migration 脚本
- [x] 1.4 运行 `alembic upgrade head` 验证 migration，运行 `pytest tests/ -v` 确保测试通过

## 2. Frontend: TypeScript 类型定义

- [x] 2.1 在 `frontend/src/types/index.ts` 中添加 `WorkflowGraphNode` 接口 (id, type, x, y, data_source_id?, name?, priority?, file_filter?, is_default?, pipeline_id?, target_id?)
- [x] 2.2 在 `frontend/src/types/index.ts` 中添加 `WorkflowGraphEdge` 接口 (id, source, target)
- [x] 2.3 在 `Workflow` 接口中添加可选 `graph_data?: { nodes: WorkflowGraphNode[]; edges: WorkflowGraphEdge[] }`

## 3. Frontend: 路由与页面骨架

- [x] 3.1 在 `frontend/src/App.tsx` 中添加 `/workflows/:id/edit` 路由，指向新的 WorkflowEditor 组件
- [x] 3.2 创建 `frontend/src/pages/WorkflowEditor.tsx` 骨架：加载 Workflow 数据、ReactFlowProvider 包裹、基本布局 (画布 + 右侧栏 + 顶部栏)
- [x] 3.3 顶部栏：Workflow 名称、返回列表按钮、Save 按钮、Agent 按钮

## 4. Frontend: 自定义节点组件

- [x] 4.1 实现 DataSourceNode 组件：蓝色风格、数据源图标+名称+类型、右侧 source Handle
- [x] 4.2 实现 RouterNode 组件：绿色风格、路由名称+filter 摘要、左右 Handle；is_default 时虚线边框+"Default" 标记
- [x] 4.3 实现 PipelineNode 组件：紫色风格、Pipeline 名称、左右 Handle、"Open in Editor" 链接
- [x] 4.4 实现 TargetNode 组件：橙色风格、Target 名称+类型、左侧 target Handle

## 5. Frontend: 画布交互逻辑

- [x] 5.1 实现连线规则验证 (`isValidConnection`)：只允许 DS→Router、Router→Pipeline、Pipeline→Target；Router→Pipeline 1:1 约束
- [x] 5.2 实现拖放添加节点：`onDragOver` + `onDrop` 处理，落点坐标转换，DS/Pipeline/Target 弹出资源选择器，Router 直接创建
- [x] 5.3 实现点击添加节点：右侧栏 "+" 按钮，弹出选择器，节点放置到画布空白位置
- [x] 5.4 实现节点删除：选中节点后可删除，同时清理关联的边
- [x] 5.5 实现边删除：选中边后可删除

## 6. Frontend: 右侧栏

- [x] 6.1 实现 Add Node 面板：四种节点类型的拖放条目和 "+" 按钮，加载 DataSource/Pipeline/Target 列表供选择
- [x] 6.2 实现 Node Config 面板：按节点类型渲染不同配置表单 — DataSource (只读+更换)、Router (name/priority/file_filter 编辑)、Pipeline (只读+跳转)、Target (只读+更换)
- [x] 6.3 实现 Agent Assistant 面板：复用 AgentSelector + AgentChatWidget，与 PipelineEditor 保持一致
- [x] 6.4 实现右侧栏折叠/展开切换 (40px ↔ 380px)，三态互斥切换逻辑

## 7. Frontend: 保存与反推逻辑

- [x] 7.1 实现 `graphToRoutes()` 函数：遍历 graph 节点和边，推导出 data_source_ids、routes、default_route
- [x] 7.2 实现 Save 按钮调用 PUT /api/v1/workflows/{id}，发送 graph_data + 推导出的 routes 等字段
- [x] 7.3 实现 `routesToGraph()` 函数：从已有 routes/data_source_ids/default_route 反推生成 graph 节点和边，使用四列自动布局
- [x] 7.4 页面加载时：如果 graph_data 存在则直接使用；如果为 null 则调用 routesToGraph() 生成初始 graph

## 8. Frontend: 列表页改造

- [x] 8.1 修改 `Workflows.tsx`：New Workflow 的 Modal 简化为只有 Name + Description，创建成功后跳转到编辑器
- [x] 8.2 修改 `Workflows.tsx`：列表中 Edit 操作从弹 Modal 改为 `navigate(/workflows/${id}/edit)`
- [x] 8.3 保留列表页的 Run、Runs、Delete 操作不变

## 9. 验证

- [x] 9.1 运行 `npx tsc -b && npm run build` 确保前端编译通过
- [x] 9.2 运行后端 `ruff check . && ruff format --check . && pytest tests/ -v` 确保后端通过
- [x] 9.3 E2E 验证：Playwright 测试覆盖 — 创建 Workflow → 跳转编辑器 → 添加节点 → 保存 → 刷新验证持久化 (workflow-editor.spec.ts 24 tests)
- [x] 9.4 E2E 验证：Playwright 测试覆盖 — 打开已有 Workflow（routes 无 graph_data）→ 验证反推 graph 正确显示 (backward compatibility tests)
