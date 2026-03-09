## Why

Change 1-4 实现了 Workflow 后端完整功能（模型、路由匹配、执行引擎、增量处理）。前端已有基础 Workflows 列表页和 Run 功能，但缺少：
- WorkflowRun 运行历史专页（查看所有运行记录）
- Workflow 详情页（路由规则可视化展示）
- OpenSpec spec 文档同步

## What Changes

- 新增 WorkflowRunHistory 页面：按 Workflow 过滤查看运行历史
- 增强 Workflows 页面：添加 Last Run 状态列
- 新增路由到 App.tsx
- 同步 openspec specs

## Capabilities

### Modified Capabilities
- `workflows`: 前端增强运行历史和状态展示

## Impact

- **前端**: 新增 1 个页面组件, 修改 3 个现有文件
- **后端**: 无变更
