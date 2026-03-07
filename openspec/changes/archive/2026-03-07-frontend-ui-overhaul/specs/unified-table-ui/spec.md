## MODIFIED Requirements

### Requirement: Table theme compatibility
统一表格组件 MUST 在所有主题下正确显示。ResizableTitle 和 OverflowPopover 组件 SHALL 避免硬编码颜色值。

#### Scenario: Table in dark theme
- **WHEN** 用户切换到 Dark 主题
- **THEN** 表格的列头拖拽手柄、溢出弹出框背景、行悬停色均自动适配暗色

#### Scenario: Resizable handle visibility in dark mode
- **WHEN** 用户在 Dark 主题下拖拽调整列宽
- **THEN** 拖拽手柄可见且样式正确（不被暗色背景淹没）
