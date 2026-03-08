## ADDED Requirements

### Requirement: Agent History 表格 E2E 测试覆盖

系统 SHALL 提供 Playwright E2E 测试覆盖 AgentHistory 页面的所有标准表格功能。

#### Scenario: 表格基本加载验证

- **WHEN** 用户导航到 `/agent-history`
- **THEN** 页面显示 "Agent Session History" 标题
- **AND** 表格包含 Title, Agent, Mode, Source, Created, Last Active 列

#### Scenario: 搜索过滤与恢复

- **WHEN** 用户在搜索框输入关键词并回车
- **THEN** 表格仅显示 title 或 agent_name 包含关键词的行
- **WHEN** 用户清空搜索框
- **THEN** 表格恢复显示全部数据

#### Scenario: Agent 和 Source 下拉过滤

- **WHEN** 用户选择 "Filter by agent" 下拉中的某个 agent
- **THEN** 表格仅显示该 agent 的 session
- **WHEN** 用户选择 "Filter by source" 中的 "playground"
- **THEN** 表格仅显示 source=playground 的 session

#### Scenario: 列排序

- **WHEN** 用户点击 "Last Active" 列头
- **THEN** 排序方向切换（默认 descend）
- **WHEN** 用户点击 "Title" 列头
- **THEN** 数据按 title 字母排序

#### Scenario: 分页

- **WHEN** 系统有 >10 个 session
- **THEN** 分页器显示 "Total X sessions"
- **AND** 用户可切换 pageSize 和翻页

#### Scenario: 删除 Session

- **WHEN** 用户点击删除图标
- **THEN** Popconfirm 弹出 "Delete this session?"
- **WHEN** 用户确认删除
- **THEN** session 从列表中移除
- **AND** 删除操作不触发行点击导航 (stopPropagation)

### Requirement: Session 自动恢复 E2E 测试覆盖

系统 SHALL 提供 Playwright E2E 测试覆盖 Agent 切换时的 Session 自动恢复功能。

#### Scenario: Agent 切换恢复近期 Session

- **WHEN** 存在 agent A 的近期 playground session (< 30min)
- **AND** 用户打开 Playground 选中 agent A
- **THEN** session 自动恢复

#### Scenario: 无近期 Session 时新建

- **WHEN** 目标 agent 无近期 playground session
- **AND** 用户切换到该 agent
- **THEN** 聊天区域显示空白状态

#### Scenario: Invoke New Session

- **WHEN** 用户点击 "Invoke New Session" 按钮
- **THEN** 聊天区域清空，旧 session 的消息不再显示

#### Scenario: History 点击强制恢复

- **WHEN** 用户在 History 页面点击某 session 行
- **THEN** 导航到 Playground 并恢复该 session（不受 30min 限制）

### Requirement: Chat UI 组件 E2E 测试覆盖

系统 SHALL 提供 Playwright E2E 测试覆盖 Chat UI 的 Thinking 动画、输入交互和 Mode 切换。

#### Scenario: Thinking 动画 CSS 结构验证

- **WHEN** Playground 加载完成
- **THEN** 页面组件定义中包含 `@keyframes thinking-dot` 和 `thinking-bar` 动画

#### Scenario: Send 按钮状态

- **WHEN** 输入框为空
- **THEN** Send 按钮为禁用状态
- **WHEN** 输入框有文字
- **THEN** Send 按钮为启用状态

#### Scenario: Mode 切换

- **WHEN** agent 支持多个 mode (如 ask 和 code)
- **AND** 用户点击 mode 按钮
- **THEN** mode 状态切换，按钮样式更新
