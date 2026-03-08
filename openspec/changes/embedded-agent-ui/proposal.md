# 嵌入式 Agent UI：编辑器页面的 AI 助手

## 变更编号

`embedded-agent-ui`

## 状态

`proposed`

## 前置依赖

- `rename-to-agentic-ragflow` (必须先合并)
- `agent-backend-core` (必须先合并 — 依赖后端 API)

## 问题描述

Agentic RAGFlow Studio 的用户在编写 Skill 代码和编排 Pipeline 时，需要 AI Agent 的即时辅助。当前的编辑器页面（SkillEditor、PipelineEditor、BuiltinSkillEditor）是纯手动操作，用户无法：

- **在编辑上下文中**直接与 Agent 对话（需要切换到外部终端）
- **自动传递当前编辑内容**作为 Agent 上下文（需要手动复制粘贴）
- **将 Agent 生成的代码**直接应用到编辑器（需要手动复制回来）
- **选择不同的 Agent**根据任务需求（Claude Code 做复杂重构、Codex 快速生成等）

## 解决方案

在 SkillEditor、PipelineEditor、BuiltinSkillEditor 三个编辑器页面中，添加右侧 Drawer 抽屉式 Agent 面板，提供上下文感知的 AI 对话能力和一键 Apply 机制。

### 交互设计

#### 入口

每个编辑器页面的顶部操作栏增加一个 Agent 按钮（图标: `RobotOutlined`），点击后打开右侧 Drawer。

```
┌─ 编辑器页面 ─────────────────────────────────────────────────────┐
│  ← Back    Edit: text-cleaner    [Save] [Test] [🤖 Agent]       │
│                                                                   │
│  ┌─ 编辑区域 ──────────────────┐  ┌─ Agent Drawer (320px) ────┐ │
│  │                              │  │                            │ │
│  │  Monaco Editor               │  │  [Claude Code ▼] [Code ▼] │ │
│  │  / ReactFlow Canvas          │  │                            │ │
│  │                              │  │  Context: ✅ text-cleaner  │ │
│  │                              │  │  [+ Attach]                │ │
│  │                              │  │  ─────────────────────     │ │
│  │                              │  │  User: 帮我优化process...  │ │
│  │                              │  │                            │ │
│  │                              │  │  Claude: 优化方案如下...    │ │
│  │                              │  │  ```python                 │ │
│  │                              │  │  def process(...):         │ │
│  │                              │  │  ```                       │ │
│  │                              │  │  [▶Apply] [📋Copy] [👁Diff]│ │
│  │                              │  │  ─────────────────────     │ │
│  │                              │  │  [Type message...] [Send]  │ │
│  └──────────────────────────────┘  └────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

#### Drawer 内部结构

Drawer 使用 Ant Design 的 `<Drawer>` 组件，`placement="right"`，宽度 400px，`mask={false}`（不遮挡主编辑区，用户可以同时操作编辑器和 Agent）。

Drawer 内部渲染 `<AgentChatWidget embedded={true} />` 共享组件。

### 组件设计

#### 1. AgentChatWidget (核心共享组件)

此组件在本 change 中创建，同时被 `agent-playground` change 复用。

```typescript
interface AgentChatWidgetProps {
  // 模式
  embedded?: boolean;      // true=编辑器 Drawer, false=Playground 全屏

  // 自动上下文 (编辑器页面传入)
  autoContext?: {
    type: 'skill' | 'pipeline';
    data: Skill | Pipeline;
    selectedNode?: string;
    errorResult?: PipelineDebugResult | SkillTestResult;
  };

  // Apply 回调 (编辑器页面传入)
  onApplyCode?: (code: string) => void;
  onApplyPipelineAction?: (action: PipelineAction) => void;

  // Session (Playground 模式专用 — 本 change 中不实现)
  sessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
}
```

**embedded=true 时的行为特点：**
- 不显示 session 管理 bar
- 自动上下文显示为只读标签（如 "✅ Skill: text-cleaner"）
- 页面关闭时 session 丢弃（不持久化到 Playground 历史）
- Agent 生成的代码块带 Apply 按钮

**embedded=false 时的行为特点（留给 `agent-playground` 实现）：**
- 显示 session 管理 bar
- 无 Apply 按钮（Playground 没有编辑器目标）
- Session 持久化

#### 2. AgentSelector

Agent 和 Mode 的选择器组件：

```typescript
interface AgentSelectorProps {
  agents: AgentInfo[];           // 来自 GET /agents/available
  selectedAgent: string;
  selectedMode: string;
  onAgentChange: (name: string) => void;
  onModeChange: (mode: string) => void;
  compact?: boolean;             // embedded 模式用紧凑样式
}
```

- 显示可用状态（✅ 可用 / ❌ 未检测到）
- 切换 Agent 后，Mode 选择器动态更新为该 Agent 支持的模式列表
- 不可用的 Agent 置灰但仍显示（提示安装方式）

#### 3. ContextPanel

上下文展示和手动附加：

```typescript
interface ContextPanelProps {
  autoContext?: AgentChatWidgetProps['autoContext'];
  attachments: Attachment[];
  onAddAttachment: (type: 'skill' | 'pipeline' | 'text') => void;
  onRemoveAttachment: (index: number) => void;
  compact?: boolean;
}
```

- 自动上下文显示为不可删除的标签（Tag 组件）
- 手动附件可添加和删除
- 折叠式展示，避免占用过多聊天空间

#### 4. MessageBubble

消息渲染组件，支持 Markdown 和代码块：

```typescript
interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  codeBlocks?: CodeBlock[];
  onApplyCode?: (code: string) => void;
  showApply?: boolean;           // embedded 模式显示 Apply 按钮
}
```

- Markdown 渲染使用 `react-markdown`
- 代码块使用语法高亮
- 代码块下方显示操作按钮行：
  - **Apply to Editor** (仅 embedded 模式)：调用 `onApplyCode`
  - **Copy**：复制到剪贴板
  - **Diff** (仅 Skill Editor)：在 Monaco 中显示 inline diff 预览

#### 5. ApplyActions

Apply/Copy/Diff 按钮组：

```typescript
interface ApplyActionsProps {
  code: string;
  language?: string;
  onApply?: () => void;
  onDiff?: () => void;
  showApply?: boolean;
  showDiff?: boolean;
}
```

### Apply 机制详细设计

#### Skill Editor 中的 Apply

```
Agent 返回代码块
  → 用户点击 [Apply to Editor]
  → SkillEditor.onApplyCode(newCode)
  → setSourceCode(newCode)
  → Monaco Editor 自动更新
  → dirty 状态标记为 true
  → 用户可以继续编辑或 Save
```

#### Pipeline Editor 中的 Apply

Pipeline 的 Apply 更复杂，因为涉及图结构修改。Agent 生成的 pipeline action 是结构化的 JSON：

```typescript
type PipelineAction =
  | { action: 'add_node'; skill_name: string; position: number; config_overrides?: Record<string, unknown> }
  | { action: 'remove_node'; node_id: string }
  | { action: 'update_node'; node_id: string; changes: Partial<PipelineNode> }
  | { action: 'update_config'; node_id: string; config_overrides: Record<string, unknown> };
```

```
Agent 返回 JSON action
  → 用户点击 [Apply to Pipeline]
  → PipelineEditor.onApplyPipelineAction(action)
  → 解析 action type，修改 graph_data
  → ReactFlow 节点/边重新渲染
  → dirty 状态标记为 true
```

#### Builtin Skill Editor 中的 Apply

Builtin Skill Editor 不涉及源代码编辑，Agent 主要辅助配置参数：

```
Agent 返回配置建议 (JSON)
  → 用户点击 [Apply]
  → 更新 config_values 状态
  → ConfigSchemaForm 自动更新
```

### WebSocket 连接管理

```typescript
// agentApi.ts 中新增

class AgentWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;

  connect(sessionId: string): void
  send(message: AgentChatMessage): void
  onEvent(callback: (event: AgentEvent) => void): void
  disconnect(): void
}
```

- 每个 Drawer 打开时建立 WebSocket 连接
- Drawer 关闭时断开连接
- 自动重连机制（最多 3 次）
- 连接状态在 UI 中显示（连接中/已连接/断开）

### 新增文件

```
frontend/src/
├── components/agent/
│   ├── AgentChatWidget.tsx     # 核心对话组件 (shared)
│   ├── AgentSelector.tsx       # Agent + Mode 选择器
│   ├── ContextPanel.tsx        # 上下文面板
│   ├── MessageBubble.tsx       # 消息气泡
│   └── ApplyActions.tsx        # Apply/Copy/Diff 按钮组
├── services/
│   └── agentApi.ts             # Agent REST + WebSocket 客户端
└── types/
    └── agent.ts                # Agent 相关 TypeScript 类型
```

### 修改文件

| 文件 | 改动 |
|------|------|
| `frontend/src/pages/SkillEditor.tsx` | 添加 Agent 按钮 + Drawer + onApplyCode |
| `frontend/src/pages/PipelineEditor.tsx` | 添加 Agent 按钮 + Drawer + onApplyPipelineAction |
| `frontend/src/pages/BuiltinSkillEditor.tsx` | 添加 Agent 按钮 + Drawer + onApplyConfig |
| `frontend/package.json` | 添加 `react-markdown` 依赖 (如果未安装) |

### 新增依赖

| 包 | 用途 |
|----|------|
| `react-markdown` | 渲染 Agent 返回的 Markdown 内容 |
| `react-syntax-highlighter` | 代码块语法高亮 |

## 影响范围

| 维度 | 说明 |
|------|------|
| 影响模块 | `frontend/` — 新增 agent 组件 + 修改 3 个编辑器页面 |
| 依赖关系 | 依赖 `agent-backend-core` 提供的 REST + WebSocket API |
| 被依赖方 | `agent-playground` 复用本 change 创建的 `AgentChatWidget` 组件 |
| 风险等级 | **中** — 修改 3 个已有页面的布局，需要确保不破坏现有功能 |
| 关键风险 | Drawer 打开时编辑区域变窄，需要测试 Monaco Editor 和 ReactFlow 的响应式行为 |

## 成功标准

1. SkillEditor 中点击 Agent 按钮，右侧 Drawer 正常打开
2. Agent 选择器正确显示可用 Agent 列表和模式
3. 自动上下文正确显示当前编辑的 Skill/Pipeline 信息
4. 用户可以发送消息并收到 Agent 的流式响应
5. 代码块渲染正确，Apply 按钮可将代码写入编辑器
6. Drawer 打开/关闭不影响编辑器的正常功能
7. `npx tsc -b` + `npm run build` 全通过

## 与其他 Change 的协调

### 与 `agent-backend-core` 的接口对齐

本 change 的前端代码严格依赖 `agent-backend-core` 定义的 API 契约：
- REST: `GET /agents/available`、`POST /agents/sessions`
- WebSocket: `WS /agents/sessions/{id}/ws`
- 事件类型: `AgentEvent` 的 type 字段枚举值
- `types/agent.ts` 中的类型定义与后端 `schemas/agent.py` 一一对应

### 为 `agent-playground` 提供的共享组件

本 change 创建的以下组件将被 `agent-playground` 直接复用：
- `AgentChatWidget` — 通过 `embedded={false}` 和 `sessionId` props 切换为 Playground 模式
- `AgentSelector` — 完全复用
- `MessageBubble` — 完全复用（Playground 中 `showApply={false}`）
- `agentApi.ts` — 完全复用

本 change **不实现**的功能（留给 `agent-playground`）：
- Session 管理 UI（SessionBar 组件）
- `AgentChatWidget` 的 `sessionId` 和 `onSessionCreated` props 的逻辑
- AppLayout 导航菜单更新

### 与 `agent-playground` 的文件冲突风险

**无冲突的文件：**
- `agent-playground` 新建的文件 (`AgentPlayground.tsx`, `SessionBar.tsx`) 本 change 不涉及
- 本 change 新建的 agent 组件目录，`agent-playground` 只读复用

**可能冲突的文件：**
- `AgentChatWidget.tsx` — 本 change 创建基础版 (embedded 模式)，`agent-playground` 需要添加 session 逻辑
  - **协调方案**: 本 change 预留 `sessionId` 和 `sessionMode` props 接口，但不实现逻辑。`agent-playground` 填充实现。
- `agentApi.ts` — 本 change 创建基础版 (WebSocket + 基本 REST)，`agent-playground` 需要添加 session CRUD
  - **协调方案**: 本 change 实现 `agentApi.ws` 和 `agentApi.getAvailable()`，`agent-playground` 添加 `agentApi.sessions.*` 方法
