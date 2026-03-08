## Context

Codex CLI 已升级，废弃了 `--quiet` 参数。当前的非交互模式应使用 `codex exec` 子命令，支持 `--json` JSONL 事件流输出。Copilot CLI 的实际命令是 `gh copilot`（作为 gh 扩展），而非独立的 `copilot` 命令。

Agent History 页面点击 session 行时，通过 `navigate(/playground?session=xxx)` 跳转，但未传递 `agent_name`。AgentPlayground 在加载 agents 后总是选择第一个可用 agent，忽略了 session 对应的 agent。

## Goals / Non-Goals

**Goals:**
- Codex adapter 使用正确的 CLI 参数 (`codex exec --json`) 实现非交互执行
- Copilot adapter 正确检测 `gh copilot` 命令可用性
- 为 Codex 和 Copilot adapter 添加单元测试
- Agent History → Playground 导航时正确恢复 agent 和 session

**Non-Goals:**
- 不实现 Copilot 的完整 execute 功能（仍为 stub）
- 不改变 Claude Code adapter 的任何行为
- 不修改 Agent session 的数据模型

## Decisions

### D1: Codex 使用 `codex exec --json` 替代 `codex --quiet`

**选择**: `codex exec <prompt> --json`

- `codex exec` 是官方非交互模式子命令
- `--json` 输出 JSONL 事件流，便于结构化解析（类似 Claude Code 的 `--output-format stream-json`）
- 每行是一个 JSON 对象，需要按事件类型解析（message、tool_call 等）

**替代方案**: `codex exec <prompt>` 不加 `--json`（纯文本输出）— 但无法区分代码和文本内容。

### D2: Copilot 检测命令改为 `gh copilot`

**选择**: `is_available()` 检查 `gh` 命令存在且 `gh copilot --version` 可执行

- GitHub Copilot CLI 是 `gh` 的扩展，不是独立命令
- 安装方式: `gh extension install github/gh-copilot`

### D3: History 导航携带 agent 和 session 参数

**选择**: URL 格式改为 `/playground?agent=<name>&session=<id>`

- AgentHistory 的 session 记录已包含 `agent_name` 字段，直接使用
- AgentPlayground 在加载 agents 后，如果 URL 有 `agent` 参数，优先选择该 agent
- 如果 URL 指定的 agent 不可用，fallback 到第一个可用 agent

## Risks / Trade-offs

- **[Codex JSONL 解析]** → Codex 的 JSONL 事件格式可能与 Claude Code 不同，需要按实际输出适配解析逻辑。初期可以将所有 message 类型事件作为 text 输出。
- **[Copilot 执行仍为 stub]** → `gh copilot suggest` 命令需要交互式终端输入，非交互模式支持有限。保持 stub 状态，在 error 消息中提供明确说明。
- **[Session agent 不匹配]** → 如果用户在 Playground 手动切换了 agent 后浏览器 URL 仍保留旧参数，可能导致混淆。解决：加载后立即清除 URL 参数（当前已有此逻辑）。
