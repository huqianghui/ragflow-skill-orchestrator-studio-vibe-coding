# Tasks: agent-backend-core

## Tasks

### 基础层

- [x] 1. 创建 `services/agents/base.py` — AgentMode, AgentInfo, AgentContext, AgentRequest, AgentEvent 数据类 + BaseAgentAdapter ABC + 共享工具函数 (_check_command 用 asyncio.to_thread, _get_command_output, _stream_subprocess 含 timeout/stdin DEVNULL/stderr DEVNULL, _parse_json_event)
- [x] 2. 创建 `services/agents/registry.py` — AgentRegistry 类 (register, discover 含单 adapter try/except 隔离, get, list_names) + 全局 registry 单例
- [x] 3. 创建 `services/agents/__init__.py` — 导出 registry, BaseAgentAdapter, AgentEvent 等公共接口 + **import adapters 子包触发自动注册**

### 适配器

- [x] 4. 创建 `services/agents/adapters/claude_code.py` — ClaudeCodeAdapter 实现 (is_available, get_version, execute 含 --output-format stream-json 和 --resume, extract_session_id)
- [x] 5. 创建 `services/agents/adapters/codex.py` — CodexAdapter 实现 (execute 使用 --quiet 模式, extract_session_id 返回 None — session 策略待确认)
- [x] 6. 创建 `services/agents/adapters/copilot.py` — CopilotAdapter **stub 实现** (is_available/get_version 正常实现, execute 返回 error event "非交互模式 TBD")
- [x] 7. 创建 `services/agents/adapters/__init__.py` — 自动注册三个 adapter 到 registry

### 数据模型 & Migration

- [x] 8. 创建 `models/agent_session.py` — AgentSession ORM 模型 (agent_name, native_session_id, title, mode, source)
- [x] 9. 更新 `models/__init__.py` — 导入 AgentSession，加入 __all__
- [x] 10. 更新 `alembic/versions/d750dfb7d5f0_init_tables.py` — 在 upgrade() 中追加 agent_sessions 表定义，downgrade() 中追加 drop_table
- [x] 11. 创建新的 Alembic migration 文件 — `alembic revision -m "add agent_sessions table"`，实现 upgrade (create_table) 和 downgrade (drop_table)

### 服务层

- [x] 12. 创建 `services/agents/session_proxy.py` — SessionProxy 类 (create, get, list_sessions 复用 paginate() 工具返回统一分页格式, update_native_id, update_title, delete)
- [x] 13. 创建 `services/agents/context_builder.py` — ContextBuilder 类 (build, _build_skill_section, _build_pipeline_section, _build_error_section, _build_attachments_section)

### Schema & API

- [x] 14. 创建 `schemas/agent.py` — AgentInfoResponse, CreateSessionRequest (含 agent 可用性验证), AgentSessionResponse (含 model_config from_attributes), AgentChatMessage, AgentEventResponse (metadata 用 Field(default_factory=dict))
- [x] 15. 创建 `api/agents.py` — REST 路由 (GET /available, POST/GET/DELETE /sessions) + WebSocket 路由 (/sessions/{id}/ws，含 agent.execute try/except 错误处理、AgentChatMessage schema 验证输入、每次 DB 操作使用独立 session)
- [x] 16. 更新 `api/router.py` — 注册 agents router (不需要修改 main.py，WebSocket 随 APIRouter 注册)

### 测试

- [x] 17. 创建 `tests/test_agent_registry.py` — 测试 register, discover (含 adapter 异常隔离), get
- [x] 18. 创建 `tests/test_agent_session_api.py` — 测试 Session CRUD API (create 201, list 分页, get, delete 204, not_found 404)
- [x] 19. 创建 `tests/test_context_builder.py` — 测试 skill/pipeline/error/free 上下文组装
- [x] 20. 创建 `tests/test_agent_websocket.py` — 测试 WebSocket 连接建立、session-not-found 错误、mock execute 流式事件转发
- [x] 21. 更新 `tests/test_schema_integrity.py` — 验证 agent_sessions 表列完整性 + alembic migration 匹配

### 检查

- [x] 22. 运行 ruff check + ruff format --check + pytest 全部通过
- [x] 23. 运行 npx tsc -b + npm run build 全部通过 (确认无前端影响)
