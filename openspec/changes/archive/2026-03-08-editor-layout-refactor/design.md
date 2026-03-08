## Context

当前编辑器页面（SkillEditor、PipelineEditor、BuiltinSkillEditor）的右侧面板由多个独立 Card 组成，Agent Assistant 以 Ant Design `<Drawer>` 浮层覆盖在编辑区域上。这导致：

1. Drawer 遮挡编辑区，用户无法同时看代码和 Agent 对话
2. 各编辑器的右侧面板没有统一交互模式
3. Agent 详情面板（AgentDetailPanel）显示了 Tools/MCP 等技术细节，对编辑场景无用
4. 默认 light 主题缺少品牌感

## Goals / Non-Goals

**Goals:**
- 统一编辑器右侧面板为**互斥面板模式**（Config 和 Agent 共享同一列，一次只显示一个）
- Agent Assistant 内联到右侧面板，不再遮挡编辑区
- 精简嵌入模式 Agent 信息，只保留必要的 agent 选择和对话
- 默认主题改为 sky-blue
- **保持全系统一致的交互体验**

**Non-Goals:**
- 不改动 Agent Playground 页面（独立全页面，不受此影响）
- 不改动 Agent 后端 API
- 不新增主题（只改默认值）
- 不改动 Settings 页面的 Agent 配置展示（那里 Tools/MCP 信息有用）

## Decisions

### D1: 互斥面板模式 — Config 和 Agent 共享右侧列（全系统设计原则）

**核心交互**: 右侧面板只有两种状态，由 `showAgent` 布尔值控制：
- `showAgent=false`: 显示 Config 面板（Collapse，各 section 可独立展开/收起，默认全部展开）
- `showAgent=true`: 显示 Agent 面板（Collapse 包裹，用户点击 Collapse 头部可关闭回到 Config）

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ showAgent = false           │     │ showAgent = true            │
├─────────────────────────────┤     ├─────────────────────────────┤
│ ▼ Connection Mappings       │     │ ▼ Agent Assistant           │
│   [mapping fields...]       │     │   MODE: [Ask] [Code]        │
│ ▼ Additional Requirements   │     │   📎 Skill: xxx             │
│   [textarea]                │     │                             │
│ ▼ Test Input & Output       │  ⇔  │   Start a conversation...   │
│   [json editor]             │     │                             │
│   [Run Test button]         │     │   [input box]               │
│   [results...]              │     │   [Send button]             │
└─────────────────────────────┘     └─────────────────────────────┘
```

**切换方式**:
1. PageHeader 的 Agent 按钮: `setShowAgent(prev => !prev)` 切换
2. Agent Collapse 头部关闭: `onChange` 检测 activeKey 不含 'agent' 时 `setShowAgent(false)`

**关键配置**:
- Config Collapse: `activeKey={configPanels}` 受控，默认全展开 `['connections', 'requirements', 'test']`
- Agent Collapse: `activeKey={['agent']}` 始终展开，onChange 关闭时切回 Config
- 两个 Collapse 都设置 `destroyInactivePanel={false}` 保持组件状态

**替代方案（已否决）**: 垂直堆叠模式（Config 和 Agent 上下排列各自可展开收起）— 右侧空间有限，上下堆叠会导致两个面板都压缩变矮，体验差。

### D2: 固定布局约束 — Header/Sidebar 不可移动

**CRITICAL**: 左侧 Sidebar（"Agentic RAGFlow"）和顶部 Header（"Agentic RAGFlow Studio"）是共享固定部分，无论编辑器内容如何变化都**不能移动或消失**。

- AppLayout 结构: `<Layout>` → `<Sider width=220>` + `<Layout>` → `<Header height=64>` + `<Content margin=24>`
- 编辑器页面可用高度: `calc(100vh - 112px)` (64px header + 48px margin)
- 页面容器必须设置固定高度 + `overflow: hidden`，防止内容溢出推开 header

### D3: Agent 面板高度自适应

Agent Collapse 内的 AgentChatWidget 高度需要与左侧面板对齐：
- 外层容器: `overflow: hidden` + flex 列布局
- AgentChatWidget: `height: calc(100vh - 260px)` 精确扣除 header(64) + margin(48) + PageHeader(~56) + Collapse头部(~40) + padding(~52)
- 配置面板模式下: `overflow: auto` 允许长内容滚动

### D4: AgentDetailPanel 在嵌入模式不渲染

当前 `AgentChatWidget` 内部渲染 `<AgentDetailPanel>` 显示 Tools/MCP。

改为：嵌入模式 (`embedded=true`) 时不渲染 `AgentDetailPanel`。Playground 模式保持不变。

### D5: 嵌入模式精简

- **去掉 AgentSelector 下拉框**: embedded 模式下不渲染 AgentSelector，agent 自动选择第一个可用的
- **去掉 Plan 模式**: `modes.filter(m => m !== 'plan')` 只保留 Ask/Code
- **Mode 选择**: 通过 ModeBar tabs 切换，modes 只剩 1 个时隐藏 ModeBar

### D6: 默认主题 — 改 themeStore 初始值

`stores/themeStore.ts` 的 `loadThemeKey()` 默认返回值从 `'light'` 改为 `'sky-blue'`。

### D7: 三个编辑器的互斥面板规划

**SkillEditor**:
- Config 面板 sections: Connection Mappings、Additional Requirements、Test Input & Output（默认全展开）
- Agent 面板: AgentChatWidget with `autoContext.type='skill'`
- 右侧固定宽度 400px

**PipelineEditor EditMode**:
- Config 面板: Skills tab + Node Config tab（保持原有 tab 结构）
- Agent 面板: AgentChatWidget with `autoContext.type='pipeline'`
- 右侧 sidebar 宽度 380px（可折叠）
- showAgent 时右侧整列替换为 Agent

**PipelineEditor DebugMode**:
- Config 面板: Node Detail（选中节点的执行结果）
- Agent 面板: AgentChatWidget with `autoContext.type='pipeline'`
- 右侧固定宽度 400px

**BuiltinSkillEditor**:
- 标准布局 Config: Test Collapse（默认展开）
- DocCracker 布局 Config: 分析结果展示
- 两种布局 Agent 面板: AgentChatWidget with `autoContext.type='skill'`

## Risks / Trade-offs

- **[Agent 对话高度受限]** → Collapse Panel 内的 Agent 对话区域高度有限（不像 Drawer 可占满屏幕）。使用 `calc(100vh - 260px)` 精确控制高度缓解
- **[互斥模式下上下文丢失]** → 切换到 Agent 时 Config 不可见。`destroyInactivePanel={false}` 保持组件状态，切换回来不丢失数据
- **[PipelineEditor 结构差异]** → PipelineEditor 的右侧面板结构和 SkillEditor 差异较大（ReactFlow 节点配置 vs 表单）。但互斥模式统一了切换逻辑，降低了复杂度
- **[destroyInactivePanel 内存]** → Agent WebSocket 连接在切走后仍然保持。可接受，因为连接空闲不消耗资源
