## ADDED Requirements

### Requirement: 编辑器右侧 Accordion 面板

编辑器页面（SkillEditor、PipelineEditor、BuiltinSkillEditor）的右侧面板 SHALL 使用 Ant Design `<Collapse accordion>` 实现手风琴交互模式。

#### Scenario: 同时只展开一个 section

- **WHEN** 用户点击一个折叠的 section header
- **THEN** 该 section 展开，显示内容
- **AND** 其他已展开的 section 自动折叠

#### Scenario: 全部折叠

- **WHEN** 用户点击当前展开 section 的 header
- **THEN** 该 section 折叠
- **AND** 所有 section 均处于折叠状态

#### Scenario: 折叠状态保持组件状态

- **WHEN** 一个 section 被折叠
- **THEN** 其内部组件状态 MUST 保持不变（WebSocket 连接、表单值、滚动位置等）
- **AND** 使用 `destroyInactivePanel={false}` 确保组件不被销毁

### Requirement: Agent 按钮触发展开

PageHeader 中的 Agent 按钮 SHALL 控制右侧 Accordion 中 Agent Assistant section 的展开。

#### Scenario: 点击 Agent 按钮展开 Agent section

- **WHEN** 用户点击 PageHeader 中的 Agent 按钮
- **AND** Agent Assistant section 处于折叠状态
- **THEN** Agent Assistant section 展开
- **AND** 其他 section 自动折叠

#### Scenario: 再次点击 Agent 按钮折叠

- **WHEN** 用户点击 PageHeader 中的 Agent 按钮
- **AND** Agent Assistant section 已处于展开状态
- **THEN** Agent Assistant section 折叠

### Requirement: Agent Assistant 面板内滚动

#### Scenario: 对话区域滚动

- **WHEN** Agent Assistant section 展开
- **THEN** 对话消息区域 SHALL 具有固定最大高度
- **AND** 消息超出高度时内部滚动
- **AND** 输入框固定在 section 底部
