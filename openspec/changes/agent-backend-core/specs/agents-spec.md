# Agents Module Specification

## Purpose

Agent 模块为 Agentic RAGFlow Studio 提供可插拔的 AI 编码助手能力。通过统一的适配器模式对接本地 CLI Agent（Claude Code、Codex、GitHub Copilot 等），支持自动发现、流式对话、Session 管理和上下文注入。

### Requirement: Agent 发现

#### Scenario: 获取可用 Agent 列表

- **WHEN** GET /api/v1/agents/available
- **THEN** 返回所有已注册 Agent 的信息列表:
  ```json
  [
    {
      "name": "claude-code",
      "display_name": "Claude Code",
      "icon": "claude-code",
      "description": "Anthropic official CLI coding agent",
      "modes": ["plan", "ask", "code"],
      "available": true,
      "version": "1.0.20"
    },
    {
      "name": "codex",
      "display_name": "Codex",
      "icon": "codex",
      "description": "OpenAI Codex CLI coding agent",
      "modes": ["ask", "code"],
      "available": false,
      "version": null
    }
  ]
  ```
- **AND** `available` 字段基于 `shutil.which(cmd)` 检测
- **AND** `version` 字段在 available=true 时通过 `<cmd> --version` 获取

### Requirement: Agent Session 管理

#### Scenario: Session 数据模型

- **GIVEN** 数据库中存在一个 AgentSession 记录
- **THEN** 包含以下字段:
  - id (UUID v4 字符串主键)
  - agent_name (关联的 Agent 名称，如 "claude-code")
  - native_session_id (Agent 原生 session id，可空，首次对话后填充)
  - title (显示标题，默认 "New Session"，首次对话后自动设为消息摘要)
  - mode (上次使用的模式: "plan" | "ask" | "code")
  - source (来源: "playground" | "skill-editor" | "pipeline-editor" | "builtin-skill-editor")
  - created_at / updated_at (时间戳)

#### Scenario: 创建 Session

- **WHEN** POST /api/v1/agents/sessions
- **WITH** body `{"agent_name": "claude-code", "source": "playground", "mode": "code"}`
- **THEN** 返回 201:
  ```json
  {
    "id": "uuid-xxx",
    "agent_name": "claude-code",
    "native_session_id": null,
    "title": "New Session",
    "mode": "code",
    "source": "playground",
    "created_at": "...",
    "updated_at": "..."
  }
  ```

#### Scenario: 列出 Sessions

- **WHEN** GET /api/v1/agents/sessions?source=playground&page=1&page_size=20
- **THEN** 返回分页响应 `{items, total, page, page_size, total_pages}`
- **AND** 按 updated_at 降序排列

#### Scenario: 获取 Session 详情

- **WHEN** GET /api/v1/agents/sessions/{id}
- **THEN** 返回 session 完整信息
- **OR** 返回 404 NOT_FOUND

#### Scenario: 删除 Session

- **WHEN** DELETE /api/v1/agents/sessions/{id}
- **THEN** 返回 204
- **OR** 返回 404 NOT_FOUND

### Requirement: 流式对话 (WebSocket)

#### Scenario: 建立 WebSocket 连接

- **WHEN** WS /api/v1/agents/sessions/{id}/ws
- **AND** session 存在
- **THEN** 连接成功建立

#### Scenario: Session 不存在

- **WHEN** WS /api/v1/agents/sessions/{id}/ws
- **AND** session 不存在
- **THEN** 发送 error 事件并关闭连接

#### Scenario: 发送消息并接收流式响应

- **WHEN** 客户端发送:
  ```json
  {
    "type": "message",
    "content": "帮我写一个文本清洗 skill",
    "mode": "code",
    "context": {
      "type": "skill",
      "skill": {"name": "text-cleaner", "source_code": "..."}
    }
  }
  ```
- **THEN** 服务端流式返回多个事件:
  - `{"type": "text", "content": "...", "metadata": {}}`
  - `{"type": "code", "content": "...", "metadata": {"language": "python"}}`
  - `{"type": "done", "content": "", "metadata": {}}`

#### Scenario: 首次对话填充 native_session_id

- **WHEN** session 的 native_session_id 为 null
- **AND** 完成首次对话
- **THEN** 从 agent 输出中提取 native_session_id 并更新 session 记录
- **AND** 更新 session.title 为首条消息的前 30 个字符

#### Scenario: 恢复原生 Session

- **WHEN** session 的 native_session_id 不为 null
- **AND** 客户端发送消息
- **THEN** 通过 native_session_id 调用 agent 的 resume 功能
- **AND** agent 恢复完整上下文

### Requirement: 上下文注入

#### Scenario: Skill 上下文

- **WHEN** context.type = "skill"
- **THEN** prompt prefix 包含:
  - Skill 名称、类型、描述
  - 完整源代码 (python_code 类型)
  - 测试输入数据
  - Connection 映射

#### Scenario: Pipeline 上下文

- **WHEN** context.type = "pipeline"
- **THEN** prompt prefix 包含:
  - Pipeline 名称、状态
  - 节点列表 (position, skill_name, label)

#### Scenario: 错误上下文

- **WHEN** context.error_result 不为空
- **THEN** prompt prefix 包含:
  - 错误消息和 traceback
  - 失败节点的 input snapshots

#### Scenario: 无上下文 (自由模式)

- **WHEN** context 为 null 或 context.type = "free"
- **THEN** 直接使用用户消息作为 prompt，不添加 prefix

### Requirement: 可插拔 Agent 架构

#### Scenario: 添加新 Agent

- **GIVEN** 开发者需要添加新 Agent (如 OpenCode)
- **WHEN** 创建 `adapters/opencode.py` 实现 `BaseAgentAdapter`
- **AND** 在 `adapters/__init__.py` 中调用 `registry.register(OpenCodeAdapter)`
- **THEN** 新 Agent 自动出现在 `GET /agents/available` 结果中
- **AND** 无需修改任何其他已有文件
