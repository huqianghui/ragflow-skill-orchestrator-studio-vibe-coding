## Why

前期实现了多项新 UI 功能（Agent 切换自动恢复 Session、AgentHistory 标准化表格、Thinking 等待动画、Codex/Copilot 适配器修复），但缺乏 E2E 测试覆盖。需要增加 Playwright 测试确保这些功能在后续迭代中不会回退。

## What Changes

- 新增 `frontend/e2e/agent-history-table.spec.ts` — 覆盖 History 表格的搜索、过滤、排序、分页、删除、行点击导航
- 新增 `frontend/e2e/agent-session-restore.spec.ts` — 覆盖 Agent 切换自动恢复 Session、Invoke New Session、History 点击强制恢复、Session-Agent 绑定
- 新增 `frontend/e2e/agent-chat-ui.spec.ts` — 覆盖 Thinking 动画 CSS 验证、Send 按钮状态、Mode 切换、Agent 面板结构

## Capabilities

### New Capabilities

（无新功能模块，本次变更仅为已有功能添加 E2E 测试）

### Modified Capabilities

（无 spec 级别的行为变更，仅测试覆盖）

## Impact

- **前端 E2E 测试**: 新增 3 个 Playwright 测试文件，共 23 个测试用例
- **CI Pipeline**: E2E 测试可选集成到 CI（需 backend + frontend 同时运行）
- **依赖**: 使用 Playwright `request` API 通过 backend REST API 创建/清理测试数据
- **无代码变更**: 不修改任何业务代码，仅新增测试文件
