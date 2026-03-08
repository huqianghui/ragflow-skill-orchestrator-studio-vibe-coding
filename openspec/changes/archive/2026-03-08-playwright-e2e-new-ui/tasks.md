## 1. Agent History 表格 E2E 测试

- [x] 1.1 创建 `frontend/e2e/agent-history-table.spec.ts`，包含测试数据管理 helpers（createSession, deleteSession, getFirstAgentName）
- [x] 1.2 实现表格基本加载测试（PageHeader 标题 + 6 列列头验证）
- [x] 1.3 实现搜索功能测试（输入过滤 + 清空恢复）
- [x] 1.4 实现 Agent 过滤下拉测试
- [x] 1.5 实现 Source 过滤下拉测试（选择 playground）
- [x] 1.6 实现列排序测试（Last Active 排序切换 + Title 字母排序）
- [x] 1.7 实现分页测试（总数显示 + pageSize 切换 + 翻页，beforeAll 创建 12 个 session）
- [x] 1.8 实现删除 Session 测试（Popconfirm 弹出确认 + 行移除 + stopPropagation 验证）
- [x] 1.9 实现行点击导航测试（跳转 /playground + Send 按钮可见）

## 2. Session 自动恢复 E2E 测试

- [x] 2.1 创建 `frontend/e2e/agent-session-restore.spec.ts`，包含 agent 发现和 session 管理 helpers
- [x] 2.2 实现 Agent 切换恢复近期 Session 测试（通过 API 创建近期 session → 验证 "Session resumed" 或 "Start a conversation"）
- [x] 2.3 实现无近期 Session 时新建测试（清理目标 agent 所有 playground session → 切换 → 验证空白状态）
- [x] 2.4 实现 Invoke New Session 按钮测试（恢复 session 后点击 Invoke → 验证聊天清空）
- [x] 2.5 实现 History 点击强制恢复测试（History 行点击 → Playground 加载 + URL 参数清除）
- [x] 2.6 实现 Session-Agent 绑定测试（创建 2 个 agent 的 session → 切换验证隔离）

## 3. Chat UI 组件 E2E 测试

- [x] 3.1 创建 `frontend/e2e/agent-chat-ui.spec.ts`
- [x] 3.2 实现 Thinking 动画 CSS keyframe 存在性验证（thinking-dot, thinking-bar, blink-cursor）
- [x] 3.3 实现 Send 按钮和输入框测试（可见性 + 聚焦 + 输入 + disabled/enabled 状态切换）
- [x] 3.4 实现空状态验证测试（"Start a conversation" / "Session resumed" / "No available agents"）
- [x] 3.5 实现 Mode 切换测试（ask/code 按钮可见 + 点击切换样式变化）
- [x] 3.6 实现 Agent 面板结构测试（AGENTS 标签 + 卡片 + Invoke New Session 按钮）

## 4. 验证

- [x] 4.1 前端: `npx tsc -b` TypeScript 编译通过
- [x] 4.2 前端: `npm run build` Vite 构建通过
- [x] 4.3 Playwright: `npx playwright test --list` 识别全部 23 个新测试用例
