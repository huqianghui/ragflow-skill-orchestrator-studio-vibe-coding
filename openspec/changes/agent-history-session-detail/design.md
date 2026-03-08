## Context

Agent Session History 页面当前使用用户第一句话截断 30 字符作为 Title，用户无法有效识别 session。且必须跳转到 Playground 才能查看聊天内容，无法在 History 页面预览和确认。

当前前端 `AgentHistory.tsx` 通过行点击直接 navigate 到 Playground 恢复 session。后端已有 `GET /sessions/{id}/messages` API 支持消息列表查询。数据模型已包含 `native_session_id` 字段但前端未展示。

## Goals / Non-Goals

**Goals:**

- 在 History 表格中展示 `native_session_id`，方便用户与本地 CLI Agent session 文件关联
- 提供 Modal 预览功能，用户无需跳转即可浏览 session 聊天记录
- 保持行点击 → Playground 的快速导航路径

**Non-Goals:**

- 不改进 title 自动生成逻辑（如 LLM 摘要）
- 不修改后端 API 或数据模型
- 不添加 session 编辑功能（如手动改 title）

## Decisions

### D1: 移除 Title 列，替换为 Session ID 列

**选择**: 直接显示 `native_session_id`（CLI Agent 原生 UUID），而非内部 `id`。

**理由**: 用户需要将 History 记录与文件系统中的 session 文件关联（如 Claude Code 的 `~/.claude/projects/` 下以 UUID 命名的 JSONL 文件），`native_session_id` 是唯一可以跨系统匹配的标识。

**备选方案**: 显示内部 `id` — 但无法与外部系统关联，对用户价值低。

### D2: Session ID 截断显示 + Tooltip 完整值

**选择**: 表格中截断显示（约前 8 位 + "..."），hover 时 Tooltip 显示完整值，点击可复制到剪贴板。

**理由**: UUID 完整显示（36 字符）会占据过多列宽，截断 + 复制平衡了信息密度和可用性。

### D3: 独立 Modal 而非 Drawer 或展开行

**选择**: 使用 Ant Design `Modal` 弹窗。

**理由**: 聊天记录可能很长（数十条消息），Drawer 侧边栏宽度受限，展开行会破坏表格布局。Modal 可以自适应宽度并支持滚动。

### D4: Modal 内聊天记录复用 MessageBubble 风格

**选择**: Modal 内使用简化的消息列表（role + content + timestamp），不完全复用 MessageBubble 组件。

**理由**: MessageBubble 依赖 streaming 状态和 Markdown 渲染等重逻辑。Modal 只需只读预览，用简单的 `<div>` + role 标签 + 内容即可，但保持 Markdown 渲染以正确展示 agent 回复中的格式化内容。

### D5: null native_session_id 显示 "(pending)"

**选择**: 灰色斜体 `(pending)` 文本。

**理由**: `native_session_id` 在第一轮对话完成后才由 adapter 提取写入。用户刚创建但尚未发送消息的 session 会出现 null 值，需要一个合理的占位文本。

## Risks / Trade-offs

- **[Messages 加载延迟]** → 首次打开 Modal 需要请求 `GET /sessions/{id}/messages`，消息量大时可能有延迟。Mitigation: 添加 loading spinner。
- **[长消息内容]** → Agent 回复可能包含大量代码块。Mitigation: Modal 内容区域设置 maxHeight + 滚动，单条消息超长时使用 CSS overflow 处理。
- **[搜索范围变更]** → 搜索从匹配 title 改为匹配 native_session_id，UUID 不如自然语言直观。Mitigation: 同时支持 agent_name 搜索，UUID 前缀匹配即可定位。
