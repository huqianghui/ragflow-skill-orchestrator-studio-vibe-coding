# Tasks: embedded-agent-ui

## Tasks

### 类型定义 & API 客户端

- [x] 1. 创建 `frontend/src/types/agent.ts` — AgentInfo, AgentSession, AgentChatMessage, AgentEvent, AgentContextData, Attachment, CodeBlock, PipelineAction (update_node.changes 用 Partial<PipelineNode>), ChatMessage (内部消息类型)
- [x] 2. 创建 `frontend/src/services/agentApi.ts` — 复用现有 api.ts 的 apiClient (不创建新 axios 实例) + agentApi (getAvailable, createSession) + AgentWebSocket 类 (connect, send 返回 boolean, onEvent, onError, onClose, disconnect, 自动重连最多 3 次含退避策略)

### 共享组件

- [x] 3. 安装依赖: `npm install react-syntax-highlighter @types/react-syntax-highlighter` (react-markdown 已安装 ^10.1.0，无需再装)
- [x] 4. 创建 `frontend/src/components/agent/AgentSelector.tsx` — Agent 下拉 + Mode 下拉，compact 模式，可用状态显示
- [x] 5. 创建 `frontend/src/components/agent/ContextPanel.tsx` — 自动上下文 Tag 展示 + 手动附件管理 (onAddAttachment 接受 type 参数)，compact 折叠
- [x] 6. 创建 `frontend/src/components/agent/ApplyActions.tsx` — Apply/Copy 按钮组，showApply 控制显示
- [x] 7. 创建 `frontend/src/components/agent/MessageBubble.tsx` — 消息渲染 (user/assistant)，Markdown + 代码块语法高亮 + ApplyActions
- [x] 8. 创建 `frontend/src/components/agent/AgentChatWidget.tsx` — 核心对话组件，管理 WebSocket 生命周期、消息列表、Agent/Mode 选择，autoContext.data 类型为 Record<string,unknown>。Props 包含 onApplyCode + onApplyConfig + onApplyPipelineAction。预留 sessionId/onSessionCreated props 接口

### 编辑器集成

- [x] 9. 修改 `frontend/src/pages/SkillEditor.tsx` — 添加 Agent 按钮 + Drawer + AgentChatWidget(embedded, autoContext=skill 含当前编辑状态, onApplyCode=setSourceCode+setDirty)
- [x] 10. 修改 `frontend/src/pages/PipelineEditor.tsx` — 添加 Agent 按钮 + Drawer + AgentChatWidget(embedded, autoContext=pipeline 用当前 nodes 状态而非 pipeline 原始数据, selectedNode, onApplyPipelineAction 处理 4 种 action + deriveEdges)
- [x] 11. 修改 `frontend/src/pages/BuiltinSkillEditor.tsx` — 添加 Agent 按钮 + Drawer + AgentChatWidget(embedded, autoContext=skill 含 config_schema+config_values, onApplyConfig=form.setFieldsValue+setDirty)

### 检查

- [x] 12. 运行 npx tsc -b — 零 TypeScript 错误
- [x] 13. 运行 npm run build — Vite 构建成功
