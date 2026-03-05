## Why

Skill Library 页面的表格交互体验不够好：每页默认 50 条数据过多，Description 列容易被截断且无法查看完整内容，Name 列只是纯文本缺少快捷操作入口，列宽无法根据用户设备和偏好调整。需要提升表格的可用性和信息密度的平衡。

## What Changes

- 将表格默认分页从 50 条调整为 10 条，分页选项改为 `[10, 20, 50, 100]`
- Name 列改为可点击的 link 样式：built-in skill 点击打开只读 Detail Modal，custom skill 点击打开 Edit Form Modal，原 Actions 列的 View/Edit 按钮保留
- Description 列增加默认宽度（~350px），支持拖拽调整列宽（Name 列同样支持拖拽）
- Description 列增加 hover Popover：仅当文本溢出时触发，延迟显示，Popover 内展示纯文本，最大宽度 400px

## Capabilities

### New Capabilities

- `resizable-table-columns`: 表格列拖拽调整宽度能力，基于 react-resizable 实现，应用于 Name 和 Description 列

### Modified Capabilities

- `skills`: Skill Library 表格的分页默认值、Name 列交互行为、Description 列展示方式变更

## Impact

- `frontend/src/pages/SkillLibrary.tsx` — 主要改动文件，涉及列定义、分页配置、拖拽 resize 逻辑、Popover 组件
- `frontend/package.json` — 新增 `react-resizable` 和 `@types/react-resizable` 依赖
- 无后端改动，无 API 变更，无数据库变更
