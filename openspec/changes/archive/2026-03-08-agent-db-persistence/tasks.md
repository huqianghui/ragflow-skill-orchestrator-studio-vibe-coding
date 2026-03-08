## 1. AgentMessage 数据模型与 Migration

- [x] 1.1 创建 `backend/app/models/agent_message.py` — AgentMessage ORM 模型（session_id, role, content）
- [x] 1.2 在 `backend/app/models/__init__.py` 中注册 AgentMessage import
- [x] 1.3 更新 init migration (`d750dfb7d5f0`) 添加 `agent_messages` 表创建
- [x] 1.4 创建增量 migration `c3d4e5f6a7b8_add_agent_messages_table.py`（含 IF NOT EXISTS 检查）

## 2. SessionProxy 消息持久化

- [x] 2.1 在 `session_proxy.py` 添加 `save_message()` 方法
- [x] 2.2 在 `session_proxy.py` 添加 `get_messages()` 方法（按 created_at 升序）
- [x] 2.3 修改 `delete()` 方法级联删除 session 关联的 messages

## 3. REST API 端点

- [x] 3.1 在 `backend/app/api/agents.py` 添加 `GET /sessions/{id}/messages` 端点
- [x] 3.2 返回 `[{id, role, content, created_at}]` 格式

## 4. WebSocket 消息持久化

- [x] 4.1 修改 `agent_chat_ws()` 在发送 user 消息前调用 `session_proxy.save_message()`
- [x] 4.2 修改 `agent_chat_ws()` 在流式完成后累积 assistant text 并持久化

## 5. 前端 Session 恢复

- [x] 5.1 在 `agentApi.ts` 添加 `getSessionMessages()` 方法
- [x] 5.2 修改 `AgentChatWidget.tsx` 添加 sessionId effect — 恢复 session 时从 API 加载消息
- [x] 5.3 无消息时显示 "Session resumed" 提示消息
- [x] 5.4 修改 `AgentPlayground.tsx` 实现 `tryRestoreRecentSession()` — 30min 窗口自动恢复
- [x] 5.5 修改 `AgentPlayground.tsx` 实现 `handleInvoke()` — Invoke New Session 清空聊天

## 6. AgentHistory 表格重构

- [x] 6.1 重写 `AgentHistory.tsx` — 使用 ListToolbar + Table 标准化组件
- [x] 6.2 实现客户端搜索（title + agent_name 模糊匹配）
- [x] 6.3 实现 Agent 和 Source 下拉过滤（Select mode="multiple"）
- [x] 6.4 实现列排序（Title, Agent, Mode, Source, Created, Last Active 全部 sortable）
- [x] 6.5 实现分页（showTotal, showSizeChanger, pageSizeOptions）
- [x] 6.6 实现删除（Popconfirm + stopPropagation）
- [x] 6.7 实现行点击导航到 Playground（带 agent + session 参数）

## 7. Thinking 动画

- [x] 7.1 修改 `MessageBubble.tsx` 添加 ThinkingIndicator 组件（bouncing dots + gradient bar）
- [x] 7.2 添加 BlinkingCursor 组件（流式内容末尾光标）
- [x] 7.3 streaming prop 控制渲染逻辑：streaming && !content → ThinkingIndicator；streaming && content → 内容 + BlinkingCursor

## 8. 测试更新

- [x] 8.1 更新 `backend/tests/conftest.py` 添加 AgentMessage 相关 fixture
- [x] 8.2 更新 `backend/tests/test_agent_session_api.py` 测试消息 API
- [x] 8.3 更新 `backend/tests/test_agent_websocket.py` 测试消息持久化

## 9. 验证

- [x] 9.1 后端: `ruff check . && ruff format --check .` 通过
- [x] 9.2 后端: `pytest tests/ -v` 通过
- [x] 9.3 前端: `npx tsc -b && npm run build` 通过
