# Tasks: editor-layout-refactor

## 1. 默认主题

- [x] 1.1 修改 `frontend/src/stores/themeStore.ts` — `loadThemeKey()` 默认返回值从 `'light'` 改为 `'sky-blue'`

## 2. Agent 嵌入模式精简

- [x] 2.1 修改 `frontend/src/components/agent/AgentChatWidget.tsx` — embedded=true 时不渲染 `<AgentDetailPanel>`（去掉 Tools/MCP 展示）
- [x] 2.2 修改 `frontend/src/components/agent/AgentChatWidget.tsx` — embedded=true 时过滤 modes 列表去掉 `plan`，只保留 ask/code；若过滤后只剩一个 mode 则隐藏 mode 选择器

## 3. SkillEditor 右侧面板重构

- [x] 3.1 修改 `frontend/src/pages/SkillEditor.tsx` — 删除 `agentDrawerOpen` 状态和 `<Drawer>` 组件
- [x] 3.2 修改 `frontend/src/pages/SkillEditor.tsx` — 右侧面板从独立 Card 列表改为 `<Collapse>`（非 accordion，各 section 独立展开），包含 3 个 Panel: Connection Mappings、Additional Requirements、Test Input & Output
- [x] 3.3 修改 `frontend/src/pages/SkillEditor.tsx` — Agent Assistant 作为独立右侧面板，通过 Agent 按钮 toggle 显示/隐藏
- [x] 3.4 修改 `frontend/src/pages/SkillEditor.tsx` — Collapse 设置 `destroyInactivePanel={false}` 保持组件状态

## 4. PipelineEditor Agent 面板重构

- [x] 4.1 修改 `frontend/src/pages/PipelineEditor.tsx` — 删除 `agentDrawerOpen` 状态和 `<Drawer>` 组件
- [x] 4.2 修改 `frontend/src/pages/PipelineEditor.tsx` — Agent Assistant 作为独立右侧面板，toggle 显示/隐藏
- [x] 4.3 修改 `frontend/src/pages/PipelineEditor.tsx` — Agent 按钮改为控制面板 toggle

## 5. BuiltinSkillEditor 面板重构

- [x] 5.1 修改 `frontend/src/pages/BuiltinSkillEditor.tsx` — 删除 `agentDrawerOpen` 状态和两个 `<Drawer>` 组件
- [x] 5.2 修改 `frontend/src/pages/BuiltinSkillEditor.tsx` — 标准布局: Test 改为 Collapse，Agent 作为独立右侧面板；DocumentCracker 布局: Agent 作为独立右侧面板
- [x] 5.3 修改 `frontend/src/pages/BuiltinSkillEditor.tsx` — Agent 按钮改为控制面板 toggle

## 6. 一致性迭代 — 全系统互斥面板模式

- [x] 6.1 修改 `frontend/src/pages/SkillEditor.tsx` — 右侧面板改为互斥模式（Config/Agent 共享同一列），Agent Collapse 高度自适应
- [x] 6.2 修改 `frontend/src/pages/PipelineEditor.tsx` EditMode — 改为互斥面板模式，showAgent 时右侧整列替换为 Agent Collapse
- [x] 6.3 修改 `frontend/src/pages/PipelineEditor.tsx` DebugMode — 改为互斥面板模式，showAgent 时右侧列替换为 Agent Collapse
- [x] 6.4 修改 `frontend/src/pages/BuiltinSkillEditor.tsx` — 标准布局和 DocCracker 布局都改为互斥面板模式
- [x] 6.5 更新 `design.md` — 记录最终互斥面板设计决策（D1-D7）

## 7. 检查

- [x] 7.1 运行 `npx tsc -b` — 零 TypeScript 错误
- [x] 7.2 运行 `npm run build` — Vite 构建成功
- [x] 7.3 运行后端 `ruff check . && ruff format --check . && pytest tests/ -v`（确认无影响，224/225 通过，1 个已有超时测试无关本次变更）
- [x] 7.4 最终构建验证（一致性迭代后）— `npx tsc -b` + `npm run build` 通过
