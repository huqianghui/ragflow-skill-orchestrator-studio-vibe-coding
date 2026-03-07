## Why

当前前端 UI 存在多处不一致和体验短板：各列表页的搜索/过滤/分页模式不统一，页面头部布局缺乏标准化，RunHistory 页面是空壳（硬编码空数组、无数据加载），缺少全局主题切换能力，AppLayout 侧边栏与顶栏样式单一。用户希望能自由切换多套主题风格，同时各页面体验应保持一致、专业。

## What Changes

- **多主题系统**: 引入 Ant Design 的 ConfigProvider + CSS Variable 主题方案，内置 3-4 套可切换主题（默认浅色、暗色、蓝色专业、紫色活力），用户可在顶栏或 Settings 页面一键切换，选择持久化到 localStorage
- **页面头部标准化**: 抽取统一的 `PageHeader` 组件，统一标题 + 操作按钮 + 面包屑的布局模式，替换各页面手写的 `<div style={{ display: 'flex', justifyContent: 'space-between' }}>` 模式
- **列表页搜索/过滤栏标准化**: 抽取统一的 `ListToolbar` 组件，统一搜索框 + 筛选器 + 操作按钮的布局，替换各页面重复的 `Input.Search` + `Select` 组合
- **RunHistory 页面激活**: 连接真实 API，加载运行历史数据，添加搜索/过滤/分页、状态标签渲染、Pipeline 名称显示
- **AppLayout 增强**: 顶栏增加主题切换器入口，侧边栏适配多主题样式
- **全局加载/空状态统一**: 统一各页面的 loading spinner 和空数据状态展示模式

## Capabilities

### New Capabilities
- `theme-system`: 多主题切换系统 — 主题定义、切换器组件、持久化存储、Ant Design ConfigProvider 集成
- `page-header-component`: 统一的页面头部组件 — 标题、操作按钮、面包屑标准化布局
- `list-toolbar-component`: 统一的列表工具栏组件 — 搜索、筛选、批量操作标准化布局

### Modified Capabilities
- `unified-table-ui`: 增加与新主题系统的集成，确保表格组件适配多主题
- `skill-library-ui`: 使用新的 PageHeader 和 ListToolbar 组件重构页面头部和工具栏
- `pipeline-editor-ui`: 适配多主题配色（节点、边、背景色等）

## Impact

- **前端代码**: 新增 3 个共享组件（ThemeSwitcher、PageHeader、ListToolbar），修改全部 13 个页面组件适配新组件和主题
- **AppLayout**: 结构调整，集成 ConfigProvider 和主题切换器
- **Dependencies**: 可能新增 `@ant-design/cssinjs`（Ant Design 5.x CSS-in-JS 主题引擎），视当前 antd 版本而定
- **localStorage**: 新增 `app-theme` key 用于持久化主题选择
- **无后端变更**: 本次变更纯前端，不涉及 API 或数据库修改
