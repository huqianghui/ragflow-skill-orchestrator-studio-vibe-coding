## ADDED Requirements

### Requirement: AgentMessage 数据模型

系统 SHALL 提供 `agent_messages` 表持久化存储 Agent 聊天消息。

#### Scenario: AgentMessage 表结构

- **WHEN** 系统创建 `agent_messages` 表
- **THEN** 表包含 session_id (String(36), indexed), role (String(10)), content (Text) 列
- **AND** 继承 BaseModel 的 id, created_at, updated_at 列

### Requirement: 消息持久化 API

系统 SHALL 提供 REST API 获取 session 的消息历史。

#### Scenario: 获取 session 消息列表

- **WHEN** 客户端发送 `GET /agents/sessions/{id}/messages`
- **THEN** 返回该 session 的所有消息，按 created_at 升序排列
- **AND** 每条消息包含 id, role, content, created_at 字段

#### Scenario: session 不存在时返回 404

- **WHEN** 客户端请求不存在的 session 的消息
- **THEN** 返回 404 Not Found

### Requirement: WebSocket 消息自动持久化

系统 SHALL 在 WebSocket 对话中自动持久化 user 和 assistant 消息。

#### Scenario: user 消息持久化

- **WHEN** WebSocket 收到 type=message 的客户端消息
- **THEN** 在发送给 agent 前持久化 user 消息到 agent_messages 表

#### Scenario: assistant 消息持久化

- **WHEN** agent 流式响应完成（收到 done 事件）
- **THEN** 将累积的 assistant 文本持久化到 agent_messages 表

### Requirement: Session 删除级联清理消息

系统 SHALL 在删除 session 时同时删除其所有关联消息。

#### Scenario: 删除 session 级联删除消息

- **WHEN** 用户删除一个 session
- **THEN** 该 session 的所有 agent_messages 记录一并删除

## MODIFIED Requirements

### Requirement: Agent History 到 Playground 的 session 恢复导航

Agent History 页面 SHALL 支持点击 session 后跳转到 Playground 并自动恢复对应的 agent 和 session，恢复时从 DB 加载历史消息。

#### Scenario: 点击 History 中的 session 行

- **WHEN** 用户在 Agent History 页面点击某个 session 行
- **THEN** 导航到 `/playground?agent=<agent_name>&session=<session_id>`

#### Scenario: Playground 从 URL 恢复 agent 和 session

- **WHEN** AgentPlayground 页面加载时 URL 包含 `agent` 和 `session` 参数
- **THEN** 自动选择 URL 指定的 agent
- **AND** 使用 URL 指定的 session ID 恢复会话
- **AND** 从 `GET /sessions/{id}/messages` 加载历史消息显示在聊天区域
- **AND** 加载完成后清除 URL 参数

#### Scenario: URL 指定的 agent 不可用时 fallback

- **WHEN** URL 中的 `agent` 参数指定的 agent 不在可用列表中
- **THEN** fallback 到第一个可用 agent
- **AND** 仍使用 URL 中的 session ID（如有）

#### Scenario: 无历史消息时显示 resume 提示

- **WHEN** session 恢复成功但无持久化消息
- **THEN** 显示 "Session resumed — send a message to continue the conversation."

## ADDED Requirements

### Requirement: Agent 切换自动恢复近期 Session

AgentPlayground SHALL 在切换 agent 时自动恢复最近 30 分钟内的 playground session。

#### Scenario: 切换 agent 恢复近期 session

- **WHEN** 用户在 Playground 切换到 agent A
- **AND** agent A 有近期（< 30min）的 playground session
- **THEN** 自动恢复该 session 并加载历史消息

#### Scenario: 无近期 session 时新建

- **WHEN** 用户在 Playground 切换到 agent B
- **AND** agent B 无近期 playground session
- **THEN** 聊天区域显示空白状态，准备新对话

#### Scenario: Invoke New Session 强制新建

- **WHEN** 用户点击 "Invoke New Session" 按钮
- **THEN** 当前 session 断开
- **AND** 聊天区域清空，准备全新对话

### Requirement: AgentHistory 标准化表格

AgentHistory 页面 SHALL 提供标准化的表格交互：搜索、过滤、排序、分页、删除。

#### Scenario: 搜索过滤

- **WHEN** 用户在搜索框输入关键词
- **THEN** 表格仅显示 title 或 agent_name 包含关键词的行

#### Scenario: Agent 和 Source 下拉过滤

- **WHEN** 用户选择 "Filter by agent" 下拉中的某个 agent
- **THEN** 表格仅显示该 agent 的 session

#### Scenario: 列排序

- **WHEN** 用户点击列头
- **THEN** 数据按该列排序，支持 ascend/descend 切换

#### Scenario: 分页

- **WHEN** 数据超过 pageSize
- **THEN** 分页器显示 "Total X sessions"，支持 pageSize 切换和翻页

#### Scenario: 删除 Session

- **WHEN** 用户点击删除图标并确认
- **THEN** session 从列表中移除
- **AND** 删除点击不触发行导航 (stopPropagation)

### Requirement: Thinking 等待动画

MessageBubble SHALL 在流式响应等待期间显示 Thinking 动画。

#### Scenario: 流式等待显示 Thinking 动画

- **WHEN** assistant 消息处于 streaming 状态且 content 为空
- **THEN** 显示 ThinkingIndicator（弹跳圆点 + 渐变进度条）

#### Scenario: 流式内容显示 blinking cursor

- **WHEN** assistant 消息处于 streaming 状态且 content 非空
- **THEN** 在内容末尾显示 blinking cursor 动画
