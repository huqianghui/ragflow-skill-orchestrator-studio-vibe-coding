## Context

前期完成了多项 Agent 模块新功能：
- Agent 切换自动恢复近期 Session（< 30min）
- AgentHistory 标准化表格（搜索/过滤/排序/分页）
- MessageBubble Thinking 等待动画（bouncing dots + gradient bar）
- Codex/Copilot 适配器修复

现有 E2E 测试仅覆盖基础加载、按钮高亮、History 导航和 URL 参数（`agent-playground.spec.ts` + `editor-layout.spec.ts`），缺少对新增功能的深度覆盖。

## Goals / Non-Goals

**Goals:**
- 为 History 表格的搜索、过滤、排序、分页、删除提供完整 E2E 覆盖
- 为 Session 自动恢复、Invoke New Session、Agent 绑定提供 E2E 覆盖
- 为 Chat UI 组件（Thinking 动画、Send 按钮状态、Mode 切换）提供 E2E 覆盖
- 测试通过 Playwright `request` API 自管理测试数据（创建/清理），不依赖预置数据

**Non-Goals:**
- 不测试真实 WebSocket 流式对话（需 Agent CLI 在线）
- 不测试后端 API 逻辑（已有 pytest 覆盖）
- 不修改任何业务代码

## Decisions

### 1. 测试数据管理策略 — Playwright request API

**选择**: 通过 `playwright.request.newContext()` 调用 backend REST API 创建/清理测试数据。

**理由**:
- 不依赖 DB 预置数据，测试自包含
- `beforeAll` 创建、`afterAll` 清理，避免测试间干扰
- 比 seed 脚本更灵活，与现有 API 契约保持一致

**备选方案**: DB seed fixture → 拒绝，因增加额外脚本维护成本

### 2. 三文件分组策略

**选择**: 按功能区域分为 3 个独立测试文件。

| 文件 | 关注点 |
|------|--------|
| `agent-history-table.spec.ts` | History 表格 CRUD + 交互 |
| `agent-session-restore.spec.ts` | Session 生命周期管理 |
| `agent-chat-ui.spec.ts` | Chat 组件结构 + 交互 |

**理由**: 职责清晰，可独立运行，失败定位快

### 3. Thinking 动画验证策略 — CSS keyframe 存在性检查

**选择**: 验证 `@keyframes thinking-dot` 和 `thinking-bar` 在页面样式中的存在性，而非触发真实流式状态。

**理由**:
- ThinkingIndicator 只在 `streaming && !content` 时渲染，依赖 WebSocket 流
- 真实触发需 Agent CLI 在线，E2E 环境不保证
- CSS keyframe 存在性验证是可靠的结构性检查

### 4. 容错性设计 — `test.skip` 降级

**选择**: 当前置条件不满足时（如无可用 agent、数据不足），使用 `test.skip()` 跳过而非 fail。

**理由**: E2E 环境变化大（agent 是否在线、数据量等），保证 CI 稳定性

## Risks / Trade-offs

- **[环境依赖]** Session restore 测试依赖 backend 返回近期 session → 使用 `beforeAll` 实时创建确保时效
- **[数据竞争]** 并行运行时 session 列表可能受其他测试影响 → 每个 test suite 独立创建/清理数据
- **[Agent 可用性]** 部分测试依赖至少 1-2 个 available agent → 不满足时 `test.skip`
