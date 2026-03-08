# Agent 后端核心：可插拔 Agent 服务层

## 变更编号

`agent-backend-core`

## 状态

`proposed`

## 前置依赖

- `rename-to-agentic-ragflow` (必须先合并)

## 问题描述

Agentic RAGFlow Studio 的核心定位是让 AI Agent 成为平台的一等公民，辅助用户完成 Skill 编写、Pipeline 编排和 Debug 调试。用户本地安装有多个 CLI 编码 Agent（Claude Code、Codex、GitHub Copilot 等），但当前系统没有统一的方式来：

- **发现和管理**本地可用的 CLI Agent
- **流式调用** CLI Agent 并将结果实时推送到前端
- **传递上下文**（当前正在编辑的 Skill/Pipeline 信息）给 Agent
- **管理 Session**，让用户可以继续之前的对话
- **扩展新 Agent**，无需修改已有代码

## 解决方案

构建可插拔的 Agent 服务层，通过注册表 + 适配器模式统一管理本地 CLI Agent，提供 REST + WebSocket API 供前端调用。

### 架构概览

```
Frontend (WebSocket) ←──→ FastAPI ←──→ AgentRegistry ←──→ Adapters ←──→ Local CLI
                                            │
                                    SessionProxy (薄代理)
                                    ContextBuilder (上下文组装)
```

### 核心设计原则

1. **原生优先**：尽可能使用 CLI Agent 的原生能力（session 管理、上下文读取），不重复造轮子
2. **薄代理层**：我们只存 session 元信息映射，消息历史由 Agent 原生管理
3. **可插拔**：添加新 Agent = 添加一个 Adapter 文件 + 自动注册，无需改已有代码
4. **流式传输**：通过 WebSocket 实时转发 Agent 的 stdout 流式输出

### 组件设计

#### 1. BaseAgentAdapter (抽象基类)

```python
class BaseAgentAdapter(ABC):
    name: str              # "claude-code"
    display_name: str      # "Claude Code"
    icon: str              # 前端图标映射 key
    description: str       # 简短说明
    modes: list[AgentMode] # 支持的模式列表

    async def is_available(self) -> bool
    async def get_version(self) -> str | None
    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]
    def extract_session_id(self, first_output: dict) -> str | None
```

#### 2. AgentMode (模式枚举)

每个 Agent 声明自己支持的模式，前端根据此动态渲染模式选择器：

| 模式 | 含义 | Claude Code | Codex | Copilot |
|------|------|-------------|-------|---------|
| `plan` | 规划方案，不执行 | ✅ | ✅ | - |
| `ask` | 纯问答，不改文件 | ✅ | ✅ | ✅ (explain) |
| `code` | 生成/修改代码 | ✅ | ✅ | ✅ (suggest) |

#### 3. AgentRequest / AgentEvent

```python
@dataclass
class AgentRequest:
    prompt: str                    # 用户消息
    mode: str                      # "plan" | "ask" | "code"
    session_id: str | None = None  # 复用原生 session (resume)
    context: AgentContext | None = None

@dataclass
class AgentContext:
    type: str                      # "skill" | "pipeline" | "free"
    skill: dict | None = None      # Skill 完整数据
    pipeline: dict | None = None   # Pipeline 完整数据
    selected_node: str | None = None
    error_result: dict | None = None
    attachments: list[dict] | None = None  # 手动附加的上下文

@dataclass
class AgentEvent:
    type: str       # "text" | "code" | "plan" | "error" | "session_init" | "done"
    content: str
    metadata: dict | None = None  # language, session_id 等
```

#### 4. AgentRegistry (注册表)

```python
class AgentRegistry:
    _adapters: dict[str, type[BaseAgentAdapter]]

    def register(self, adapter_class: type[BaseAgentAdapter]) -> None
    async def discover(self) -> list[AgentInfo]  # 返回所有可用 agent 信息
    def get(self, name: str) -> BaseAgentAdapter
```

adapters 目录下的所有 Adapter 在 `__init__.py` 中自动注册。

#### 5. SessionProxy (薄代理)

不存储消息历史，只维护元信息映射：

```python
# DB Model
class AgentSession(BaseModel):
    __tablename__ = "agent_sessions"
    agent_name: str           # "claude-code"
    native_session_id: str    # Agent 原生 session id
    title: str                # 显示标题 (首条消息摘要)
    mode: str                 # 上次使用的模式
    source: str               # "playground" | "skill-editor" | "pipeline-editor"
```

Session 生命周期：
- **创建**：首次对话时，从 Agent 输出流中提取 native_session_id，存入映射表
- **恢复**：通过 native_session_id 传给 CLI Agent 的 resume 参数
- **列出**：从映射表读取，按 last_active_at 排序
- **删除**：从映射表中移除记录

#### 6. ContextBuilder (上下文组装)

将自动上下文和手动附件组装成结构化的 prompt prefix：

```python
class ContextBuilder:
    async def build(self, context: AgentContext, db: AsyncSession) -> str
    async def build_skill_context(self, skill_data: dict) -> str
    async def build_pipeline_context(self, pipeline_data: dict) -> str
    async def build_error_context(self, error_result: dict) -> str
```

组装结果示例：
```
你正在帮助用户开发 Agentic RAGFlow Studio 中的一个数据处理 Skill。

## 当前 Skill 信息
- 名称: text-cleaner
- 类型: python_code
- 描述: 清洗文本中的HTML标签

## 当前代码
```python
def process(data, context):
    ...
```

## 可用的预加载库
re, json, math, csv, io, base64, hashlib, ...

## 用户的请求
{user_message}
```

#### 7. 三个初始 Adapter

**ClaudeCodeAdapter**
- 检测: `which claude`
- 新 session: `claude -p "{prompt}" --output-format stream-json`
- 恢复 session: `claude -p "{prompt}" --resume "{session_id}" --output-format stream-json`
- plan 模式: 暂不加 flag (通过 prompt 引导)
- ask 模式: 暂不加 flag (通过 prompt 引导)
- 输出解析: JSON stream 逐行解析

**CodexAdapter**
- 检测: `which codex`
- 新 session: `codex "{prompt}"`
- 恢复 session: 根据 codex CLI 的原生 session 能力
- 输出解析: 根据 codex 实际输出格式

**CopilotAdapter**
- 检测: `which copilot`
- 新 session: `copilot` (交互式启动)
- 恢复 session: 支持 `/resume` (根据截图确认)
- 输出解析: 根据 copilot 实际输出格式

> 注意: 三个 Adapter 的具体 CLI 参数和输出解析在 design 阶段根据实际 CLI 文档精确确定。proposal 只定义接口契约。

### API 设计

#### REST API

| 方法 | 路径 | 说明 | 响应 |
|------|------|------|------|
| GET | `/api/v1/agents/available` | 检测可用 Agent 列表 | `[{name, display_name, icon, modes, version, available}]` |
| POST | `/api/v1/agents/sessions` | 创建 session 记录 | 201 `{id, agent_name, ...}` |
| GET | `/api/v1/agents/sessions` | 列出 sessions | 分页 `{items, total, ...}` |
| GET | `/api/v1/agents/sessions/{id}` | 获取 session 详情 | `{id, agent_name, title, ...}` |
| DELETE | `/api/v1/agents/sessions/{id}` | 删除 session | 204 |

#### WebSocket API

| 路径 | 说明 |
|------|------|
| `WS /api/v1/agents/sessions/{id}/ws` | 流式对话 |

WebSocket 消息协议：

**客户端 → 服务端 (发送消息)**
```json
{
  "type": "message",
  "content": "帮我写一个文本清洗 skill",
  "mode": "code",
  "context": {
    "type": "skill",
    "skill": { "name": "text-cleaner", "source_code": "..." }
  }
}
```

**服务端 → 客户端 (流式事件)**
```json
{"type": "session_init", "session_id": "abc-123", "native_session_id": "xxx"}
{"type": "text", "content": "我来帮你写一个..."}
{"type": "code", "content": "def process(data, context):\n    ...", "metadata": {"language": "python"}}
{"type": "done", "metadata": {"execution_time_ms": 3200}}
```

**服务端 → 客户端 (错误)**
```json
{"type": "error", "content": "Agent 'claude-code' is not available on this machine"}
```

### 新增文件

```
backend/app/
├── api/agents.py                      # REST + WebSocket 路由
├── models/agent_session.py            # AgentSession ORM 模型
├── schemas/agent.py                   # Pydantic 请求/响应 schema
└── services/agents/
    ├── __init__.py                    # registry 全局实例
    ├── base.py                        # BaseAgentAdapter, AgentEvent 等
    ├── registry.py                    # AgentRegistry
    ├── session_proxy.py               # SessionProxy
    ├── context_builder.py             # ContextBuilder
    └── adapters/
        ├── __init__.py                # 自动注册
        ├── claude_code.py             # ClaudeCodeAdapter
        ├── codex.py                   # CodexAdapter
        └── copilot.py                 # CopilotAdapter
```

### 修改文件

| 文件 | 改动 |
|------|------|
| `backend/app/api/router.py` | 注册 agents 路由 |
| `backend/app/models/__init__.py` | 导入 AgentSession |
| `backend/alembic/versions/d750dfb7d5f0_init_tables.py` | 加 agent_sessions 表 |
| `backend/app/main.py` | WebSocket 路由挂载 |
| `openspec/config.yaml` | specs 列表加 agents/spec.md, description 更新 |

## 影响范围

| 维度 | 说明 |
|------|------|
| 影响模块 | `backend/` — 新增 Agent 服务层 + API |
| 依赖关系 | 依赖 `rename-to-agentic-ragflow` |
| 被依赖方 | `embedded-agent-ui` 和 `agent-playground` 依赖本 change 提供的 API |
| 风险等级 | **中** — subprocess 管理、WebSocket 流式传输需要仔细处理 |
| 关键风险 | CLI Agent 的 stdout 输出格式可能因版本变化，需要健壮的解析逻辑 |

## 成功标准

1. `GET /agents/available` 正确检测本地已安装的 CLI Agent 及其版本
2. 通过 WebSocket 发送消息后，能收到流式 AgentEvent
3. Session 创建、恢复、列出、删除全部工作正常
4. ContextBuilder 能正确组装 Skill 和 Pipeline 上下文
5. 添加新 Agent 只需新建一个 Adapter 文件，无需改已有代码
6. `ruff check .` + `ruff format --check .` + `pytest` 全通过
7. Alembic migration 正确创建 agent_sessions 表

## 与其他 Change 的协调

### 为 `embedded-agent-ui` 提供的接口契约

前端嵌入式 Agent 将通过以下方式调用：
- `GET /agents/available` — 获取可用 Agent 列表，渲染选择器
- `POST /agents/sessions` — 创建临时 session (source="skill-editor" 或 "pipeline-editor")
- `WS /agents/sessions/{id}/ws` — 流式对话，消息中携带自动上下文
- ContextBuilder 负责将前端传来的 `context.skill` 或 `context.pipeline` 组装成 prompt

### 为 `agent-playground` 提供的接口契约

Playground 将额外使用：
- `GET /agents/sessions?source=playground` — 列出 Playground session 历史
- `GET /agents/sessions/{id}` — 获取 session 详情 (标题、agent、模式)
- Session resume 通过 WS 消息中的 `session_id` 字段触发原生 session 恢复
- Playground 的 session 和嵌入式 Agent 的 session 通过 `source` 字段区分

### 共享类型定义

本 change 定义的 WebSocket 消息协议 (`AgentEvent` 类型) 是前端两个 change 的共享契约：
- `embedded-agent-ui` 和 `agent-playground` 使用相同的 `AgentEvent` 类型
- 前端类型定义文件 `types/agent.ts` 在 `embedded-agent-ui` 中创建，`agent-playground` 复用
