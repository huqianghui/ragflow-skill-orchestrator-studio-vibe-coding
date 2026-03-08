# Tasks: agent-playground

## Tasks

### agentApi 扩展

- [x] 1. 修改 `frontend/src/services/agentApi.ts` — 添加 listSessions(params) 返回 PaginatedResponse<AgentSession>, getSession(id), deleteSession(id) 方法。import PaginatedResponse from types/index.ts

### AgentChatWidget 扩展

- [x] 2. 修改 `frontend/src/components/agent/AgentChatWidget.tsx` — 实现 embedded=false 模式: sessionId 变化时 disconnect 旧 WS + 清空 messages, sessionId=null 时进入新建模式, 无 sessionId 首次发送自动 createSession(source='playground') + onSessionCreated 回调, AgentSelector/ContextPanel 使用 compact={false}, MessageBubble 使用 showApply={false}, 发送消息前确保 WS 已连接

### 新增组件

- [x] 3. 创建 `frontend/src/components/agent/SessionBar.tsx` — Session 管理栏: [+ New] 按钮 + Recent Session 标签横向滚动 + [History] 按钮。Props 含 onOpenHistory 回调。当前 session 高亮, 标签显示 Agent 图标+title(截断20字)+相对时间, 关闭按钮用 Popconfirm 确认。空状态显示 "点击 + New 开始对话"

- [x] 4. 创建 `frontend/src/pages/AgentPlayground.tsx` — Playground 页面基本框架: recentSessions 状态管理, SessionBar + AgentChatWidget(embedded=false) 布局, 初始化 useEffect 加载 recent sessions, handleNewSession/handleSelectSession/handleDeleteSession(含 try-catch)/handleSessionCreated 回调, maxWidth 900px 居中布局

- [x] 5. 在 AgentPlayground.tsx 中实现 SessionHistoryModal — Modal + Table(Title/Agent/Mode/Last Active/Actions 列) + 分页(page_size=20) + 行点击选择 + 删除操作(Popconfirm + 刷新列表)

### 导航 & 路由

- [x] 6. 修改 `frontend/src/components/AppLayout.tsx` — menuItems 显式类型注解为 MenuProps['items'], 添加 Agent Playground 菜单项 (MessageOutlined 图标, key="/playground"), 在 Run History 和 Settings 之间用 { type: 'divider' } 分隔, onClick handler 添加 key 存在性检查

- [x] 7. 修改 `frontend/src/App.tsx` — import AgentPlayground, 添加 `<Route path="/playground" element={<AgentPlayground />} />`

### 检查

- [x] 8. 运行 npx tsc -b — 零 TypeScript 错误
- [x] 9. 运行 npm run build — Vite 构建成功
