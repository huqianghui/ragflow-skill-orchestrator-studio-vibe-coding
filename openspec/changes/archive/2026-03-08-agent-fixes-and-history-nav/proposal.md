## Why

Codex adapter 使用了已废弃的 `--quiet` CLI 参数导致执行失败（`error: unexpected argument '--quiet' found`）。同时 Agent History 页面点击 session 后跳转到 Playground 时只传递了 session ID，没有传递 agent name，导致 Playground 总是选择第一个可用 agent 而非该 session 对应的 agent，用户无法在正确的 agent 上继续会话。

## What Changes

- **修复 Codex adapter**: 移除 `--quiet` 参数，改用 Codex CLI 当前支持的正确参数
- **修复 Copilot adapter**: 确认 `copilot` CLI 命令名是否正确（实际命令为 `gh copilot`），更新 `is_available()` 检测逻辑
- **添加 adapter 测试用例**: 为 Codex 和 Copilot adapter 添加单元测试，覆盖 `is_available()`、`get_version()`、`execute()` 参数构建等
- **Agent History → Playground 导航修复**: History 页面点击 session 时，URL 同时携带 `agent` 和 `session` 参数；Playground 页面根据 URL 参数选择正确的 agent 并恢复对应 session

## Capabilities

### New Capabilities

_(无新增能力)_

### Modified Capabilities

- `agents`: Codex/Copilot adapter 执行参数修复；Agent History → Playground 导航需携带 agent_name 以正确恢复 session

## Impact

- **Backend**: `backend/app/services/agents/adapters/codex.py` — execute() 命令行参数修改
- **Backend**: `backend/app/services/agents/adapters/copilot.py` — CLI 命令名/可用性检测修改
- **Backend tests**: 新增 `tests/test_codex_adapter.py`、`tests/test_copilot_adapter.py`
- **Frontend**: `frontend/src/pages/AgentHistory.tsx` — 导航 URL 添加 agent 参数
- **Frontend**: `frontend/src/pages/AgentPlayground.tsx` — 从 URL 读取 agent 参数并选择对应 agent
