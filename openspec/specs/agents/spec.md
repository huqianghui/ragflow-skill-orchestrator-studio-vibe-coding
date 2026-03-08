# Agents Module Spec

> CLI Coding Agent 集成 — 发现、会话管理、实时聊天、配置读取

## 1. 架构概述

```
┌─────────────────────────────────────────────┐
│ Frontend: AgentPlayground / Embedded Widget  │
│   AgentSelector → AgentChatWidget → WS      │
└────────────────┬────────────────────────────┘
                 │ REST + WebSocket
┌────────────────▼────────────────────────────┐
│ Backend: api/agents.py                       │
│   ├── GET /available       (发现, DB 查询)    │
│   ├── POST /refresh        (手动刷新探测)     │
│   ├── GET /{name}/config   (配置读取)        │
│   ├── CRUD /sessions       (会话管理)        │
│   └── WS /sessions/{id}/ws (实时聊天)        │
├──────────────────────────────────────────────┤
│ services/agents/                             │
│   ├── registry.py     → 全局注册中心 (单例)   │
│   ├── base.py         → BaseAgentAdapter 抽象 │
│   ├── session_proxy.py → Session DB 代理      │
│   ├── context_builder.py → 上下文 prompt 组装 │
│   └── adapters/       → 具体实现              │
│       ├── claude_code.py                     │
│       ├── codex.py                           │
│       └── copilot.py                         │
└──────────────────────────────────────────────┘
```

## 2. 数据模型

### AgentSession (ORM)

| 列 | 类型 | 说明 |
|----|------|------|
| id | UUID (PK) | 继承自 BaseModel |
| agent_name | String(50) | Agent 标识名 (如 "claude-code") |
| native_session_id | String(255), nullable | CLI Agent 原生会话 ID |
| title | String(255) | 会话标题，默认 "New Session" |
| mode | String(20) | "plan" / "ask" / "code" |
| source | String(50) | "playground" / "skill-editor" / "pipeline-editor" / "builtin-skill-editor" |
| created_at | DateTime | 继承自 BaseModel (UTC) |
| updated_at | DateTime | 继承自 BaseModel (UTC) |

**设计决策**: Session 存储元数据，聊天消息通过 `agent_messages` 表持久化。CLI Agent 原生会话通过 `native_session_id` 关联恢复。

### AgentMessage (ORM)

| 列 | 类型 | 说明 |
|----|------|------|
| id | UUID (PK) | 继承自 BaseModel |
| session_id | String(36), indexed | 关联的 AgentSession ID |
| role | String(10) | "user" / "assistant" |
| content | Text | 消息内容 |
| created_at | DateTime | 继承自 BaseModel (UTC) |
| updated_at | DateTime | 继承自 BaseModel (UTC) |

**级联删除**: Session 删除时通过 `SessionProxy.delete()` 一并清理所有关联消息。

### AgentConfig (ORM — 持久化缓存)

Agent 的发现结果持久化到 `agent_configs` 表，API 直接查 DB 返回（毫秒级）。

| 列 | 类型 | 说明 |
|----|------|------|
| id | UUID (PK) | 继承自 BaseModel |
| name | String(50), unique | Agent 标识名 (如 "claude-code") |
| display_name | String(100) | 显示名 |
| icon | String(50) | 图标标识 |
| description | Text | 简介 |
| modes | JSON | 支持的交互模式列表 |
| available | Boolean | 是否可用（本机已安装） |
| version | String(100), nullable | CLI 版本号 |
| provider | String(100), nullable | 提供商 |
| model | String(100), nullable | 当前使用的模型 |
| install_hint | String(255), nullable | 安装指引 |
| tools | JSON | 内置工具列表 |
| mcp_servers | JSON | 已配置的 MCP 服务器 |
| updated_at | DateTime | 最近一次探测时间 |

**刷新机制**: 启动时 seed → 每 120 秒后台定时探测 CLI 状态并 upsert。

### AgentInfo (Dataclass — 内存传输)

与 AgentConfig 字段一一对应，用于 registry 内部和 API 响应构建。

## 3. REST API

### GET /agents/available

返回所有注册 Agent 的信息（DB 查询，毫秒级）。

- 读取 `agent_configs` 表，5 秒内存缓存避免高频 DB 查询
- DB 为空时（首次启动 seed 尚未完成）自动触发同步探测
- 后台任务每 120 秒自动探测 CLI 状态并更新 DB

**Response**: `AgentInfoResponse[]`

### POST /agents/refresh

手动触发 agent 可用性刷新（探测所有 CLI adapter 并 upsert DB）。

**Response**: `{ "status": "refreshed" }`

### GET /agents/{name}/config

读取 Agent 的实际配置文件并返回。

- Claude Code: `~/.claude/settings.json`, `~/.claude/settings.local.json`
- Codex: `~/.codex/config.toml`
- 敏感值自动脱敏（token/key/secret/password/credential/auth 字段显示 `xxxx****xxxx`）

**Response**: `dict` (结构因 agent 而异)

### POST /agents/sessions

创建新会话。

**Request**: `{ agent_name, source, mode }`
**Response**: `AgentSessionResponse` (201)

### GET /agents/sessions

会话列表，支持 `source` 过滤和分页。

**Response**: `PaginatedResponse<AgentSessionResponse>`

### GET /agents/sessions/{id}

会话详情。

### DELETE /agents/sessions/{id}

删除会话及其所有关联消息 (204)。

### GET /agents/sessions/{id}/messages

返回 session 的所有持久化消息，按 `created_at` 升序排列。

**Response**: `[{ id, role, content, created_at }]`

Session 不存在时返回 404。

## 4. WebSocket 协议

**Endpoint**: `WS /agents/sessions/{id}/ws`

### 客户端 → 服务端

```json
{
  "type": "message",
  "content": "用户输入文本",
  "mode": "ask",
  "context": {
    "type": "skill",
    "skill": { "name": "...", "source_code": "..." },
    "error_result": { "message": "..." },
    "attachments": [{ "type": "text", "content": "..." }]
  }
}
```

### 服务端 → 客户端

```json
{ "type": "text",  "content": "...", "metadata": {} }
{ "type": "code",  "content": "...", "metadata": {} }
{ "type": "error", "content": "...", "metadata": {} }
{ "type": "done",  "content": "",   "metadata": {} }
```

### 生命周期

1. 客户端 connect → 服务端 accept
2. 服务端验证 session 存在
3. 循环: 接收 message → **持久化 user 消息** → context_builder 组装 prompt → adapter.execute() 流式输出 → 发送 events → 发送 done → **持久化 assistant 消息**
4. 首次对话后提取 native_session_id 保存
5. 自动更新 session title（取用户首条消息前 30 字符）

### 消息持久化

- **User 消息**: 在发送给 agent adapter 前持久化到 `agent_messages` 表
- **Assistant 消息**: 流式响应完成后（done 事件），将累积的完整文本持久化
- 使用 `AsyncSessionLocal()` 创建独立 DB session（WS handler 不走 Depends）

### 重连

前端 `AgentWebSocket` 类自动重连（最多 3 次，指数退避 1s/2s/3s）。

## 5. Adapter 体系

### BaseAgentAdapter (抽象基类)

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
| copilot | `gh copilot` | — | `gh copilot` (stub, 非交互模式尚未实现) |

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

### 执行隔离

- `_stream_subprocess()` 工具函数负责子进程管理
- stdin=DEVNULL 防止 CLI 等待输入
- stderr 后台 drain 防止 buffer 死锁
- 300s 超时保护
- 环境变量清理: 剔除 `CLAUDECODE`/`CLAUDE_CODE_SESSION` 防止嵌套

## 6. Context Builder

`ContextBuilder.build()` 将结构化上下文组装为 prompt 前缀:

- **skill 上下文**: Skill 名称、类型、源码、测试输入
- **pipeline 上下文**: Pipeline 名称、状态、节点列表
- **error 上下文**: 错误信息、traceback
- **attachments**: 用户附加的文本/代码片段
- **free 模式**: 直接返回用户原始 prompt

## 7. 前端组件

| 组件 | 位置 | 说明 |
|------|------|------|
| AgentPlayground | pages/ | 主页面: 左侧 Agent 列表 + 右侧聊天区 |
| AgentHistory | pages/ | 独立 history 页面 (全量 session 列表) |
| AgentChatWidget | components/agent/ | 可复用聊天组件 (Playground + 嵌入模式) |
| AgentSelector | components/agent/ | Agent 卡片列表 + Mode 选择 |
| AgentIcon | components/agent/ | Agent 图标徽章 (15+ agent 颜色映射) |
| SessionBar | components/agent/ | 顶部 session 导航 (新建 + 最近列表) |
| ModeBar | components/agent/ | 嵌入模式下的 Mode 切换栏 |
| MessageBubble | components/agent/ | 聊天消息气泡 (Markdown 渲染) |
| ContextPanel | components/agent/ | 嵌入模式下的上下文面板 |
| AgentDetailPanel | components/agent/ | Agent 详情信息面板 |
| ApplyActions | components/agent/ | 代码应用操作按钮 |

### 嵌入模式

AgentChatWidget 可嵌入 SkillEditor、PipelineEditor、BuiltinSkillEditor 等页面，
通过 `source` 参数区分来源，自动附加当前编辑对象作为上下文。

#### 嵌入模式 Agent 信息展示

嵌入式 Agent Assistant（编辑器内联模式）SHALL 只显示精简的 Agent 信息。

- **WHEN** AgentChatWidget 以 embedded=true 模式渲染
- **THEN** 不显示 AgentDetailPanel（Tools 列表、MCP Servers 列表）
- **AND** 只在 AgentSelector 中显示 agent 名称和 ON/OFF 状态
- **WHEN** AgentChatWidget 以 embedded=false 模式渲染（Playground 页面）
- **THEN** 保持现有行为，显示完整 Agent 信息

#### 嵌入模式 Mode 过滤

嵌入式 Agent Assistant SHALL 不提供 Plan 模式。

- **WHEN** AgentChatWidget 以 embedded=true 模式渲染
- **THEN** Mode 选择器只显示 Ask 和 Code（过滤掉 Plan），默认选中 Ask 模式
- **WHEN** 过滤后 agent 只支持一种 mode
- **THEN** 隐藏 Mode 选择器，直接使用该唯一 mode

### Agent History → Playground Session 恢复导航

Agent History 页面 SHALL 支持点击 session 后跳转到 Playground 并自动恢复对应的 agent 和 session。

#### Scenario: 点击 History 中的 session 行

- **WHEN** 用户在 Agent History 页面点击某个 session 行
- **THEN** 导航到 `/playground?agent=<agent_name>&session=<session_id>`

#### Scenario: Playground 从 URL 恢复 agent 和 session

- **WHEN** AgentPlayground 页面加载时 URL 包含 `agent` 和 `session` 参数
- **THEN** 自动选择 URL 指定的 agent
- **AND** 使用 URL 指定的 session ID 恢复会话
- **AND** 从 `GET /sessions/{id}/messages` 加载历史消息显示在聊天区域
- **AND** 加载完成后清除 URL 参数

#### Scenario: 无历史消息时显示 resume 提示

- **WHEN** session 恢复成功但无持久化消息
- **THEN** 显示 "Session resumed — send a message to continue the conversation."

#### Scenario: URL 指定的 agent 不可用时 fallback

- **WHEN** URL 中的 `agent` 参数指定的 agent 不在可用列表中
- **THEN** fallback 到第一个可用 agent
- **AND** 仍使用 URL 中的 session ID（如有）

### Agent 切换自动恢复近期 Session

AgentPlayground SHALL 在切换 agent 时自动恢复最近 30 分钟内的 playground session。

#### Scenario: 切换 agent 恢复近期 session

- **WHEN** 用户在 Playground 切换到 agent A
- **AND** agent A 有近期（< 30min）的 playground session
- **THEN** 自动恢复该 session 并加载历史消息

#### Scenario: 无近期 session 时新建

- **WHEN** 用户在 Playground 切换到 agent B
- **AND** agent B 无近期 playground session
- **THEN** 聊天区域显示空白状态，准备新对话

#### Scenario: Invoke New Session 强制新建

- **WHEN** 用户点击 "Invoke New Session" 按钮
- **THEN** 当前 session 断开
- **AND** 聊天区域清空，准备全新对话

### AgentHistory 标准化表格

AgentHistory 页面 SHALL 提供标准化的表格交互：搜索、过滤、排序、分页、删除。

- **搜索**: `ListToolbar` 组件，按 title 或 agent_name 模糊匹配（客户端）
- **过滤**: "Filter by agent" 和 "Filter by source" 多选下拉（客户端）
- **排序**: 所有列支持 ascend/descend 排序，Last Active 默认 descend
- **分页**: `showTotal` 显示 "Total X sessions"，支持 10/20/50/100 pageSize
- **删除**: 点击 DeleteOutlined → Popconfirm → 确认后删除（`stopPropagation` 防止触发行导航）

### Thinking 等待动画

MessageBubble SHALL 在流式响应等待期间显示 Thinking 动画。

#### Scenario: 流式等待显示 Thinking 动画

- **WHEN** assistant 消息处于 streaming 状态且 content 为空
- **THEN** 显示 ThinkingIndicator（弹跳圆点 `thinking-dot` + 渐变进度条 `thinking-bar`）

#### Scenario: 流式内容显示 blinking cursor

- **WHEN** assistant 消息处于 streaming 状态且 content 非空
- **THEN** 在内容末尾显示 blinking cursor 动画 (`blink-cursor`)

## 8. 社区 Agent 支持

Settings 页面展示 25+ 社区 CLI Coding Agent（来源: OpenSpec supported-tools.md），
包括: Claude Code, Codex, GitHub Copilot, Amazon Q, Gemini Code Assist,
Cursor, Windsurf, Cline, Continue, RooCode, KiloCode, Kiro, Trae, Auggie, Qwen 等。

- 已安装的 Agent 显示实际配置（从本地配置文件读取）
- 未安装的 Agent 显示安装指引
- "Involve Agent" 功能用于将新 Agent 引入系统

## 9. 时间处理注意事项

后端 SQLite `func.now()` 返回 UTC 时间，无时区标记（如 `2024-03-08T10:00:00`）。
前端解析时必须追加 `Z` 后缀，否则在 UTC+N 时区会产生 N 小时偏移。

```typescript
const utcStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
const time = new Date(utcStr);
```
