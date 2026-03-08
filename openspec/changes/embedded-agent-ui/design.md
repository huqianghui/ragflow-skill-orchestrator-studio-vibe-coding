# Design: 嵌入式 Agent UI — 编辑器页面的 AI 助手

## 1. 组件架构

```
SkillEditor / PipelineEditor / BuiltinSkillEditor
  │
  ├── 页面内容 (Monaco / ReactFlow / ConfigForm)
  │
  └── <Drawer placement="right" width={400} mask={false}>
        └── <AgentChatWidget embedded={true} autoContext={...} onApplyCode={...}>
              ├── <AgentSelector agents={...} compact={true} />
              ├── <ContextPanel autoContext={...} compact={true} />
              ├── <div className="message-list">
              │     └── <MessageBubble /> × N
              │           └── <ApplyActions /> (on code blocks)
              └── <Input.TextArea + Send Button>
```

## 2. TypeScript 类型定义

```typescript
// types/agent.ts

// --- Agent 信息 (对应后端 AgentInfoResponse) ---

export interface AgentInfo {
  name: string;
  display_name: string;
  icon: string;
  description: string;
  modes: string[];
  available: boolean;
  version: string | null;
}

// --- Session (对应后端 AgentSessionResponse) ---

export interface AgentSession {
  id: string;
  agent_name: string;
  native_session_id: string | null;
  title: string;
  mode: string;
  source: string;
  created_at: string;
  updated_at: string;
}

// --- WebSocket 消息 ---

export interface AgentChatMessage {
  type: 'message';
  content: string;
  mode: string;
  context?: AgentContextData | null;
}

export interface AgentContextData {
  type: 'skill' | 'pipeline' | 'free';
  skill?: Record<string, unknown>;
  pipeline?: Record<string, unknown>;
  selected_node?: string;
  error_result?: Record<string, unknown>;
  attachments?: Attachment[];
}

export interface Attachment {
  type: 'skill' | 'pipeline' | 'text';
  label: string;
  content: string;
}

// --- AgentEvent (服务端 → 客户端) ---

export interface AgentEvent {
  type: 'text' | 'code' | 'error' | 'session_init' | 'done';
  content: string;
  metadata: Record<string, unknown>;
}

// --- Code Block (从 Markdown 解析出的代码块) ---

export interface CodeBlock {
  language: string;
  code: string;
}

// --- Pipeline Action (Agent 建议的 Pipeline 修改) ---

export type PipelineAction =
  | { action: 'add_node'; skill_name: string; position: number; config_overrides?: Record<string, unknown> }
  | { action: 'remove_node'; node_id: string }
  | { action: 'update_node'; node_id: string; changes: Partial<PipelineNode> }
  | { action: 'update_config'; node_id: string; config_overrides: Record<string, unknown> };

// --- 内部消息类型 (AgentChatWidget 内部使用) ---

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
```

## 3. API 客户端

```typescript
// services/agentApi.ts

import apiClient from './api';  // 复用现有 axios 实例（统一 baseURL、timeout、error interceptor）
import type { AgentInfo, AgentSession, AgentChatMessage, AgentEvent } from '../types/agent';

// --- REST ---

export const agentApi = {
  getAvailable: () =>
    apiClient.get<AgentInfo[]>('/agents/available').then(r => r.data),

  createSession: (agentName: string, source: string, mode: string) =>
    apiClient.post<AgentSession>('/agents/sessions', {
      agent_name: agentName, source, mode,
    }).then(r => r.data),

  // 以下方法由 agent-playground change 补充:
  // listSessions, getSession, deleteSession
};

// --- WebSocket ---

export class AgentWebSocket {
  private ws: WebSocket | null = null;
  private eventCallback: ((event: AgentEvent) => void) | null = null;
  private errorCallback: ((error: Event) => void) | null = null;
  private closeCallback: (() => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private lastSessionId: string | null = null;
  private intentionalClose = false;

  connect(sessionId: string): void {
    this.lastSessionId = sessionId;
    this.intentionalClose = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = import.meta.env.VITE_WS_BASE_URL
      || `${protocol}//${window.location.host}/api/v1`;
    this.ws = new WebSocket(`${base}/agents/sessions/${sessionId}/ws`);

    this.ws.onmessage = (evt) => {
      const event: AgentEvent = JSON.parse(evt.data);
      this.eventCallback?.(event);
    };

    this.ws.onerror = (evt) => {
      this.errorCallback?.(evt);
    };

    this.ws.onclose = () => {
      // 自动重连 (非主动断开 && 未超过最大次数)
      if (!this.intentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => {
          if (this.lastSessionId) this.connect(this.lastSessionId);
        }, 1000 * this.reconnectAttempts);  // 退避策略
      } else {
        this.closeCallback?.();
      }
    };

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;  // 连接成功重置计数
    };
  }

  send(message: AgentChatMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;  // 未连接时返回 false
  }

  onEvent(callback: (event: AgentEvent) => void): void {
    this.eventCallback = callback;
  }

  onError(callback: (error: Event) => void): void {
    this.errorCallback = callback;
  }

  onClose(callback: () => void): void {
    this.closeCallback = callback;
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
```

## 4. 组件详细设计

### 4.1 AgentChatWidget (核心共享组件)

```typescript
interface AgentChatWidgetProps {
  // 模式
  embedded?: boolean;           // true=Drawer, false=Playground

  // 自动上下文 (编辑器传入)
  // data 使用 Record<string, unknown> 而非 Skill | Pipeline，因为编辑器传入的是当前编辑状态的部分字段
  autoContext?: {
    type: 'skill' | 'pipeline';
    data: Record<string, unknown>;
    selectedNode?: string;
    errorResult?: Record<string, unknown>;
  };

  // Apply 回调 (编辑器传入)
  onApplyCode?: (code: string) => void;                           // SkillEditor: 替换 sourceCode
  onApplyConfig?: (config: Record<string, unknown>) => void;      // BuiltinSkillEditor: form.setFieldsValue
  onApplyPipelineAction?: (action: PipelineAction) => void;       // PipelineEditor: 修改 graph_data

  // Session (Playground 传入 — 本 change 预留接口，不实现)
  sessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
}
```

内部状态:
- `agents: AgentInfo[]` — 从 GET /available 获取
- `selectedAgent: string` — 当前选中的 agent name
- `selectedMode: string` — 当前选中的模式
- `messages: ChatMessage[]` — 对话消息列表
- `inputValue: string` — 输入框内容
- `loading: boolean` — 是否正在等待 agent 响应
- `wsRef: AgentWebSocket` — WebSocket 连接实例
- `currentSessionId: string | null` — 当前临时 session id

生命周期:
- **mount**: 调用 `agentApi.getAvailable()` 获取 agent 列表
- **发送消息**: 如无 session，先 `agentApi.createSession()` 创建，然后 `ws.connect(sessionId)` + `ws.send(message)`
- **接收事件**: 流式追加到 messages 列表
- **unmount** (Drawer 关闭): `ws.disconnect()`，不持久化 session

### 4.2 AgentSelector

```typescript
interface AgentSelectorProps {
  agents: AgentInfo[];
  selectedAgent: string;
  selectedMode: string;
  onAgentChange: (name: string) => void;
  onModeChange: (mode: string) => void;
  compact?: boolean;
}
```

- 使用 Ant Design `<Select>` 或 `<Segmented>` 组件
- Agent 选择器显示 display_name + 可用状态 (Tag: ✅/❌)
- Mode 选择器动态更新为当前 Agent 的 modes 列表
- compact=true 时水平排列，紧凑间距

### 4.3 ContextPanel

```typescript
interface ContextPanelProps {
  autoContext?: AgentChatWidgetProps['autoContext'];
  attachments: Attachment[];
  onAddAttachment: (type: 'skill' | 'pipeline' | 'text') => void;
  onRemoveAttachment: (index: number) => void;
  compact?: boolean;
}
```

- 自动上下文显示为只读 Tag (如 "✅ Skill: text-cleaner")
- 手动附件可添加/删除
- 使用 Ant Design `<Tag>` + `<Button size="small">`
- 折叠展示，默认收起

### 4.4 MessageBubble

```typescript
interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  onApplyCode?: (code: string) => void;
  showApply?: boolean;
}
```

- User 消息：右对齐，简单文本
- Assistant 消息：左对齐，Markdown 渲染
- 代码块从 content 中解析 (```language\n...```)
- 每个代码块下方显示 `<ApplyActions>`

### 4.5 ApplyActions

```typescript
interface ApplyActionsProps {
  code: string;
  language?: string;
  onApply?: () => void;
  showApply?: boolean;
}
```

- Apply to Editor: 调用 onApplyCode 回调
- Copy: `navigator.clipboard.writeText(code)`
- 使用 Ant Design `<Button size="small">` + `<Space>`

## 5. 编辑器集成

### 5.1 SkillEditor 集成

```tsx
// SkillEditor.tsx 中新增:

const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);

// 顶部操作栏加按钮
<Button icon={<RobotOutlined />} onClick={() => setAgentDrawerOpen(true)}>
  Agent
</Button>

// 页面底部加 Drawer
<Drawer
  title="AI Agent"
  placement="right"
  width={400}
  open={agentDrawerOpen}
  onClose={() => setAgentDrawerOpen(false)}
  mask={false}
>
  <AgentChatWidget
    embedded
    autoContext={{
      type: 'skill',
      data: { name, description, skill_type: 'python_code', source_code: sourceCode,
              test_input: testInputStr ? JSON.parse(testInputStr) : null },
    }}
    onApplyCode={(code) => {
      setSourceCode(code);
      setDirty(true);
    }}
  />
</Drawer>
```

### 5.2 PipelineEditor 集成

```tsx
// PipelineEditor.tsx 中新增:

const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);

// 顶部操作栏加按钮
<Button icon={<RobotOutlined />} onClick={() => setAgentDrawerOpen(true)}>
  Agent
</Button>

// 页面底部加 Drawer
<Drawer
  title="AI Agent"
  placement="right"
  width={400}
  open={agentDrawerOpen}
  onClose={() => setAgentDrawerOpen(false)}
  mask={false}
>
  <AgentChatWidget
    embedded
    autoContext={{
      type: 'pipeline',
      data: {
        name: pipeline?.name,
        status: pipeline?.status,
        graph_data: { nodes },  // 用当前编辑状态的 nodes，而非 pipeline 原始数据
      },
      selectedNode: selectedNodeId || undefined,
    }}
    onApplyPipelineAction={(action) => {
      // 4 种 action 的处理逻辑:
      // 'add_node': 从 skills 列表查找 skill → 构建新 node → setNodes([...nodes, newNode])
      // 'remove_node': setNodes(nodes.filter(n => n.id !== action.node_id))
      // 'update_node': setNodes(nodes.map(n => n.id === action.node_id ? {...n, ...action.changes} : n))
      // 'update_config': setNodes(nodes.map(n => n.id === action.node_id ? {...n, config_overrides: action.config_overrides} : n))
      // 最后调用 deriveEdges() 重新派生边
      handleApplyPipelineAction(action);
    }}
  />
</Drawer>
```

注意：PipelineEditor 当前没有 `dirty` 状态变量。Apply 后依赖用户手动 Save。

### 5.3 BuiltinSkillEditor 集成

```tsx
// BuiltinSkillEditor.tsx 中新增:

const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);

// 顶部操作栏加按钮
<Button icon={<RobotOutlined />} onClick={() => setAgentDrawerOpen(true)}>
  Agent
</Button>

// 页面底部加 Drawer
<Drawer
  title="AI Agent"
  placement="right"
  width={400}
  open={agentDrawerOpen}
  onClose={() => setAgentDrawerOpen(false)}
  mask={false}
>
  <AgentChatWidget
    embedded
    autoContext={{
      type: 'skill',
      data: {
        name: skill?.name,
        description: skill?.description,
        skill_type: skill?.skill_type,
        config_schema: skill?.config_schema,
        config_values: configValues,
      },
    }}
    onApplyConfig={(config) => {
      // BuiltinSkillEditor 使用 Ant Design Form 管理配置
      // 需要通过 form.setFieldsValue 写入
      form.setFieldsValue(config);
      setDirty(true);
    }}
  />
</Drawer>
```

## 6. 新增依赖

| 包 | 版本 | 用途 | 备注 |
|----|------|------|------|
| `react-markdown` | ^10.1.0 | 渲染 Agent 返回的 Markdown | **已安装**，无需再装 |
| `react-syntax-highlighter` | ^15.6 | 代码块语法高亮 | 新安装，需同装 @types |
| `@types/react-syntax-highlighter` | ^15.5 | TS 类型声明 | devDependency |

## 7. 与 agent-playground 的共享契约

本 change 创建的组件被 `agent-playground` 复用时的预留接口：

| AgentChatWidget prop | 本 change 实现 | agent-playground 补充 |
|---------------------|---------------|---------------------|
| `embedded` | ✅ true 模式完整实现 | false 模式逻辑 |
| `autoContext` | ✅ 完整实现 | 直接复用 |
| `onApplyCode` | ✅ 完整实现 | 不使用 (传 undefined) |
| `onApplyConfig` | ✅ 完整实现 | 不使用 (传 undefined) |
| `sessionId` | 预留 prop，不实现逻辑 | 补充 resume 逻辑 |
| `onSessionCreated` | 预留 prop，不实现逻辑 | 补充回调逻辑 |

agentApi.ts 的共享契约：

| 方法 | 本 change 实现 | agent-playground 补充 |
|------|---------------|---------------------|
| `getAvailable()` | ✅ | 直接复用 |
| `createSession()` | ✅ | 直接复用 |
| `AgentWebSocket` | ✅ | 直接复用 |
| `listSessions()` | 不实现 | 补充 |
| `getSession()` | 不实现 | 补充 |
| `deleteSession()` | 不实现 | 补充 |
