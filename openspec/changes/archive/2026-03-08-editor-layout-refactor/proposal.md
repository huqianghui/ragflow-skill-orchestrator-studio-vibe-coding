## Why

编辑器页面（SkillEditor、PipelineEditor、BuiltinSkillEditor）的右侧面板缺乏统一的交互模式，Agent Assistant 以浮层 Drawer 形式覆盖编辑区域，干扰编辑体验。同时 Agent Assistant 显示了过多技术细节（Tools、MCP Servers）对普通用户无用，Plan 模式在嵌入场景也不适用。另外默认主题色调偏素（light），需要更有品牌感的蓝色调。

## What Changes

- 默认主题从 `light` 改为 `sky-blue`，新用户首次打开即看到蓝色风格
- 编辑器右侧面板改为**互斥面板模式** — Config 和 Agent 共享同一列，一次只显示一个（Agent 按钮 toggle 切换）
- Agent Assistant 从浮层 Drawer **改为右侧面板的独立 Collapse**，与 Config 面板互斥显示
- Config 面板各 section 可独立展开/收起（默认全展开），Agent 面板 Collapse 头部可关闭回到 Config
- Agent Assistant 嵌入模式**去掉 Tools / MCP Servers 信息**，只显示 agent 名称和在线状态
- Agent Assistant 嵌入模式**去掉 Plan 模式**，只保留 Ask 和 Code
- 此布局模式作为**全系统设计原则**，统一应用于 SkillEditor、PipelineEditor、BuiltinSkillEditor

## Capabilities

### New Capabilities

- `editor-mutually-exclusive-panel`: 编辑器右侧面板互斥布局系统 — Config 和 Agent 共享同一列，互斥显示，Agent Collapse 可自行关闭回到 Config

### Modified Capabilities

- `skill-editor-ui`: 右侧面板从 Card 列表改为 Accordion，Agent 从 Drawer 改为内联 section
- `pipeline-editor-ui`: 右侧面板添加 Accordion 支持，Agent 从 Drawer 改为内联 section
- `agents`: 嵌入模式去掉 Tools/MCP 展示和 Plan 模式
- `theme-system`: 默认主题从 light 改为 sky-blue

## Impact

- **前端页面**: SkillEditor.tsx, PipelineEditor.tsx, BuiltinSkillEditor.tsx 布局重构
- **前端组件**: AgentChatWidget.tsx（去掉 AgentDetailPanel 渲染）、AgentDetailPanel.tsx（可能移除或简化）、ModeBar.tsx（过滤 plan 模式）
- **前端主题**: themes/index.ts 或 themeStore.ts 默认值变更
- **后端**: 无变更
- **依赖**: 无新依赖（使用 Ant Design 现有 Collapse 组件）
