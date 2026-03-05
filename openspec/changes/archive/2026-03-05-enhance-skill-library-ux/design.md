## Context

Skill Library 页面 (`frontend/src/pages/SkillLibrary.tsx`) 使用 Ant Design Table 展示 skill 列表。当前存在以下体验问题：

1. 默认每页 50 条，数据量大时滚动成本高
2. Name 列只是纯文本，用户必须到 Actions 列操作 View/Edit
3. Description 列使用 `ellipsis: true` 截断，但截断后无法查看完整内容
4. 列宽固定，不同分辨率设备上 Description 可能过窄或浪费空间

现有技术栈：React 19 + Ant Design 6 + TypeScript + Vite

## Goals / Non-Goals

**Goals:**
- 将默认分页调整为 10 条，提供 `[10, 20, 50, 100]` 选项
- Name 列可点击：builtin skill → Detail Modal（只读），custom skill → Edit Form Modal
- Description 列和 Name 列支持拖拽调整宽度
- Description 列 hover 时，仅在文本溢出情况下以 Popover 展示完整内容

**Non-Goals:**
- 不改变后端 API 或数据模型
- 不重构表格为卡片视图或其他布局
- 不对其他页面的表格做同样改动（本次仅 Skill Library）

## Decisions

### Decision 1: 列拖拽使用 react-resizable

**选择**: 使用 `react-resizable` 库实现列宽拖拽

**替代方案**:
- 纯 CSS resize — 体验差，无法精确控制拖拽手柄位置
- 自写拖拽逻辑 — 开发成本高，兼容性不确定

**理由**: `react-resizable` 是 Ant Design 官方文档推荐方案，体积小（~10KB），API 简洁。通过自定义 `components.header.cell` 实现，与 Ant Design Table 集成度高。

**实现方式**:
- 自定义 `ResizableTitle` 组件替换默认表头 cell
- 使用 `useState` 管理列宽状态
- 仅 Name（初始 160px）和 Description（初始 350px）列可拖拽，设置 `minWidth` 防止拖太窄

### Decision 2: Description Popover 仅溢出时触发

**选择**: 检测文本是否溢出（`scrollWidth > clientWidth`），仅溢出时显示 Popover

**替代方案**:
- 始终显示 Tooltip — 短文本时多余，影响体验
- 使用 Ant Design 的 `ellipsis.showTitle` — 只支持原生 title，不支持 Popover 样式

**理由**: 需要自定义渲染 Description cell，通过 `useRef` + `useEffect` 或 `onMouseEnter` 时动态检测溢出。使用 Ant Design `Popover` 组件，`trigger="hover"`，`mouseEnterDelay={0.5}` 实现延迟。Popover 内容为纯文本，`maxWidth: 400px`，`wordBreak: break-word`。

### Decision 3: Name 列 link 的点击行为

**选择**: Name 渲染为 `<a>` 样式（Ant Design Typography.Link），点击时根据 `is_builtin` 分流

**行为**:
- `is_builtin === true` → 调用 `setDetailSkill(record)`，打开现有的 Detail Modal
- `is_builtin === false` → 调用 `openEditForm(record)`，打开现有的 Edit Form Modal
- Actions 列的 View / Edit 按钮保留不变，作为冗余入口

### Decision 4: 可拖拽列的初始宽度分配

| 列 | 初始宽度 | 可拖拽 | minWidth |
|----|----------|--------|----------|
| Name | 160px | 是 | 100px |
| Type | 100px | 否 | — |
| Description | 350px | 是 | 150px |
| Built-in | 90px | 否 | — |
| Created At | 160px | 否 | — |
| Actions | 180px | 否 | — |

## Risks / Trade-offs

- **[新依赖]** 引入 `react-resizable` 增加了依赖。→ 该库成熟稳定（npm 周下载 >1M），维护良好，风险低。
- **[溢出检测时机]** `onMouseEnter` 时检测溢出有微小性能开销。→ 单次 DOM 属性读取，可忽略。
- **[拖拽与排序交互]** 列头既有排序点击又有拖拽手柄，需确保不冲突。→ 拖拽手柄放在列头右侧边缘，排序点击区域在列头中间，互不干扰。
