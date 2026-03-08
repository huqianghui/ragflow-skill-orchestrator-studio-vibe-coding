## MODIFIED Requirements

### Requirement: Adapter 体系

必须实现:
- `is_available()` → 检查 CLI 是否已安装 (`shutil.which`)
- `get_version()` → 获取版本号
- `execute(request)` → 流式执行，yield AgentEvent
- `extract_session_id(events)` → 从输出事件中提取原生 session ID

可选覆盖:
- `get_config()` → 读取配置文件
- `get_tools()` → 获取内置工具列表
- `get_mcp_servers()` → 获取 MCP 服务器列表

### 当前 Adapter 实现

| Adapter | CLI 命令 | 配置文件 | 执行方式 |
|---------|---------|---------|---------|
| claude_code | `claude` | `~/.claude/settings.json` | `claude --print --output-format stream-json` |
| codex | `codex` | `~/.codex/config.toml` | `codex exec --json` |
| copilot | `gh copilot` | — | `gh copilot` (stub) |

#### Scenario: Codex adapter 使用 exec 子命令执行

- **WHEN** Codex adapter 执行用户请求
- **THEN** 使用 `codex exec <prompt> --json` 命令
- **AND** 解析 JSONL 事件流输出
- **AND** 将 message 类型事件转为 AgentEvent(type="text")

#### Scenario: Codex adapter 检测可用性

- **WHEN** 系统探测 Codex 是否可用
- **THEN** 检查 `codex` 命令是否存在于 PATH

#### Scenario: Copilot adapter 检测可用性

- **WHEN** 系统探测 Copilot 是否可用
- **THEN** 检查 `gh` 命令是否存在于 PATH
- **AND** 执行 `gh copilot --version` 验证扩展已安装

#### Scenario: Copilot adapter 执行返回 stub 错误

- **WHEN** Copilot adapter 收到执行请求
- **THEN** 返回 AgentEvent(type="error") 说明非交互模式尚未实现

## ADDED Requirements

### Requirement: Agent History 到 Playground 的 session 恢复导航

Agent History 页面 SHALL 支持点击 session 后跳转到 Playground 并自动恢复对应的 agent 和 session。

#### Scenario: 点击 History 中的 session 行

- **WHEN** 用户在 Agent History 页面点击某个 session 行
- **THEN** 导航到 `/playground?agent=<agent_name>&session=<session_id>`

#### Scenario: Playground 从 URL 恢复 agent 和 session

- **WHEN** AgentPlayground 页面加载时 URL 包含 `agent` 和 `session` 参数
- **THEN** 自动选择 URL 指定的 agent
- **AND** 使用 URL 指定的 session ID 恢复会话
- **AND** 加载完成后清除 URL 参数

#### Scenario: URL 指定的 agent 不可用时 fallback

- **WHEN** URL 中的 `agent` 参数指定的 agent 不在可用列表中
- **THEN** fallback 到第一个可用 agent
- **AND** 仍使用 URL 中的 session ID（如有）
