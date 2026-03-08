## Why

Agent 聊天消息之前仅存在内存中（前端 state），刷新页面或切换 session 后消息丢失。用户需要在 session 恢复时看到完整的对话历史，同时 History 页面的 session 列表需要标准化的分页、过滤和排序支持。

## What Changes

- 新增 `AgentMessage` ORM 模型和 `agent_messages` DB 表，持久化存储每条聊天消息
- 扩展 `SessionProxy` 添加 `save_message()` / `get_messages()` 方法
- WebSocket handler 在每次对话中持久化 user 和 assistant 消息
- 新增 `GET /agents/sessions/{id}/messages` REST 端点
- `AgentChatWidget` 在 session 恢复时从 DB 加载历史消息
- `AgentPlayground` 实现 Agent 切换自动恢复近期 session (< 30min)
- `AgentHistory` 重构为标准化表格（搜索/过滤/排序/分页/删除）
- `MessageBubble` 新增 Thinking 等待动画（bouncing dots + gradient bar）和 streaming 光标

## Capabilities

### New Capabilities

（无新顶层 capability，变更在已有 agents 模块内）

### Modified Capabilities

- `agents`: 新增 AgentMessage 数据模型、消息持久化 API、session 恢复逻辑、History 表格标准化、Thinking 动画

## Impact

- **数据库**: 新增 `agent_messages` 表 + Alembic migration
- **后端 API**: 新增 `GET /sessions/{id}/messages` 端点；WebSocket handler 增加消息持久化逻辑
- **前端**: AgentChatWidget 增加 session 恢复 + 消息加载；AgentPlayground 增加自动恢复；AgentHistory 全面重构；MessageBubble 增加 Thinking 动画
- **测试**: 更新 test_agent_session_api, test_agent_websocket；新增 conftest 中 AgentMessage fixture
