## Context

当前前端基于 React + Ant Design 5.x + Vite 构建。所有 13 个页面组件各自实现页面头部、搜索栏、加载状态等 UI 模式，导致大量重复代码和不一致的用户体验。AppLayout 仅有固定的浅色主题，无法满足用户对个性化和暗色模式的需求。

**当前痛点：**
- 每个列表页（SkillLibrary、Connections、Pipelines、DataSources、Targets）各自手写相同的头部布局和搜索栏模式
- RunHistory 页面是空壳，`dataSource={[]}`，无 API 调用
- 无主题切换能力，仅硬编码的浅色风格
- 加载/空状态处理不统一

## Goals / Non-Goals

**Goals:**
- 引入基于 Ant Design ConfigProvider 的多主题切换系统，内置 4 套主题
- 抽取 PageHeader 和 ListToolbar 共享组件，消除页面间的重复代码
- 激活 RunHistory 页面，连接真实 API
- 统一全部列表页的加载、空状态、搜索/分页体验

**Non-Goals:**
- 不做国际化 (i18n) 改造（本次仅 UI 主题和组件化）
- 不修改后端 API
- 不引入 CSS Modules 或 Tailwind 等新 CSS 方案
- 不做移动端适配优化（保持桌面端优先）
- 不重构 PipelineEditor 的 ReactFlow 画布逻辑

## Decisions

### Decision 1: 使用 Ant Design ConfigProvider + algorithm 实现主题切换

**选择:** 使用 antd 5.x 内置的 `ConfigProvider.theme` + `theme.defaultAlgorithm / darkAlgorithm` + 自定义 token

**备选方案:**
- CSS Variables 手动管理 → 工作量大，与 antd 组件主题不一致
- styled-components ThemeProvider → 引入新依赖，与 antd 生态不匹配
- 多套 CSS 文件切换 → 维护成本高，无法动态预览

**理由:** antd 5.x 的 Design Token 系统原生支持主题切换，零额外依赖，且所有 antd 组件自动适配。

### Decision 2: 主题配置结构

内置 4 套主题：
1. **Light (默认)**: antd 默认浅色主题
2. **Dark**: `theme.darkAlgorithm`，暗色背景
3. **Blue Professional**: 浅色底 + 深蓝品牌色 (`colorPrimary: '#003eb3'`)
4. **Purple Vibrant**: 浅色底 + 紫色品牌色 (`colorPrimary: '#722ed1'`)

主题定义为 `ThemeConfig` 对象数组，存放在 `frontend/src/themes/` 目录。

### Decision 3: 主题持久化策略

**选择:** localStorage (`app-theme` key) + Zustand store

**理由:** 无后端存储需求，localStorage 简单可靠。Zustand 已在项目中使用，新增一个 theme store 与现有模式一致。

### Decision 4: 共享组件抽取策略

新增组件放在 `frontend/src/components/` 下：
- `PageHeader.tsx`: 接收 title、extra (操作按钮)、breadcrumb 等 props
- `ListToolbar.tsx`: 接收 searchProps、filters、extra 等 props
- `ThemeSwitcher.tsx`: 主题选择下拉组件，嵌入 AppLayout 顶栏

**不抽取为独立 npm 包**，保持为项目内组件。

### Decision 5: RunHistory 页面数据接入

复用已有的 `runsApi.list()` 接口，添加分页、搜索、状态过滤功能。Pipeline 名称通过 `pipeline_id` 关联显示。

## Risks / Trade-offs

- **[暗色主题下自定义样式不兼容]** → 逐页检查硬编码的 `style={{ color: '#xxx' }}` 和 `background`，替换为 antd token 或 CSS Variable。PipelineEditor 的 ReactFlow 节点样式需特别适配。
- **[主题切换性能]** → Ant Design 5.x 的 CSS-in-JS 方案在主题切换时会重新计算样式。对于当前页面规模（13个页面），性能影响可忽略。
- **[组件替换范围大]** → 需修改全部列表页。采用渐进式替换策略：先实现新组件 → 逐页替换 → 最后统一验证。
- **[React Flow 暗色适配]** → PipelineEditor 中 ReactFlow 有自己的主题系统，需单独适配 dark 模式的背景色和节点样式。
