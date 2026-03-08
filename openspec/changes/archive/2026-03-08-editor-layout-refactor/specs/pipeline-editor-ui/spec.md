## ADDED Requirements

### Requirement: Agent Assistant 内联 section

PipelineEditor 右侧节点配置区域 SHALL 在底部添加 Agent Assistant 作为 Accordion section。

#### Scenario: Agent Assistant section 显示

- **WHEN** 用户在 PipelineEditor 页面
- **THEN** 右侧面板底部显示可折叠的 Agent Assistant section
- **AND** 该 section 与节点配置 section 同为 Accordion 手风琴模式

#### Scenario: 从 Drawer 迁移

- **WHEN** 用户点击 Agent 按钮
- **THEN** 右侧 Agent Assistant section 展开（不再弹出 Drawer 浮层）

## REMOVED Requirements

### Requirement: Agent Drawer 浮层

**Reason**: Agent Assistant 改为右侧面板内联 section
**Migration**: Drawer 组件替换为 Collapse.Panel，Agent 按钮改为控制 activeKey
