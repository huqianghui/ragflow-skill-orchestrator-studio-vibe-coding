# Agent Playground Specification

## Purpose

提供独立的 Agent 对话页面，支持完整的 Session 管理（创建、继续、历史、删除），作为 Agentic RAGFlow Studio 的一等公民导航入口。

### Requirement: 页面可访问性

#### Scenario: 路由访问

- **WHEN** 用户访问 `/playground`
- **THEN** 显示 Agent Playground 页面
- **AND** 页面包含 SessionBar + AgentChatWidget 区域

#### Scenario: 导航菜单

- **WHEN** 用户查看侧边栏导航菜单
- **THEN** 在 "Run History" 和 "Settings" 之间显示 "Agent Playground" 菜单项
- **AND** 使用 MessageOutlined 图标
- **AND** 点击导航到 `/playground`
- **AND** 当前路径为 `/playground` 时菜单项高亮

### Requirement: Session 管理

#### Scenario: 空状态 (首次使用)

- **WHEN** Playground 页面加载
- **AND** 无任何 sessions
- **THEN** SessionBar 显示空状态提示文本 "点击 + New 开始对话"
- **AND** AgentChatWidget 显示 Agent 选择器和空消息列表

#### Scenario: 加载最近 Sessions

- **WHEN** Playground 页面加载
- **THEN** 调用 GET /agents/sessions?source=playground&page=1&page_size=10
- **AND** SessionBar 显示最近的 sessions
- **AND** 按 updated_at 降序排列

#### Scenario: 创建新 Session

- **WHEN** 用户点击 [+ New Session] 按钮
- **THEN** 当前 session 清空
- **AND** AgentChatWidget 进入"新建"模式 (无 sessionId)
- **AND** 消息列表清空
- **AND** Agent 选择器和 Mode 选择器可用

#### Scenario: 首次发送消息（新 Session）

- **WHEN** 当前无 sessionId
- **AND** 用户输入文本并点击 Send
- **THEN** 先调用 POST /agents/sessions 创建 session 记录
- **AND** 建立 WebSocket 连接
- **AND** 发送消息到 Agent
- **AND** SessionBar 中出现新 session 标签
- **AND** session title 在后端由首条消息摘要自动生成 (前 30 字符)

#### Scenario: 继续已有 Session

- **WHEN** 用户点击 SessionBar 中的某个 session 标签
- **THEN** 该标签高亮为当前选中状态
- **AND** AgentChatWidget 切换到该 sessionId
- **AND** 断开旧 WebSocket 连接
- **AND** 消息列表清空 (历史由 Agent 原生管理)

#### Scenario: 继续 Session 发送消息

- **WHEN** 已选中一个 session
- **AND** 用户发送新消息
- **THEN** WebSocket 连接到 /agents/sessions/{id}/ws
- **AND** 后端使用 native_session_id 调用 CLI Agent 的 resume 功能
- **AND** Agent 恢复完整上下文继续对话

#### Scenario: 删除 Session

- **WHEN** 用户点击 session 标签上的关闭按钮 (×)
- **THEN** 显示确认对话框 "确定删除此会话？"
- **AND** 确认后调用 DELETE /agents/sessions/{id}
- **AND** 从 SessionBar 中移除该标签
- **AND** 如果删除的是当前 session，则清空 AgentChatWidget

### Requirement: Session 历史

#### Scenario: 打开历史面板

- **WHEN** 用户点击 [History] 按钮
- **THEN** 打开 Modal 显示所有 Playground sessions 列表
- **AND** 表格列: Title | Agent | Mode | Last Active | Actions
- **AND** 按 updated_at 降序排列

#### Scenario: 历史分页

- **WHEN** sessions 总数超过 page_size (20)
- **THEN** 底部显示分页控件
- **AND** 切换页码加载对应数据

#### Scenario: 从历史中选择 Session

- **WHEN** 用户在历史 Modal 中点击某 session
- **THEN** Modal 关闭
- **AND** 切换到该 session (同 "继续已有 Session" 行为)

#### Scenario: 从历史中删除 Session

- **WHEN** 用户在历史 Modal 中点击 session 的删除按钮
- **THEN** 确认对话框
- **AND** DELETE /agents/sessions/{id}
- **AND** 列表刷新

### Requirement: Playground 模式对话

#### Scenario: Agent 和 Mode 选择

- **WHEN** Playground 页面显示
- **THEN** AgentSelector 以全宽模式显示 (compact=false)
- **AND** 显示 Agent 的 display_name、description、版本号
- **AND** 不可用的 Agent 置灰
- **AND** Mode 选择器随 Agent 切换更新

#### Scenario: 手动上下文附加

- **WHEN** 用户点击 ContextPanel 的 [+ Skill] / [+ Pipeline] / [+ Text] 按钮
- **THEN** 弹出选择器允许用户搜索并添加上下文
- **AND** 已附加的上下文显示为标签
- **AND** 标签可删除

#### Scenario: 消息展示

- **WHEN** Agent 返回消息
- **THEN** 消息以全宽模式渲染 (max-width: 900px)
- **AND** Markdown 正确渲染
- **AND** 代码块显示语法高亮
- **AND** 代码块只显示 [Copy] 按钮 (无 Apply)

#### Scenario: 流式响应

- **WHEN** Agent 流式返回 text/code 事件
- **THEN** 实时追加到 assistant 消息中
- **AND** 收到 "done" 事件后 loading 结束

#### Scenario: 错误处理

- **WHEN** Agent 返回 type="error" 事件
- **THEN** 显示红色错误提示

#### Scenario: 所有 Agent 不可用

- **WHEN** GET /agents/available 返回的所有 Agent 的 available=false
- **THEN** 禁用 Send 按钮
- **AND** 显示提示 "未检测到可用的 Agent"

### Requirement: 页面样式

#### Scenario: 布局

- **THEN** 页面内容区域居中，max-width=900px
- **AND** SessionBar 在顶部，高度固定
- **AND** AgentChatWidget 区域填满剩余高度
- **AND** 输入框固定在底部

#### Scenario: 响应式

- **WHEN** 页面宽度 < 900px
- **THEN** 内容区域 width=100%
- **AND** SessionBar 横向可滚动

### Requirement: 导航菜单分组

#### Scenario: 菜单分隔

- **THEN** 侧边栏菜单使用 Ant Design Menu 的 `{ type: 'divider' }` 分隔线
- **AND** menuItems 类型注解为 `MenuProps['items']` (支持 divider 类型)
- **AND** onClick handler 检查 key 存在性 (`key && navigate(key)`)
- **AND** 布局如下:
  ```
  Dashboard
  Skill Library
  Connections
  Pipelines
  Data Sources
  Targets
  Run History
  ──────────────          ← { type: 'divider' }
  Agent Playground
  ──────────────          ← { type: 'divider' }
  Settings
  ```
