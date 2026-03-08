# Agent Playground：独立的 AI 助手对话页面

## 变更编号

`agent-playground`

## 状态

`proposed`

## 前置依赖

- `rename-to-agentic-ragflow` (必须先合并)
- `agent-backend-core` (必须先合并 — 依赖后端 API)
- `embedded-agent-ui` (建议先合并 — 复用其创建的共享组件；也可并行开发，合并时解决小冲突)

## 问题描述

嵌入式 Agent（`embedded-agent-ui`）为编辑器页面提供了上下文绑定的即时 AI 辅助。但用户还需要一个**独立的、自由的** Agent 交互空间来：

- **自由探索**：不绑定特定 Skill 或 Pipeline，开放式地与 Agent 对话
- **Session 管理**：像使用 Claude Code 终端一样，创建新会话、继续旧会话、浏览历史
- **深度任务**：处理需要多轮对话的复杂任务（如设计完整的 Pipeline 架构）
- **对比 Agent**：在同一个界面中切换不同 Agent，比较它们的输出质量
- **附加上下文**：手动选择 Skill、Pipeline 或粘贴文本作为对话上下文

## 解决方案

新增 Agent Playground 独立页面，提供完整的 Session 管理和自由对话能力，作为 Agentic RAGFlow Studio 导航中的一等公民。

### 页面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent Playground                                                │
│                                                                  │
│  ┌── Session Bar ──────────────────────────────────────────────┐│
│  │ [+ New Session]  │  Recent: "PDF处理" "分词Skill" "性能优化" ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌── Agent + Mode ─────────────────────────────────────────────┐│
│  │ Agent: [Claude Code ▼]   Mode: [Code ▼]                     ││
│  │ Status: ✅ 已连接  v1.0.20                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌── Context ──────────────────────────────────────────────────┐│
│  │ 📎 [+ Skill] [+ Pipeline] [+ Text]                          ││
│  │ Attached: 🏷️ text-cleaner (skill)  🏷️ pdf-pipeline (pipe)   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌── Chat Area (主体) ─────────────────────────────────────────┐│
│  │                                                              ││
│  │  User: 我想设计一个处理中日韩文档的 Pipeline，               ││
│  │        需要支持 PDF 和 Word 格式...                          ││
│  │                                                              ││
│  │  Claude Code:                                                ││
│  │  好的，我来帮你规划这个 Pipeline。考虑到中日韩文档的特点...   ││
│  │                                                              ││
│  │  ## 推荐 Pipeline 结构                                       ││
│  │                                                              ││
│  │  ```                                                         ││
│  │  Document Cracker → Language Detector → Text Splitter        ││
│  │       → CJK Tokenizer → Embedding → Target Writer           ││
│  │  ```                                                         ││
│  │                                                              ││
│  │  [📋 Copy]                                                   ││
│  │                                                              ││
│  │  User: CJK Tokenizer 有内置的 Skill 吗？                    ││
│  │                                                              ││
│  │  Claude Code: 目前没有内置的 CJK Tokenizer Skill...          ││
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌── Input ────────────────────────────────────────────────────┐│
│  │  Type your message...                              [Send]    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Session 管理

#### Session 生命周期

```
[+ New Session] → 选择 Agent → 发送第一条消息
    → Backend 调用 Agent CLI，从输出中提取 native_session_id
    → 创建 AgentSession 记录 (our_id → native_id 映射)
    → Session title = 首条消息摘要 (截取前 30 字)
    → 后续消息通过 native_session_id resume 原生 session

[Continue: "PDF处理"] → 加载 session 元信息
    → WebSocket 连接 → 发送消息时带 session_id
    → Backend 用 native_session_id 调用 CLI Agent 的 resume 功能
    → Agent 恢复完整上下文（Agent 自己管理的历史）
```

#### Session Bar 组件

```typescript
interface SessionBarProps {
  sessions: AgentSession[];              // 复用 types/agent.ts 的 AgentSession 类型
  currentSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenHistory: () => void;
}
```

Session 列表显示：
- 标题（首条消息摘要）
- Agent 名称 + 图标
- 最后活跃时间（相对时间，如 "3h ago"）
- 删除按钮（带确认对话框）

排序：按 `updated_at` 降序

#### Session 与原生 CLI Session 的映射

| 我们管理的 | CLI Agent 管理的 |
|-----------|----------------|
| session 元信息 (id, title, agent, time) | 完整对话历史、文件编辑记录、Agent 内部状态 |
| our_session_id → native_session_id 映射 | native_session_id 是 Agent 的真实 session |
| Session CRUD API | Agent 的 resume/continue 机制 |

### 与嵌入式 Agent 的区别

| 特性 | Playground | 嵌入式 (Drawer) |
|------|-----------|----------------|
| Session 管理 | ✅ 完整 (New/Continue/History) | ❌ 临时，页面关闭即结束 |
| 上下文来源 | 手动附加 | 自动检测 + 手动附加 |
| Apply 操作 | ❌ 无 (只有 Copy/Export) | ✅ Apply to Editor/Pipeline |
| 页面宽度 | 全屏 | 400px Drawer |
| 独立路由 | ✅ /playground | ❌ 嵌入在编辑器页面 |
| 消息显示 | 全屏宽度，更舒适 | 紧凑布局 |

### 共享组件复用

本 change 复用 `embedded-agent-ui` 创建的以下组件：

| 组件 | 复用方式 |
|------|---------|
| `AgentChatWidget` | `embedded={false}` + `sessionId` props |
| `AgentSelector` | 直接复用 |
| `MessageBubble` | `showApply={false}` |
| `ContextPanel` | 直接复用 (手动模式) |
| `agentApi.ts` | 扩展 session CRUD 方法 |

### 导航集成

在 AppLayout 的侧边栏菜单中添加 Playground 入口：

```typescript
// 新增菜单项
{ key: '/playground', icon: <MessageOutlined />, label: 'Agent Playground' }
```

位置：在 "Run History" 和 "Settings" 之间，作为独立的 "Agent" 分组。

```
Sider 菜单:
  Dashboard
  Skill Library
  Connections
  Pipelines
  Data Sources
  Targets
  Run History
  ── Agent ──────
  Agent Playground    ← NEW
  ── System ─────
  Settings
```

### 路由注册

```typescript
// App.tsx 或路由配置中
{ path: '/playground', element: <AgentPlayground /> }
```

### 新增文件

```
frontend/src/
├── pages/
│   └── AgentPlayground.tsx        # Playground 页面
└── components/agent/
    └── SessionBar.tsx             # Session 管理组件
```

### 修改文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/AppLayout.tsx` | 添加 Playground 菜单项 + Agent 分组 |
| `frontend/src/App.tsx` (或路由文件) | 添加 /playground 路由 |
| `frontend/src/components/agent/AgentChatWidget.tsx` | 实现 sessionId/sessionMode 相关逻辑 |
| `frontend/src/services/agentApi.ts` | 添加 session CRUD 方法 |

### 对 AgentChatWidget 的扩展

`embedded-agent-ui` 中创建的 `AgentChatWidget` 预留了 session 相关 props 但未实现。本 change 补充实现：

```typescript
// AgentChatWidget 中新增的逻辑 (由本 change 实现)

if (!props.embedded && props.sessionId) {
  // Playground 模式: 使用传入的 sessionId
  // WebSocket 消息中携带 session_id 字段
  // Agent 通过 native session resume 恢复上下文
}

if (!props.embedded && !props.sessionId) {
  // 新 session: 首次对话后从 session_init 事件中获取 sessionId
  // 调用 onSessionCreated 回调通知 Playground 页面
}
```

## 影响范围

| 维度 | 说明 |
|------|------|
| 影响模块 | `frontend/` — 新增 Playground 页面 + 修改导航和路由 |
| 依赖关系 | 依赖 `agent-backend-core` 的 session API，复用 `embedded-agent-ui` 的组件 |
| 被依赖方 | 无 |
| 风险等级 | **低** — 主要是新增页面，对已有页面影响仅限于导航菜单 |
| 关键风险 | Session resume 依赖 CLI Agent 的原生 session 机制，不同 Agent 的行为可能不一致 |

## 成功标准

1. `/playground` 路由可正常访问 Agent Playground 页面
2. 侧边栏导航显示 "Agent Playground" 菜单项
3. 可创建新 Session 并与 Agent 进行流式对话
4. 可从 Session 历史中选择并 Continue 之前的对话
5. Agent 正确 resume 原生 session（对话上下文连续）
6. 可手动附加 Skill / Pipeline 作为对话上下文
7. 可在不同 Agent 之间切换
8. 可删除不需要的 Session
9. `npx tsc -b` + `npm run build` 全通过

## 与其他 Change 的协调

### 与 `embedded-agent-ui` 的组件共享

- 本 change **不重新创建** agent 组件，完全复用 `embedded-agent-ui` 的产物
- 唯一修改的共享文件是 `AgentChatWidget.tsx` (补充 session 逻辑) 和 `agentApi.ts` (补充 session API)
- 如果与 `embedded-agent-ui` 并行开发，需要在 merge 时协调 `AgentChatWidget.tsx` 的变更

### 与 `agent-backend-core` 的 API 对齐

本 change 使用的后端 API (全部由 `agent-backend-core` 提供):
- `POST /agents/sessions` — 创建 session
- `GET /agents/sessions?source=playground` — 列出 Playground sessions
- `GET /agents/sessions/{id}` — 获取 session 详情
- `DELETE /agents/sessions/{id}` — 删除 session
- `WS /agents/sessions/{id}/ws` — 流式对话 (消息中携带 session_id 触发 resume)
- `GET /agents/available` — 获取可用 Agent 列表

### 并行开发策略

如果使用 worktree 与 `embedded-agent-ui` 并行开发:
- 本 change 的 worktree 中可以先创建 `AgentChatWidget` 的 **Playground 版本**
- merge 时将两个版本合并为一个支持 `embedded` 和 `sessionMode` 的统一组件
- 或者等 `embedded-agent-ui` 先 merge，本 change rebase 后补充 session 逻辑（更简单）
