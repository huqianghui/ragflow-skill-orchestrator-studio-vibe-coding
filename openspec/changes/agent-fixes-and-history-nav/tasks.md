## 1. Codex Adapter 修复

- [x] 1.1 修改 `backend/app/services/agents/adapters/codex.py` 的 `execute()` 方法，将命令从 `codex --quiet <prompt>` 改为 `codex exec <prompt> --json`
- [x] 1.2 添加 JSONL 事件流解析逻辑，将 Codex 输出的 JSON 事件转为 AgentEvent
- [x] 1.3 添加 `backend/tests/test_codex_adapter.py` 测试文件，覆盖 `is_available()`、`get_version()`、`execute()` 命令构建
- [x] 1.4 修复 `base.py` `_parse_json_event()` 处理 `message` 为字符串的情况（Codex 'str' has no attribute 'get' 崩溃的根因）
- [x] 1.5 添加 `backend/tests/test_agent_base.py` 测试文件，覆盖 `_parse_json_event` 和 `_extract_text` 全部分支

## 2. Copilot Adapter 修复

- [x] 2.1 支持双路径检测：独立 `copilot` 命令优先，回退到 `gh copilot` 扩展
- [x] 2.2 `get_version()` 同样支持双路径（standalone → gh copilot）
- [x] 2.3 `execute()` 使用 `copilot -p <prompt> --output-format json`（standalone），`gh copilot` 返回不支持非交互错误
- [x] 2.4 修复 `install_hint`（原来错误引用了 Claude Code）
- [x] 2.5 全面重写 `backend/tests/test_copilot_adapter.py`，覆盖双路径检测、版本获取、命令构建、事件解析

## 3. Agent History → Playground 导航

- [x] 3.1 修改 `frontend/src/pages/AgentHistory.tsx`，导航 URL 添加 `agent` 参数
- [x] 3.2 修改 `frontend/src/pages/AgentPlayground.tsx`，从 URL 读取 `session` 参数后调用 `getSession()` 获取正确的 agent_name 和 mode
- [x] 3.3 确保 URL 参数清除逻辑同时清除 `agent` 和 `session` 参数
- [x] 3.4 修改 `AgentChatWidget.tsx`，session 恢复时显示 "Session resumed" 提示消息

## 4. Playwright UI e2e 测试

- [x] 4.1 创建 `frontend/e2e/agent-playground.spec.ts`，覆盖：
  - Playground 基本加载
  - Agent 按钮高亮状态切换（primary type）
  - History → Playground 导航及 URL 参数传递
  - Session 恢复后显示 resume 消息
  - URL 参数处理（已知 agent、未知 agent 回退）

## 5. 验证

- [x] 5.1 后端: `ruff check . && ruff format --check .` 通过
- [x] 5.2 后端: `pytest tests/ --timeout=10 -v` 通过 (277 passed, 1 pre-existing pip timeout)
- [x] 5.3 前端: `npx tsc -b && npm run build` 通过
- [x] 5.4 Agent 相关测试: 51 passed (test_agent_base + test_codex_adapter + test_copilot_adapter)
