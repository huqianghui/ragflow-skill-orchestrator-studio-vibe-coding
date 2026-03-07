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
