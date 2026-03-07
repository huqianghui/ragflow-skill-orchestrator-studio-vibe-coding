## ADDED Requirements

### Requirement: ListToolbar component
系统 SHALL 提供统一的 `ListToolbar` 组件，用于所有列表页的搜索/过滤区域。

#### Scenario: Basic search toolbar
- **WHEN** 页面渲染 `<ListToolbar searchPlaceholder="Search by name" onSearch={setSearchText} />`
- **THEN** 显示一个宽度 300px 的 Input.Search 组件，支持 allowClear 和 onSearch 回调

#### Scenario: Toolbar with filters
- **WHEN** 页面渲染带有 `filters` prop 的 ListToolbar
- **THEN** 搜索框后方显示筛选下拉框（Select），支持 mode="multiple"

#### Scenario: Toolbar with extra actions
- **WHEN** 页面渲染带有 `extra` prop 的 ListToolbar
- **THEN** 在搜索栏右侧显示额外的操作元素

### Requirement: ListToolbar replaces inline toolbars
所有列表页 MUST 使用 `ListToolbar` 组件替换手写的 `<Space style={{ marginBottom: 16 }}>` + `Input.Search` 组合。

#### Scenario: Consistent toolbar across all list pages
- **WHEN** 用户查看 SkillLibrary、Connections、Pipelines、DataSources、Targets、RunHistory 页面
- **THEN** 每个列表页的搜索/过滤区域有统一的布局、间距和交互模式

### Requirement: ListToolbar styling
ListToolbar MUST 在不同主题下保持良好的视觉效果。

#### Scenario: Toolbar in dark theme
- **WHEN** 用户切换到 Dark 主题
- **THEN** ListToolbar 中的搜索框和过滤器自动适配暗色样式
