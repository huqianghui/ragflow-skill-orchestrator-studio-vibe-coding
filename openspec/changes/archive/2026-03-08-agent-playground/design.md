# Design: Agent Playground — 独立 AI 助手对话页面

## 1. 页面架构

```
AgentPlayground (pages/AgentPlayground.tsx)
  │
  ├── <SessionBar />                        # 顶部 Session 管理栏
  │     ├── [+ New Session] 按钮
  │     ├── Recent Sessions 横向标签列表
  │     └── [History] 按钮 → Session 列表 Modal
  │
  └── <AgentChatWidget                      # 复用 embedded-agent-ui 的核心组件
        embedded={false}
        sessionId={currentSessionId}
        onSessionCreated={handleSessionCreated}
      />
        ├── <AgentSelector compact={false} />   # 全宽 Agent+Mode 选择器
        ├── <ContextPanel compact={false} />     # 全宽手动上下文面板
        ├── <div className="message-list">       # 消息列表 (全屏宽度)
        │     └── <MessageBubble showApply={false} /> × N
        └── <Input.TextArea + Send Button>       # 输入区域
```

## 2. 新增组件

### 2.1 SessionBar

```typescript
// components/agent/SessionBar.tsx

interface SessionBarProps {
  sessions: AgentSession[];            // 最近的 sessions (按 updated_at 降序)
  currentSessionId: string | null;     // 当前活跃 session
  onNewSession: () => void;            // 创建新 session
  onSelectSession: (id: string) => void;  // 选择/切换 session
  onDeleteSession: (id: string) => void;  // 删除 session
  onOpenHistory: () => void;           // 打开 History Modal
  loading?: boolean;
}
```

布局设计：
- 水平排列：左侧 `[+ New]` 按钮，中间横向滚动的 Session 标签，右侧 `[History]` 按钮
- 每个 Session 标签显示：Agent 图标 + title (截断 20 字) + 相对时间
- 当前选中的 Session 标签高亮 (primary 色)
- 标签右上角有关闭按钮 (×)，点击触发删除确认 (Popconfirm)
- 使用 Ant Design `<Tag>` / `<Button>` 组件
- 空状态：无 sessions 时显示提示文本 "点击 + New 开始对话"

### 2.2 SessionHistoryModal

```typescript
// 可内联在 AgentPlayground.tsx 中，不需要独立文件

interface SessionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  onSelectSession: (id: string) => void;
}
```

内部逻辑：
- 打开时调用 `agentApi.listSessions({ source: 'playground', page: 1, page_size: 20 })`
- 使用 Ant Design `<Modal>` + `<Table>`
- 表格列：Title | Agent | Mode | Last Active (相对时间) | Actions (删除按钮)
- 按 `updated_at` 降序排列
- 底部分页控件 (page_size=20)
- 点击行 → 关闭 Modal → 调用 `onSelectSession(id)`
- 删除操作：Popconfirm 确认 → 调用 `agentApi.deleteSession(id)` → 刷新列表

### 2.3 AgentPlayground 页面

```typescript
// pages/AgentPlayground.tsx

export default function AgentPlayground() {
  // --- 状态 ---
  const [recentSessions, setRecentSessions] = useState<AgentSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // --- Session 管理回调 ---
  const handleNewSession = () => {
    setCurrentSessionId(null);  // 清空当前 session → AgentChatWidget 进入"新建"模式
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);  // AgentChatWidget 切换到该 session
  };

  const handleSessionCreated = (sessionId: string) => {
    // AgentChatWidget 创建新 session 后回调
    setCurrentSessionId(sessionId);
    refreshRecentSessions();
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await agentApi.deleteSession(id);
    } catch {
      message.error('删除 session 失败');
      return;
    }
    if (currentSessionId === id) setCurrentSessionId(null);
    refreshRecentSessions();
  };

  // --- 初始化 ---
  useEffect(() => {
    refreshRecentSessions();
  }, []);

  const refreshRecentSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await agentApi.listSessions({ source: 'playground', page: 1, page_size: 10 });
      setRecentSessions(data.items);
    } finally {
      setSessionsLoading(false);
    }
  };

  // --- 渲染 ---
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: 900, margin: '0 auto' }}>
      <SessionBar
        sessions={recentSessions}
        currentSessionId={currentSessionId}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenHistory={() => setHistoryModalOpen(true)}
        loading={sessionsLoading}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <AgentChatWidget
          embedded={false}
          sessionId={currentSessionId ?? undefined}
          onSessionCreated={handleSessionCreated}
        />
      </div>
      <SessionHistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        onSelectSession={(id) => {
          handleSelectSession(id);
          setHistoryModalOpen(false);
        }}
      />
    </div>
  );
}
```

## 3. 对 AgentChatWidget 的扩展 (embedded=false 模式)

`embedded-agent-ui` 创建 AgentChatWidget 时预留了 `sessionId` 和 `onSessionCreated` props，但未实现逻辑。本 change 补充：

```typescript
// AgentChatWidget 内部逻辑补充

// --- Playground 模式: 恢复已有 session ---
useEffect(() => {
  if (!embedded && sessionId && sessionId !== currentSessionId) {
    // 切换到已有 session
    setCurrentSessionId(sessionId);
    // 主动断开旧 WebSocket (intentionalClose=true，不触发重连)
    wsRef.current.disconnect();
    setMessages([]);  // 清空消息（历史由 Agent 原生管理）
  }
  if (!embedded && !sessionId) {
    // New session 模式
    wsRef.current.disconnect();
    setMessages([]);
    setCurrentSessionId(null);
  }
}, [sessionId]);

// --- 发送消息时的 session 处理 ---
const handleSend = async () => {
  if (!embedded && !currentSessionId) {
    // Playground 新 session: 先创建 session 记录
    const session = await agentApi.createSession(selectedAgent, 'playground', selectedMode);
    setCurrentSessionId(session.id);
    onSessionCreated?.(session.id);
    // 然后建立 WebSocket 连接并发送消息
    wsRef.current.connect(session.id);
    wsRef.current.send({ type: 'message', content: inputValue, mode: selectedMode, context: buildContext() });
  } else {
    // 已有 session: 确保连接后发送
    if (!wsRef.current.connected && currentSessionId) {
      wsRef.current.connect(currentSessionId);
      // 等待连接建立后再发送
      wsRef.current.ws.onopen = () => {
        wsRef.current.send({ type: 'message', content: inputValue, mode: selectedMode, context: buildContext() });
      };
    } else {
      wsRef.current.send({ type: 'message', content: inputValue, mode: selectedMode, context: buildContext() });
    }
  }
};

// --- Playground 模式下 AgentSelector 和 ContextPanel 样式 ---
// embedded=false 时:
//   - AgentSelector compact={false} → 全宽水平布局，显示版本号和描述
//   - ContextPanel compact={false} → 全宽展开，默认展示
//   - MessageBubble showApply={false} → 只有 Copy 按钮，无 Apply
```

## 4. agentApi.ts 扩展

```typescript
// 本 change 在 embedded-agent-ui 创建的 agentApi 基础上补充:

import type { PaginatedResponse } from '../types';  // 复用现有通用分页类型

export const agentApi = {
  // ... (embedded-agent-ui 已实现)
  getAvailable: () => ...,
  createSession: (agentName, source, mode) => ...,

  // --- 本 change 新增 ---
  listSessions: (params: { source?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<AgentSession>>('/agents/sessions', { params }).then(r => r.data),

  getSession: (id: string) =>
    apiClient.get<AgentSession>(`/agents/sessions/${id}`).then(r => r.data),

  deleteSession: (id: string) =>
    apiClient.delete(`/agents/sessions/${id}`),
};
```

## 5. 导航集成

### 5.1 AppLayout 菜单

```typescript
// components/AppLayout.tsx — menuItems 修改
// 注意：需要显式类型注解 MenuProps['items'] 以支持 divider 项的 TypeScript 类型检查

import type { MenuProps } from 'antd';
import { MessageOutlined } from '@ant-design/icons';

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/skills', icon: <ExperimentOutlined />, label: 'Skill Library' },
  { key: '/connections', icon: <ApiOutlined />, label: 'Connections' },
  { key: '/pipelines', icon: <NodeIndexOutlined />, label: 'Pipelines' },
  { key: '/data-sources', icon: <DatabaseOutlined />, label: 'Data Sources' },
  { key: '/targets', icon: <SendOutlined />, label: 'Targets' },
  { key: '/runs', icon: <HistoryOutlined />, label: 'Run History' },
  { type: 'divider' },                                                         // ← NEW
  { key: '/playground', icon: <MessageOutlined />, label: 'Agent Playground' }, // ← NEW
  { type: 'divider' },                                                         // ← NEW
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
];
```

注意 onClick handler 中需要检查 key 是否存在（divider 没有 key）：
```typescript
onClick={({ key }) => key && navigate(key)}
```

### 5.2 路由注册

```typescript
// App.tsx — 新增路由
import AgentPlayground from './pages/AgentPlayground';

<Route element={<AppLayout />}>
  {/* ... 现有路由 ... */}
  <Route path="/playground" element={<AgentPlayground />} />   {/* ← NEW */}
</Route>
```

## 6. 样式设计

### Playground 模式 vs Embedded 模式差异

| 元素 | Playground (embedded=false) | Embedded (embedded=true) |
|------|---------------------------|------------------------|
| 容器宽度 | 100% 页面宽度 (max-width: 900px, 居中) | 400px Drawer |
| AgentSelector | 全宽，显示 Agent 描述和版本号 | 紧凑，只显示名称 |
| ContextPanel | 全宽展开，默认可见 | 紧凑折叠，默认收起 |
| MessageBubble | 宽消息区，showApply=false | 紧凑，showApply=true |
| 消息列表高度 | flex: 1 填满剩余空间 | 固定高度区域 |
| 输入框 | 全宽，4 行高度 | 紧凑，2 行高度 |

## 7. Session 生命周期流程

```
用户打开 /playground
    │
    ├── 自动加载最近 sessions (GET /agents/sessions?source=playground)
    │
    ├── 点击 [+ New Session]
    │     └── currentSessionId = null
    │         用户输入消息 → handleSend()
    │         ├── POST /agents/sessions (创建记录)
    │         ├── WS connect(sessionId)
    │         ├── ws.send(message)
    │         └── onSessionCreated(sessionId) → 更新 SessionBar
    │
    ├── 点击某个 Recent Session 标签
    │     └── currentSessionId = selectedId
    │         用户输入消息 → handleSend()
    │         ├── WS connect(sessionId)  (带 native_session_id resume)
    │         └── ws.send(message)  → Agent 恢复原生上下文
    │
    └── 点击删除 Session (×)
          ├── Popconfirm 确认
          ├── DELETE /agents/sessions/{id} (含 try-catch 错误处理)
          └── 从列表移除 + 如果是当前 session 则清空
```

## 8. 边缘情况处理

| 场景 | 处理方式 |
|------|---------|
| 无任何 sessions (首次使用) | SessionBar 显示 "点击 + New 开始对话" 提示 |
| 所有 Agent 都不可用 | 禁用 Send 按钮，显示 "未检测到可用的 Agent" 提示 |
| WebSocket 连接失败 | AgentWebSocket 自动重连 (最多 3 次，退避策略) |
| 快速切换 session | useEffect 中 disconnect 旧连接 + setMessages([])，消息不会混淆 |
| Session title 为 "New Session" | 后端在首次消息后自动更新 title，前端在 refreshRecentSessions() 时获取更新 |
| 删除 session 失败 (网络错误) | catch 后 message.error 提示，不从列表移除 |
| 页面刷新 | currentSessionId 重置为 null，用户从 recent sessions 中重新选择 |

## 9. 与其他 Change 的接口契约

### 复用 embedded-agent-ui 创建的组件

| 组件 | import 路径 | 使用方式 |
|------|------------|---------|
| AgentChatWidget | `components/agent/AgentChatWidget` | `embedded={false}` + session props |
| AgentSelector | `components/agent/AgentSelector` | 内部由 AgentChatWidget 使用 |
| ContextPanel | `components/agent/ContextPanel` | 内部由 AgentChatWidget 使用 |
| MessageBubble | `components/agent/MessageBubble` | `showApply={false}` |
| ApplyActions | `components/agent/ApplyActions` | 只显示 Copy |

### 扩展 embedded-agent-ui 创建的文件

| 文件 | 扩展内容 |
|------|---------|
| `services/agentApi.ts` | 添加 listSessions, getSession, deleteSession |
| `components/agent/AgentChatWidget.tsx` | 补充 embedded=false 的 session 恢复逻辑 |

### 依赖 agent-backend-core 的 API

| API | 用途 |
|-----|------|
| `GET /agents/available` | 获取 Agent 列表 (AgentSelector) |
| `POST /agents/sessions` | 创建新 session |
| `GET /agents/sessions?source=playground` | 列出 Playground sessions (PaginatedResponse 格式) |
| `GET /agents/sessions/{id}` | 获取 session 详情 |
| `DELETE /agents/sessions/{id}` | 删除 session (返回 204) |
| `WS /agents/sessions/{id}/ws` | 流式对话 |
