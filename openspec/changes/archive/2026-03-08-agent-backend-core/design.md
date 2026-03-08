# Design: Agent 后端核心 — 可插拔 Agent 服务层

## 1. 架构概览

```
Frontend (WS/REST)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  api/agents.py                                   │
│  REST: /agents/available, /agents/sessions/*    │
│  WS:   /agents/sessions/{id}/ws                 │
└──────────────────┬──────────────────────────────┘
                   │
    ┌──────────────┼──────────────────┐
    ▼              ▼                  ▼
AgentRegistry  SessionProxy    ContextBuilder
    │          (DB: agent_      (组装 prompt
    │           sessions)        prefix)
    ▼
┌─────────────────────────────┐
│  adapters/                   │
│  ├── claude_code.py         │
│  ├── codex.py               │
│  └── copilot.py             │
└──────────────┬──────────────┘
               │ subprocess (stdin/stdout)
               ▼
         Local CLI Agents
```

## 2. 数据模型

### AgentSession (ORM)

```python
class AgentSession(BaseModel):
    __tablename__ = "agent_sessions"

    agent_name: Mapped[str] = mapped_column(String(50), nullable=False)
    native_session_id: Mapped[str | None] = mapped_column(String(255), default=None)
    title: Mapped[str] = mapped_column(String(255), default="New Session")
    mode: Mapped[str] = mapped_column(String(20), default="code")
    source: Mapped[str] = mapped_column(String(50), default="playground")
    # "playground" | "skill-editor" | "pipeline-editor" | "builtin-skill-editor"
```

继承 `BaseModel`，自动获得 `id`, `created_at`, `updated_at`。

### Alembic Migration

在 init migration 中追加 `agent_sessions` 表，同时创建独立的新 migration 文件。

## 3. Agent 适配器层

### 3.1 核心类型

```python
# services/agents/base.py

from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncGenerator

class AgentMode(str, Enum):
    PLAN = "plan"
    ASK = "ask"
    CODE = "code"

@dataclass
class AgentInfo:
    name: str               # "claude-code"
    display_name: str       # "Claude Code"
    icon: str               # "claude-code" (前端图标映射)
    description: str
    modes: list[AgentMode]
    available: bool
    version: str | None = None

@dataclass
class AgentContext:
    type: str = "free"                          # "skill" | "pipeline" | "free"
    skill: dict | None = None
    pipeline: dict | None = None
    selected_node: str | None = None
    error_result: dict | None = None
    attachments: list[dict] = field(default_factory=list)

@dataclass
class AgentRequest:
    prompt: str
    mode: AgentMode = AgentMode.CODE
    session_id: str | None = None               # native session id for resume
    context: AgentContext | None = None

@dataclass
class AgentEvent:
    type: str               # "text" | "code" | "error" | "session_init" | "done"
    content: str = ""
    metadata: dict = field(default_factory=dict)
    # metadata 可含: language, session_id, execution_time_ms 等
```

### 3.2 BaseAgentAdapter

```python
# services/agents/base.py

from abc import ABC, abstractmethod

class BaseAgentAdapter(ABC):
    name: str
    display_name: str
    icon: str
    description: str
    modes: list[AgentMode]

    @abstractmethod
    async def is_available(self) -> bool:
        """检测 CLI 是否已安装并可执行。"""

    @abstractmethod
    async def get_version(self) -> str | None:
        """返回 CLI 版本号，不可用时返回 None。"""

    async def get_info(self) -> AgentInfo:
        """返回完整的 agent 信息。"""
        available = await self.is_available()
        version = await self.get_version() if available else None
        return AgentInfo(
            name=self.name,
            display_name=self.display_name,
            icon=self.icon,
            description=self.description,
            modes=self.modes,
            available=available,
            version=version,
        )

    @abstractmethod
    async def execute(
        self, request: AgentRequest
    ) -> AsyncGenerator[AgentEvent, None]:
        """流式执行 agent，yield AgentEvent。"""

    @abstractmethod
    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        """从初始输出事件中提取原生 session id。"""
```

### 3.3 三个 Adapter 实现

#### ClaudeCodeAdapter

```python
class ClaudeCodeAdapter(BaseAgentAdapter):
    name = "claude-code"
    display_name = "Claude Code"
    icon = "claude-code"
    description = "Anthropic official CLI coding agent"
    modes = [AgentMode.PLAN, AgentMode.ASK, AgentMode.CODE]

    async def is_available(self) -> bool:
        return await _check_command("claude")

    async def get_version(self) -> str | None:
        return await _get_command_output("claude", "--version")

    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]:
        cmd = ["claude", "-p", request.prompt, "--output-format", "stream-json"]
        if request.session_id:
            cmd.extend(["--resume", request.session_id])
        # mode 通过 prompt prefix 区分，不用额外 flag

        async for event in _stream_subprocess(cmd):
            yield event

    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        for e in events:
            if e.type == "session_init" and "session_id" in e.metadata:
                return e.metadata["session_id"]
        return None
```

#### CodexAdapter

```python
class CodexAdapter(BaseAgentAdapter):
    name = "codex"
    display_name = "Codex"
    icon = "codex"
    description = "OpenAI Codex CLI coding agent"
    modes = [AgentMode.ASK, AgentMode.CODE]

    async def is_available(self) -> bool:
        return await _check_command("codex")

    async def get_version(self) -> str | None:
        return await _get_command_output("codex", "--version")

    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]:
        cmd = ["codex", "--quiet", request.prompt]
        async for event in _stream_subprocess(cmd):
            yield event

    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        # codex session 管理策略待确认
        return None
```

#### CopilotAdapter (Stub — 非交互模式参数待确认)

Copilot CLI 目前是交互式工具，非交互模式的 CLI 参数尚未确认。
本 adapter 先实现 `is_available` / `get_version`，`execute` 暂抛出 NotImplementedError。

```python
class CopilotAdapter(BaseAgentAdapter):
    name = "copilot"
    display_name = "GitHub Copilot"
    icon = "copilot"
    description = "GitHub Copilot CLI coding agent (stub — non-interactive mode TBD)"
    modes = [AgentMode.ASK, AgentMode.CODE]

    async def is_available(self) -> bool:
        return await _check_command("copilot")

    async def get_version(self) -> str | None:
        return await _get_command_output("copilot", "--version")

    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]:
        # TODO: Copilot CLI 的非交互模式参数待确认
        yield AgentEvent(
            type="error",
            content="Copilot adapter is not yet implemented. Non-interactive CLI mode TBD.",
        )

    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        return None
```

### 3.4 共享工具函数

```python
# services/agents/base.py 底部

async def _check_command(cmd: str) -> bool:
    """检测命令是否存在 (shutil.which)。使用 to_thread 避免阻塞事件循环。"""
    import shutil
    return await asyncio.to_thread(shutil.which, cmd) is not None

async def _get_command_output(cmd: str, *args: str) -> str | None:
    """执行命令并返回 stdout 首行。"""
    proc = await asyncio.create_subprocess_exec(
        cmd, *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
    return stdout.decode().strip() if stdout else None

async def _stream_subprocess(
    cmd: list[str],
    cwd: str | None = None,
    timeout: float = 300,
) -> AsyncGenerator[AgentEvent, None]:
    """启动 subprocess 并流式 yield AgentEvent。

    通用实现：逐行读取 stdout，尝试 JSON 解析，
    解析失败时作为纯文本 event。

    注意：
    - stdin 使用 DEVNULL 防止某些 CLI 等待输入
    - stderr 使用 DEVNULL 防止 buffer 满导致阻塞
    - timeout 通过 asyncio.wait_for 实现保护
    """
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
        cwd=cwd,
    )
    try:
        async def _read_events():
            async for line in proc.stdout:
                text = line.decode("utf-8", errors="replace").rstrip()
                if not text:
                    continue
                try:
                    data = json.loads(text)
                    yield _parse_json_event(data)
                except json.JSONDecodeError:
                    yield AgentEvent(type="text", content=text)

        async for event in asyncio.wait_for(_read_events(), timeout=timeout):
            yield event
    except asyncio.TimeoutError:
        yield AgentEvent(type="error", content=f"Agent timed out after {timeout}s")
    finally:
        if proc.returncode is None:
            proc.terminate()
            await proc.wait()

def _parse_json_event(data: dict) -> AgentEvent:
    """将 JSON 行转为 AgentEvent。各 adapter 可覆盖此逻辑。"""
    # Claude Code stream-json 格式: {"type": "assistant", "message": {...}}
    # 通用 fallback
    event_type = data.get("type", "text")
    content = data.get("content", "") or data.get("message", {}).get("content", "")
    return AgentEvent(type=event_type, content=str(content), metadata=data)
```

### 3.5 AgentRegistry

```python
# services/agents/registry.py

class AgentRegistry:
    def __init__(self):
        self._adapters: dict[str, type[BaseAgentAdapter]] = {}

    def register(self, adapter_class: type[BaseAgentAdapter]) -> None:
        instance = adapter_class()
        self._adapters[instance.name] = adapter_class

    async def discover(self) -> list[AgentInfo]:
        """返回所有已注册 agent 的信息。单个 adapter 异常不影响其他。"""
        results = []
        for cls in self._adapters.values():
            try:
                adapter = cls()
                info = await adapter.get_info()
                results.append(info)
            except Exception:
                # 单个 adapter 异常时返回不可用状态，不中断整体
                adapter = cls()
                results.append(AgentInfo(
                    name=adapter.name, display_name=adapter.display_name,
                    icon=adapter.icon, description=adapter.description,
                    modes=adapter.modes, available=False, version=None,
                ))
        return results

    def get(self, name: str) -> BaseAgentAdapter:
        if name not in self._adapters:
            raise ValueError(f"Unknown agent: {name}")
        return self._adapters[name]()

    def list_names(self) -> list[str]:
        return list(self._adapters.keys())

# 全局单例
registry = AgentRegistry()
```

### 3.6 自动注册

```python
# services/agents/adapters/__init__.py

from app.services.agents.registry import registry
from app.services.agents.adapters.claude_code import ClaudeCodeAdapter
from app.services.agents.adapters.codex import CodexAdapter
from app.services.agents.adapters.copilot import CopilotAdapter

registry.register(ClaudeCodeAdapter)
registry.register(CodexAdapter)
registry.register(CopilotAdapter)
```

### 3.7 services/agents/__init__.py

```python
# services/agents/__init__.py
# 导出公共接口，并 import adapters 子包以触发自动注册

from app.services.agents.base import (
    AgentContext,
    AgentEvent,
    AgentMode,
    AgentRequest,
    BaseAgentAdapter,
)
from app.services.agents.registry import registry

# CRITICAL: 导入 adapters 包以触发 registry.register() 调用
import app.services.agents.adapters  # noqa: F401

__all__ = [
    "registry",
    "BaseAgentAdapter",
    "AgentContext",
    "AgentEvent",
    "AgentMode",
    "AgentRequest",
]
```

## 4. SessionProxy

```python
# services/agents/session_proxy.py

class SessionProxy:
    """薄代理层 — 只管理 session 元信息，不存消息历史。"""

    async def create(
        self, db: AsyncSession, agent_name: str, source: str, mode: str
    ) -> AgentSession:
        session = AgentSession(
            agent_name=agent_name,
            source=source,
            mode=mode,
            title="New Session",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    async def update_native_id(
        self, db: AsyncSession, session_id: str, native_id: str
    ) -> None:
        """首次对话后，存储 native session id 映射。"""
        result = await db.execute(
            select(AgentSession).where(AgentSession.id == session_id)
        )
        session = result.scalar_one()
        session.native_session_id = native_id
        await db.commit()

    async def update_title(
        self, db: AsyncSession, session_id: str, title: str
    ) -> None:
        result = await db.execute(
            select(AgentSession).where(AgentSession.id == session_id)
        )
        session = result.scalar_one()
        session.title = title[:255]
        await db.commit()

    async def list_sessions(
        self, db: AsyncSession, source: str | None = None,
        page: int = 1, page_size: int = 20
    ) -> PaginatedResponse:
        """复用现有 paginate() 工具函数返回统一分页格式。"""
        query = select(AgentSession)
        if source:
            query = query.where(AgentSession.source == source)
        query = query.order_by(AgentSession.updated_at.desc())
        return await paginate(db, query, page, page_size)
        # paginate() 返回 {"items": [...], "total": N, "page": N, "page_size": N, "total_pages": N}

    async def get(self, db: AsyncSession, session_id: str) -> AgentSession | None:
        result = await db.execute(
            select(AgentSession).where(AgentSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def delete(self, db: AsyncSession, session_id: str) -> None:
        result = await db.execute(
            select(AgentSession).where(AgentSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            await db.delete(session)
            await db.commit()
```

## 5. ContextBuilder

```python
# services/agents/context_builder.py

class ContextBuilder:
    """将自动上下文和手动附件组装成结构化的 prompt prefix。"""

    def build(self, context: AgentContext | None, user_prompt: str) -> str:
        if not context or context.type == "free":
            return user_prompt

        parts = []
        if context.type == "skill" and context.skill:
            parts.append(self._build_skill_section(context.skill))
        elif context.type == "pipeline" and context.pipeline:
            parts.append(self._build_pipeline_section(context.pipeline))

        if context.error_result:
            parts.append(self._build_error_section(context.error_result))

        if context.attachments:
            parts.append(self._build_attachments_section(context.attachments))

        parts.append(f"## User Request\n\n{user_prompt}")
        return "\n\n".join(parts)

    def _build_skill_section(self, skill: dict) -> str:
        lines = [
            "## Current Skill Context",
            f"- Name: {skill.get('name', 'unknown')}",
            f"- Type: {skill.get('skill_type', 'unknown')}",
        ]
        if skill.get("description"):
            lines.append(f"- Description: {skill['description']}")
        if skill.get("source_code"):
            lines.append(f"\n### Source Code\n```python\n{skill['source_code']}\n```")
        if skill.get("test_input"):
            lines.append(
                f"\n### Test Input\n```json\n"
                f"{json.dumps(skill['test_input'], indent=2, ensure_ascii=False)}\n```"
            )
        return "\n".join(lines)

    def _build_pipeline_section(self, pipeline: dict) -> str:
        lines = [
            "## Current Pipeline Context",
            f"- Name: {pipeline.get('name', 'unknown')}",
            f"- Status: {pipeline.get('status', 'draft')}",
        ]
        nodes = pipeline.get("graph_data", {}).get("nodes", [])
        if nodes:
            lines.append(f"\n### Pipeline Nodes ({len(nodes)} nodes)")
            for n in sorted(nodes, key=lambda x: x.get("position", 0)):
                lines.append(
                    f"  {n.get('position', '?')}. {n.get('label', n.get('skill_name', '?'))}"
                )
        return "\n".join(lines)

    def _build_error_section(self, error: dict) -> str:
        lines = ["## Error Context"]
        if isinstance(error, dict):
            for err in error.get("errors", [error]):
                lines.append(f"- Message: {err.get('message', 'unknown')}")
                if err.get("traceback"):
                    lines.append(f"```\n{err['traceback']}\n```")
        return "\n".join(lines)

    def _build_attachments_section(self, attachments: list[dict]) -> str:
        lines = ["## Additional Context"]
        for att in attachments:
            att_type = att.get("type", "text")
            lines.append(f"\n### Attachment ({att_type})")
            lines.append(att.get("content", ""))
        return "\n".join(lines)
```

## 6. API 层

### 6.1 REST API

```python
# api/agents.py

router = APIRouter(prefix="/agents", tags=["agents"])

@router.get("/available")
async def list_available_agents() -> list[AgentInfoResponse]:
    """检测并返回所有已注册 agent 的可用状态。"""

@router.post("/sessions", status_code=201)
async def create_session(body: CreateSessionRequest, db=Depends(get_db)):
    """创建新 session 记录。"""

@router.get("/sessions")
async def list_sessions(
    source: str | None = None,
    page: int = 1, page_size: int = 20,
    db=Depends(get_db)
):
    """列出 sessions，可按 source 过滤。"""

@router.get("/sessions/{session_id}")
async def get_session(session_id: str, db=Depends(get_db)):

@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str, db=Depends(get_db)):
```

### 6.2 WebSocket API

```python
# api/agents.py 中

@router.websocket("/sessions/{session_id}/ws")
async def agent_chat_ws(websocket: WebSocket, session_id: str, db=Depends(get_db)):
    """
    WebSocket 流式对话。

    客户端发送:
    {
      "type": "message",
      "content": "...",
      "mode": "code",
      "context": { "type": "skill", "skill": {...} }
    }

    服务端发送:
    {"type": "session_init", "content": "", "metadata": {"session_id": "..."}}
    {"type": "text", "content": "..."}
    {"type": "code", "content": "...", "metadata": {"language": "python"}}
    {"type": "error", "content": "..."}
    {"type": "done", "content": "", "metadata": {"execution_time_ms": 3200}}
    """
    await websocket.accept()

    # 获取 session 信息
    session = await session_proxy.get(db, session_id)
    if not session:
        await websocket.send_json({"type": "error", "content": "Session not found"})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "message":
                continue

            # 用 AgentChatMessage schema 验证输入
            try:
                msg = AgentChatMessage(**data)
            except Exception:
                await websocket.send_json({"type": "error", "content": "Invalid message format"})
                continue

            # 构建请求
            agent = registry.get(session.agent_name)
            context = AgentContext(**msg.context) if msg.context else None
            full_prompt = context_builder.build(context, msg.content)
            request = AgentRequest(
                prompt=full_prompt,
                mode=AgentMode(msg.mode or session.mode),
                session_id=session.native_session_id,
                context=context,
            )

            # 流式执行并转发 — 用 try/except 包裹防止 subprocess 异常中断连接
            events = []
            try:
                async for event in agent.execute(request):
                    events.append(event)
                    await websocket.send_json({
                        "type": event.type,
                        "content": event.content,
                        "metadata": event.metadata,
                    })
            except Exception as exc:
                await websocket.send_json({
                    "type": "error", "content": f"Agent execution failed: {exc}", "metadata": {},
                })

            # 首次对话: 提取并保存 native session id
            # 注意：每次 DB 操作使用独立的 db session 避免长连接 session 过期
            if not session.native_session_id:
                native_id = agent.extract_session_id(events)
                if native_id:
                    async with get_db_session() as fresh_db:
                        await session_proxy.update_native_id(fresh_db, session_id, native_id)
                    session.native_session_id = native_id

            # 更新 title (如果还是默认标题)
            if session.title == "New Session":
                title = msg.content[:30]
                async with get_db_session() as fresh_db:
                    await session_proxy.update_title(fresh_db, session_id, title)
                session.title = title

            # 发送完成事件
            await websocket.send_json({"type": "done", "content": "", "metadata": {}})

    except WebSocketDisconnect:
        pass  # subprocess 的 _stream_subprocess finally 块会自动 terminate
```

### 6.3 注册路由

```python
# api/router.py 中追加:
from app.api import agents
api_router.include_router(agents.router)
```

FastAPI 的 APIRouter 支持 WebSocket 路由随 prefix 注册，只需在 `api/router.py` 中通过 `include_router` 统一注册即可，**不需要修改 `main.py`**。

## 7. Pydantic Schemas

```python
# schemas/agent.py

class AgentInfoResponse(BaseModel):
    name: str
    display_name: str
    icon: str
    description: str
    modes: list[str]
    available: bool
    version: str | None = None

class CreateSessionRequest(BaseModel):
    agent_name: str
    source: str = "playground"
    mode: str = "code"

class AgentSessionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    agent_name: str
    native_session_id: str | None
    title: str
    mode: str
    source: str
    created_at: datetime
    updated_at: datetime

class AgentChatMessage(BaseModel):
    """WebSocket 客户端发送的消息，用于 JSON schema 验证。"""
    type: str = "message"
    content: str
    mode: str = "code"
    context: dict | None = None

class AgentEventResponse(BaseModel):
    type: str
    content: str = ""
    metadata: dict = Field(default_factory=dict)
```

## 8. 测试策略

- **test_agent_registry.py**: 注册、发现、get 的单元测试
- **test_agent_session_api.py**: Session CRUD 的 API 测试 (用内存 SQLite)
- **test_context_builder.py**: 各类型上下文的组装测试
- **test_agent_adapters.py**: Adapter 的 `is_available` 和 `_build_command` 测试 (mock subprocess)
- **test_schema_integrity.py**: 自动验证 agent_sessions 表存在

不测试真实 CLI Agent 调用（需要本地安装），adapter 的 execute 方法用 mock 测试。
