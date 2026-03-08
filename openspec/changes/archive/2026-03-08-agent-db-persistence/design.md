## Context

Agent 模块已有 `AgentSession` 表存储会话元数据，但消息仅存在前端内存中。需要扩展为完整的消息持久化体系，支持 session 恢复时重新加载对话历史。同时 AgentHistory 页面需要从简单列表升级为标准化表格组件。

## Goals / Non-Goals

**Goals:**
- 实现 AgentMessage DB 持久化，每次 WS 对话自动保存 user + assistant 消息
- 提供 REST API 获取 session 消息历史
- 前端 session 恢复时从 DB 加载消息
- Agent 切换时自动恢复近期 playground session (< 30min)
- AgentHistory 表格标准化（搜索/过滤/排序/分页/删除）
- Thinking 等待动画提升流式响应 UX

**Non-Goals:**
- 不做消息搜索或全文检索
- 不做消息编辑或删除（只删整个 session）
- 不做跨 session 消息合并

## Decisions

### 1. AgentMessage 表设计 — session_id 外键关联

**选择**: 独立 `agent_messages` 表，通过 `session_id` 字符串关联（非 FK 约束）。

**理由**:
- SQLite 不强制 FK 约束，字符串关联更简单
- session 删除时通过 `SessionProxy.delete()` 级联清理 messages
- `session_id` 建索引支持高效查询

### 2. 消息持久化时机 — WebSocket handler 中同步保存

**选择**: 在 `agent_chat_ws()` 中，user 消息在发送给 agent 前保存，assistant 消息在流式完成后保存。

**理由**:
- 每条消息独立保存，避免流式中断导致数据丢失
- assistant 消息累积完整 text 后一次保存，减少 DB 写入
- 使用 `AsyncSessionLocal()` 创建独立 DB session（WS handler 不走 Depends）

### 3. Session 恢复策略 — 30 分钟窗口 + URL 强制恢复

**选择**:
- Agent 切换时自动恢复最近 30min 内的 playground session
- History 页面点击通过 URL 参数 (`?session=xxx`) 强制恢复任意 session

**理由**: 30min 窗口平衡了"恢复上下文"和"避免恢复过旧对话"的需求

### 4. Thinking 动画 — CSS-only inline styles

**选择**: 在 `MessageBubble` 组件内用 `<style>` 标签注入 CSS `@keyframes`，不引入额外动画库。

**理由**:
- 零依赖，CSS-only 性能最佳
- `thinking-dot` 弹跳 + `thinking-bar` 渐变进度条 + `blink-cursor` 流式光标
- 仅在 `streaming && !content` 时渲染 ThinkingIndicator

### 5. AgentHistory 表格 — 客户端过滤 + 服务端分页

**选择**: 分页从服务端获取数据，搜索和 agent/source 过滤在客户端执行。

**理由**:
- Session 数据量通常 <1000，客户端过滤足够
- 减少 API 复杂度（不需每个过滤条件都做 query parameter）
- 使用 Ant Design Table 内置 sorter 实现列排序

## Risks / Trade-offs

- **[消息量增长]** 长期积累消息可能占用存储 → session 删除时级联清理 messages
- **[WS 中 DB 独立 session]** WebSocket handler 用 `AsyncSessionLocal()` 而非 Depends → 测试需 mock `session_proxy`
- **[客户端过滤限制]** 大量 session 时客户端过滤性能下降 → 当前规模可接受，未来可迁移到服务端
