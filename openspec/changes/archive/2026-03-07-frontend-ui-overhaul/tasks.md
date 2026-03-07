## 1. Theme System Foundation

- [x] 1.1 Create `frontend/src/themes/` directory with theme definitions: Light、Dark、Blue Professional、Purple Vibrant 四套 ThemeConfig 对象
- [x] 1.2 Create Zustand theme store (`frontend/src/stores/themeStore.ts`): currentTheme state + setTheme action + localStorage persistence (`app-theme` key)
- [x] 1.3 Create `ThemeSwitcher` component (`frontend/src/components/ThemeSwitcher.tsx`): 下拉菜单展示 4 套主题，当前主题显示选中标记
- [x] 1.4 Integrate ConfigProvider in App root: wrap `<App />` with `<ConfigProvider theme={currentThemeConfig}>`，从 themeStore 读取当前主题
- [x] 1.5 Update AppLayout header: 在顶栏右侧集成 ThemeSwitcher 组件

## 2. Shared UI Components

- [x] 2.1 Create `PageHeader` component (`frontend/src/components/PageHeader.tsx`): 支持 title、extra、onBack props，统一 flex 布局和间距
- [x] 2.2 Create `ListToolbar` component (`frontend/src/components/ListToolbar.tsx`): 支持 searchPlaceholder、onSearch、filters、extra props，统一搜索/过滤区域布局

## 3. List Pages Refactor — Apply Shared Components

- [x] 3.1 Refactor SkillLibrary page: 使用 PageHeader + ListToolbar 替换手写头部和搜索栏
- [x] 3.2 Refactor Connections page: 使用 PageHeader + ListToolbar 替换手写头部和搜索栏
- [x] 3.3 Refactor Pipelines page: 使用 PageHeader + ListToolbar 替换手写头部和搜索栏
- [x] 3.4 Refactor DataSources page: 使用 PageHeader + ListToolbar 替换手写头部和搜索栏
- [x] 3.5 Refactor Targets page: 使用 PageHeader + ListToolbar 替换手写头部和搜索栏
- [x] 3.6 Refactor RunHistory page: 使用 PageHeader + ListToolbar，同时连接 `runsApi.list()` 加载真实数据，添加分页/搜索/状态过滤

## 4. Editor Pages Refactor

- [x] 4.1 Refactor SkillEditor page: 使用 PageHeader 替换手写头部（含 Back + Save 按钮）
- [x] 4.2 Refactor BuiltinSkillEditor page: 使用 PageHeader 替换手写头部
- [x] 4.3 Refactor PipelineEditor page: 保留全屏布局，主题适配在 5.4 中处理

## 5. Theme Adaptation — Fix Hardcoded Styles

- [x] 5.1 Audit and fix AppLayout: 替换硬编码的 `background: '#fff'`、`borderBottom` 等为 antd token 或 CSS Variable
- [x] 5.2 Audit and fix Dashboard: 替换 Card 内硬编码的 `color`、`background` 为 antd token
- [x] 5.3 Audit and fix TableUtils: 确保 ResizableTitle handle 和 OverflowPopover 在暗色主题下可见
- [x] 5.4 Audit and fix PipelineEditor: 适配 ReactFlow 画布的暗色背景、节点样式、面板样式
- [x] 5.5 Audit and fix SkillEditor / BuiltinSkillEditor: 替换 Monaco Editor、代码块、结果展示区的硬编码颜色
- [x] 5.6 Audit and fix DataSourceNew / TargetNew: 确保卡片选择页面的样式适配多主题
- [x] 5.7 Audit and fix Settings page: 确保 Progress 组件和 Descriptions 在暗色主题下显示正确

## 6. Verification

- [x] 6.1 Run `npx tsc -b` 确保无 TypeScript 编译错误
- [x] 6.2 Run `npm run build` 确保 Vite 构建通过
- [x] 6.3 Manual verification: 在 4 套主题下逐一打开所有 13 个页面，确认无视觉异常
