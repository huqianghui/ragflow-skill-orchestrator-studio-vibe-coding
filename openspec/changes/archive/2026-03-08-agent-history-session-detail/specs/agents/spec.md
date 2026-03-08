## MODIFIED Requirements

### Requirement: AgentHistory 标准化表格

AgentHistory 页面 SHALL 提供标准化的表格交互：搜索、过滤、排序、分页、删除。表格 SHALL 显示 Session ID（`native_session_id`）替代 Title 列。

- **Session ID 列**: 显示 `native_session_id`，截断显示（前 8 字符 + "..."），hover Tooltip 显示完整值，支持点击复制
- **null 处理**: `native_session_id` 为空时显示灰色斜体 `(pending)` 文本
- **搜索**: `ListToolbar` 组件，按 session ID 或 agent_name 模糊匹配（客户端），placeholder 为 "Search by session ID or agent"
- **过滤**: "Filter by agent" 和 "Filter by source" 多选下拉（客户端）
- **排序**: 所有列支持 ascend/descend 排序，Last Active 默认 descend
- **分页**: `showTotal` 显示 "Total X sessions"，支持 10/20/50/100 pageSize
- **行点击**: 点击行跳转到 `/playground?agent=<agent_name>&session=<session_id>` 恢复聊天
- **Actions 列**: 包含"查看详情"按钮（EyeOutlined）和"删除"按钮（DeleteOutlined + Popconfirm）

#### Scenario: 表格显示 Session ID 列

- **WHEN** AgentHistory 页面加载
- **THEN** 表格第一列显示 "Session ID"（非 "Title"）
- **AND** 每行显示该 session 的 `native_session_id` 截断值

#### Scenario: native_session_id 为 null 时显示 pending

- **WHEN** 某个 session 的 `native_session_id` 为 null
- **THEN** Session ID 列显示灰色斜体 `(pending)` 文本

#### Scenario: hover 显示完整 Session ID

- **WHEN** 用户 hover 到 Session ID 截断文本上
- **THEN** Tooltip 显示完整的 `native_session_id` 值

#### Scenario: 点击复制 Session ID

- **WHEN** 用户点击 Session ID 文本
- **THEN** 完整 `native_session_id` 复制到剪贴板
- **AND** 显示 "Copied!" 提示

#### Scenario: 按 session ID 搜索

- **WHEN** 用户在搜索框输入 UUID 片段
- **THEN** 表格过滤显示 `native_session_id` 包含该片段的 session

## ADDED Requirements

### Requirement: Session Detail Modal

AgentHistory 页面 SHALL 提供 Session Detail Modal，允许用户在不离开 History 页面的情况下预览 session 的完整聊天记录。

- Modal 通过 Actions 列的"查看详情"按钮（EyeOutlined）触发
- Modal 顶部显示 session 元信息：完整 Session ID、Agent 名称、Mode、Source
- Modal 中间区域显示完整聊天记录（从 `GET /sessions/{id}/messages` 加载）
- Modal 底部提供 "Continue in Playground" 按钮，跳转恢复聊天
- 聊天记录按时间升序排列，每条消息显示 role 标签、内容（支持 Markdown 渲染）和时间戳
- Modal 内容区域支持垂直滚动，maxHeight 适配视口

#### Scenario: 点击查看详情打开 Modal

- **WHEN** 用户点击某行的 EyeOutlined 按钮
- **THEN** 弹出 Session Detail Modal
- **AND** Modal 加载并显示该 session 的聊天记录
- **AND** 点击事件不触发行点击（stopPropagation）

#### Scenario: Modal 加载中显示 loading

- **WHEN** Modal 打开后消息尚在加载中
- **THEN** 显示 Spin loading 指示器

#### Scenario: Modal 显示聊天记录

- **WHEN** 消息加载完成
- **THEN** 按时间升序显示所有消息
- **AND** User 消息和 Assistant 消息有明显的视觉区分

#### Scenario: Modal 无消息时显示空状态

- **WHEN** session 没有任何持久化消息
- **THEN** Modal 显示 "No messages in this session" 空状态提示

#### Scenario: 从 Modal 跳转到 Playground

- **WHEN** 用户在 Modal 中点击 "Continue in Playground" 按钮
- **THEN** 关闭 Modal
- **AND** 导航到 `/playground?agent=<agent_name>&session=<session_id>`
