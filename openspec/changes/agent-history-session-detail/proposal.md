## Why

Agent Session History 页面的 Title 列使用用户第一句话的前 30 字符（如 "hello"、"1"、"how are you today?"），无法有效识别 session。用户必须跳转到 Playground 才能查看聊天内容，无法在 History 页面快速判断某个 session 是否是自己需要的。此外，缺少 `native_session_id` 显示，用户无法将 History 记录与 CLI Agent 在本地文件系统中的 session 文件（如 Claude Code 的 UUID 文件夹/JSONL）关联。

## What Changes

- **移除 Title 列**：替换为 Session ID 列，显示 `native_session_id`（CLI Agent 原生会话 ID）
- **新增 Session Detail Modal**：在 Actions 列添加"查看详情"按钮，点击后弹出 Modal 展示 session 元信息和完整聊天记录
- **Modal 底部提供 "Continue in Playground" 按钮**：确认 session 后可直接跳转 Playground 继续聊天
- **搜索适配**：搜索 placeholder 改为 "Search by session ID or agent"，搜索逻辑匹配 `native_session_id`
- **null 处理**：`native_session_id` 为空时显示灰色 "(pending)" 文本

## Capabilities

### New Capabilities

（无新增 capability — 所有变更在现有 agents 模块范围内）

### Modified Capabilities

- `agents`: AgentHistory 页面表格列调整（Title → Session ID）及新增 Session Detail Modal 预览功能

## Impact

- **前端**: `AgentHistory.tsx` 页面重构（列定义、新增 Modal 组件、搜索逻辑）
- **后端**: 无需改动 — `GET /sessions/{id}/messages` API 已存在
- **数据模型**: 无变更
- **API**: 无变更
