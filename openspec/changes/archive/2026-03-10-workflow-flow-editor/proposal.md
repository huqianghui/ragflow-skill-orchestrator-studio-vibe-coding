## Why

Workflow 当前使用 720px Modal 弹窗配置路由规则（Form.List + Card），而 Pipeline 已有成熟的 React Flow 画布编辑器。两种编排模块的交互体验不一致，Workflow 的 Modal 形式也难以直观展示 DataSource → Router → Pipeline → Target 的数据流全貌。将 Workflow 改为 flow 编辑器可以统一用户体验，并让路由拓扑一目了然。

## What Changes

- **新增 WorkflowEditor 页面**: 基于 `@xyflow/react` 的画布编辑器，支持 4 种节点类型（DataSource、Router、Pipeline、Target），从左到右布局
- **新增 `graph_data` 字段**: Workflow 模型新增 JSON 字段存储画布节点和边，保存时自动同步生成 `routes`/`data_source_ids`/`default_route`（后端执行引擎零改动）
- **修改 Workflows 列表页**: "Edit" 操作从弹出 Modal 改为跳转到 `/workflows/:id/edit` 编辑器页面
- **修改路由配置**: App.tsx 新增 `/workflows/:id/edit` 路由
- **新增 TypeScript 类型**: WorkflowGraphNode、WorkflowGraphEdge
- **新增 Alembic migration**: 给 workflows 表加 `graph_data` 列

## Capabilities

### New Capabilities
- `workflow-editor-ui`: Workflow flow 编辑器的 UI 规格，包括画布交互、节点类型、连线规则、右侧栏（Add Node / Node Config / Agent Assistant）、拖放和点击两种添加方式、graph → routes 转换逻辑

### Modified Capabilities
- `workflows`: 数据模型新增 `graph_data` 字段；前端管理部分从 Modal 编辑改为 flow 编辑器页面

## Impact

- **前端**: 新增 `WorkflowEditor.tsx` 页面（主要工作量），修改 `Workflows.tsx`（列表页 Edit 跳转）、`App.tsx`（路由）、`types/index.ts`（类型）
- **后端**: `models/workflow.py` 加字段、`schemas/workflow.py` 加 graph_data 可选字段、新 Alembic migration
- **依赖**: 复用已有 `@xyflow/react` 库（Pipeline Editor 已引入）
- **兼容性**: 已有无 graph_data 的 Workflow 仍可通过列表页正常运行/查看；首次在编辑器打开时自动从 routes 反推生成初始 graph_data
