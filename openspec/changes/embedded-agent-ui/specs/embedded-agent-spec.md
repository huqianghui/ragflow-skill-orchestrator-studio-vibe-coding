# Embedded Agent UI Specification

## Purpose

在 SkillEditor、PipelineEditor、BuiltinSkillEditor 三个编辑器页面中嵌入 AI Agent 面板，以右侧 Drawer 形式提供上下文感知的对话辅助和一键 Apply 代码能力。

### Requirement: Agent Drawer 入口

#### Scenario: 编辑器顶部按钮

- **WHEN** 用户访问 SkillEditor / PipelineEditor / BuiltinSkillEditor
- **THEN** 顶部操作栏显示 "Agent" 按钮 (RobotOutlined 图标)
- **AND** 点击按钮打开右侧 Drawer

#### Scenario: Drawer 配置

- **THEN** Drawer placement="right", width=400px, mask=false
- **AND** mask=false 允许用户同时操作编辑器和 Agent
- **AND** Drawer 标题为 "AI Agent"

### Requirement: Agent 选择器

#### Scenario: 显示可用 Agent

- **WHEN** Drawer 打开时
- **THEN** 调用 GET /agents/available 获取 Agent 列表
- **AND** 显示 Agent 下拉选择器 + Mode 下拉选择器
- **AND** 不可用的 Agent 置灰显示

#### Scenario: 切换 Agent

- **WHEN** 用户切换 Agent
- **THEN** Mode 选择器更新为该 Agent 支持的 modes 列表
- **AND** 默认选中第一个 mode

### Requirement: 自动上下文

#### Scenario: Skill Editor 上下文

- **WHEN** 在 SkillEditor 中打开 Agent Drawer
- **THEN** 自动显示上下文标签: "✅ Skill: {name}"
- **AND** 自动包含 skill 的 name, description, source_code, test_input

#### Scenario: Pipeline Editor 上下文

- **WHEN** 在 PipelineEditor 中打开 Agent Drawer
- **THEN** 自动显示上下文标签: "✅ Pipeline: {name}"
- **AND** 自动包含 pipeline 的 name, status, graph_data

### Requirement: 对话交互

#### Scenario: 发送消息

- **WHEN** 用户在输入框输入文本并点击 Send (或 Enter)
- **THEN** 消息出现在对话列表 (右对齐, user 角色)
- **AND** 通过 WebSocket 发送消息到后端
- **AND** 发送按钮变为 loading 状态

#### Scenario: 接收流式响应

- **WHEN** 后端通过 WebSocket 流式返回 AgentEvent
- **THEN** 实时追加到 assistant 消息中
- **AND** Markdown 格式正确渲染
- **AND** 代码块显示语法高亮
- **AND** 收到 "done" 事件后 loading 状态结束

#### Scenario: 接收错误

- **WHEN** 后端返回 type="error" 的事件
- **THEN** 显示错误提示 (红色样式)

### Requirement: Apply 机制

#### Scenario: 代码块的 Apply 按钮

- **WHEN** Agent 返回包含代码块的消息
- **THEN** 每个代码块下方显示 [Apply to Editor] 和 [Copy] 按钮

#### Scenario: Apply to Skill Editor

- **WHEN** 用户在 SkillEditor 的 Drawer 中点击 [Apply to Editor]
- **THEN** 代码写入 Monaco Editor (替换 sourceCode)
- **AND** dirty 状态设为 true
- **AND** 显示 "Applied" 成功提示

#### Scenario: Apply to Pipeline Editor

- **WHEN** Agent 返回结构化 JSON pipeline action
- **AND** 用户点击 [Apply to Pipeline]
- **THEN** 解析 action 类型，修改 graph_data
- **AND** ReactFlow 重新渲染

#### Scenario: Apply to Builtin Skill Editor

- **WHEN** Agent 返回配置建议 JSON
- **AND** 用户在 BuiltinSkillEditor 的 Drawer 中点击 [Apply]
- **THEN** 配置通过 form.setFieldsValue() 写入 Ant Design Form
- **AND** dirty 状态设为 true
- **AND** 显示 "Applied" 成功提示

#### Scenario: Copy 代码

- **WHEN** 用户点击 [Copy]
- **THEN** 代码复制到系统剪贴板
- **AND** 显示 "Copied" 提示

### Requirement: 连接管理

#### Scenario: Drawer 打开

- **WHEN** Agent Drawer 打开
- **AND** 用户首次发送消息
- **THEN** 自动创建临时 session (POST /agents/sessions, source="skill-editor")
- **AND** 建立 WebSocket 连接

#### Scenario: Drawer 关闭

- **WHEN** Agent Drawer 关闭
- **THEN** 断开 WebSocket 连接
- **AND** 不持久化 session 到 Playground 历史
