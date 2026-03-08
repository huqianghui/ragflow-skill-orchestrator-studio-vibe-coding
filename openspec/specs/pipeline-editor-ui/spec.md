## MODIFIED Requirements

### Requirement: PipelineEditor theme adaptation
PipelineEditor 页面 MUST 在暗色主题下正确渲染 ReactFlow 画布。

#### Scenario: Dark theme canvas background
- **WHEN** 用户在 Dark 主题下打开 PipelineEditor
- **THEN** ReactFlow 画布背景使用深色调，Background 网格适配暗色

#### Scenario: Dark theme node styling
- **WHEN** 用户在 Dark 主题下查看 Pipeline 节点
- **THEN** 节点卡片的背景色、文字色、边框色均适配暗色主题，保持可读性

#### Scenario: Dark theme sidebar
- **WHEN** 用户在 Dark 主题下展开 PipelineEditor 的左侧面板
- **THEN** 左侧技能列表面板适配暗色样式

### Requirement: Agent Assistant 内联面板

PipelineEditor 右侧面板 SHALL 使用互斥面板模式显示 Agent Assistant。

#### Scenario: Agent Assistant 面板显示

- **WHEN** 用户在 PipelineEditor 页面
- **THEN** Agent 按钮控制右侧面板在 Config 和 Agent 之间切换
- **AND** Agent 面板与节点配置面板互斥显示

#### Scenario: 从 Drawer 迁移

- **WHEN** 用户点击 Agent 按钮
- **THEN** 右侧 Agent Assistant 面板展开（不再弹出 Drawer 浮层）

> **已移除**: Agent Drawer 浮层模式 — Agent Assistant 改为右侧互斥面板内联显示
