## MODIFIED Requirements

### Requirement: 嵌入模式 Agent 信息展示

嵌入式 Agent Assistant（编辑器内联模式）SHALL 只显示精简的 Agent 信息。

#### Scenario: 隐藏 Tools 和 MCP Servers

- **WHEN** AgentChatWidget 以 embedded=true 模式渲染
- **THEN** 不显示 AgentDetailPanel（Tools 列表、MCP Servers 列表）
- **AND** 只在 AgentSelector 中显示 agent 名称和 ON/OFF 状态

#### Scenario: Playground 模式保持不变

- **WHEN** AgentChatWidget 以 embedded=false 模式渲染（Playground 页面）
- **THEN** 保持现有行为，显示完整 Agent 信息

### Requirement: 嵌入模式 Mode 过滤

嵌入式 Agent Assistant SHALL 不提供 Plan 模式。

#### Scenario: 过滤 Plan 模式

- **WHEN** AgentChatWidget 以 embedded=true 模式渲染
- **THEN** Mode 选择器只显示 Ask 和 Code（过滤掉 Plan）
- **AND** 默认选中 Ask 模式

#### Scenario: 单模式时隐藏选择器

- **WHEN** 过滤后 agent 只支持一种 mode
- **THEN** 隐藏 Mode 选择器，直接使用该唯一 mode
