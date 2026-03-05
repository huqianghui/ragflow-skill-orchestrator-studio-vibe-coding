# Skill Library UI Specification

## Purpose

Skill Library 前端页面的交互规格，包括表格展示、排序、列拖拽、图标、详情查看、创建/编辑表单、删除确认、搜索和筛选。

### Requirement: Table display and pagination

Skill Library 表格默认分页展示所有 Skill（含内置和自定义），支持配置每页条数。

#### Scenario: Default pagination

- **WHEN** 用户首次打开 Skill Library 页面
- **THEN** 表格默认每页显示 10 条数据
- **AND** 分页选项为 [10, 20, 50, 100]
- **AND** 页脚显示总条数

#### Scenario: Name column as clickable link

- **WHEN** 表格渲染每一行
- **THEN** Name 列显示为蓝色链接样式（带 Skill 图标）
- **AND** 点击 builtin skill 名称打开 Detail Modal（只读）
- **AND** 点击 custom skill 名称打开 Edit Form Modal（可编辑）

#### Scenario: Description column overflow popover

- **WHEN** Description 文本溢出列宽
- **THEN** 鼠标 hover 0.5s 后弹出 Popover（纯文本，maxWidth 400px）
- **AND** Description 未溢出时不弹出 Popover

#### Scenario: Actions column

- **WHEN** 表格渲染每一行
- **THEN** Actions 列显示 View、Edit、Delete 按钮
- **AND** builtin skill 的 Edit 按钮保持 disabled

### Requirement: Table column sorting

Skill Library 表格支持客户端排序，点击列头在升序、降序、无排序之间切换。

#### Scenario: Sort by name ascending

- **WHEN** 用户点击 "Name" 列头一次
- **THEN** 表格按名称升序排列

#### Scenario: Sort by name descending

- **WHEN** 用户点击 "Name" 列头两次
- **THEN** 表格按名称降序排列

#### Scenario: Clear sort

- **WHEN** 用户点击 "Name" 列头第三次
- **THEN** 排序清除，恢复默认顺序

### Requirement: Resizable table columns

Name 和 Description 列支持拖拽调整宽度，基于 react-resizable 实现，其他列保持固定宽度。

#### Scenario: Drag Description column wider

- **WHEN** 用户向右拖拽 Description 列头右边框
- **THEN** Description 列宽度相应增加
- **AND** 表格布局不被破坏

#### Scenario: Name column minimum width

- **WHEN** 用户尝试将 Name 列拖拽到小于 100px
- **THEN** 列宽停止在 100px，不再缩小

#### Scenario: Description column minimum width

- **WHEN** 用户尝试将 Description 列拖拽到小于 150px
- **THEN** 列宽停止在 150px，不再缩小

#### Scenario: Non-resizable columns

- **WHEN** 用户 hover Type、Created At 或 Actions 列头
- **THEN** 不出现拖拽手柄，列宽保持固定

### Requirement: Skill type icon display

每行 Skill 在 Name 列和 Type 列显示对应的图标。图标映射: builtin → ToolOutlined, web_api → ApiOutlined, config_template → SettingOutlined, python_code → CodeOutlined。内置 Skill 还有按名称的专属图标。

#### Scenario: Display icon for builtin skill

- **WHEN** 渲染 skill_type 为 "builtin" 的 Skill
- **THEN** Type 列的 Tag 中显示 ToolOutlined 图标

#### Scenario: Display icon for web_api skill

- **WHEN** 渲染 skill_type 为 "web_api" 的 Skill
- **THEN** Type 列的 Tag 中显示 ApiOutlined 图标

### Requirement: Skill detail view

用户可以在 Modal 中查看任意 Skill 的完整详情，包括 name、description、skill_type、is_builtin、config_schema（格式化 JSON）、created_at、updated_at。

#### Scenario: Open skill detail modal

- **WHEN** 用户点击某行的 "View" 按钮
- **THEN** 打开标题为 "Skill Details" 的 Modal，显示所有字段

#### Scenario: Close skill detail modal

- **WHEN** 用户点击关闭按钮或 Modal 外部
- **THEN** Modal 关闭

### Requirement: Create new skill

用户可以通过 Modal 表单创建新的自定义 Skill，表单包含 name（必填）、description、skill_type（选择 web_api/config_template/python_code）、config_schema（JSON 文本）。

#### Scenario: Open create skill form

- **WHEN** 用户点击 "New Skill" 按钮
- **THEN** 打开 Skill 创建表单 Modal

#### Scenario: Submit valid skill

- **WHEN** 用户填写所有必填字段并提交
- **THEN** 调用 POST /api/v1/skills，成功后刷新列表

#### Scenario: Submit invalid JSON in config_schema

- **WHEN** 用户在 config_schema 输入无效 JSON 并提交
- **THEN** 表单显示 "Invalid JSON format" 验证错误，不提交

### Requirement: Edit custom skill

用户可以通过预填当前值的 Modal 表单编辑非 builtin Skill。

#### Scenario: Open edit form for custom skill

- **WHEN** 用户点击非 builtin Skill 的 "Edit" 按钮
- **THEN** 打开预填当前值的编辑表单 Modal

#### Scenario: Edit button disabled for builtin skill

- **WHEN** 渲染 builtin Skill 行
- **THEN** "Edit" 按钮为 disabled 状态

#### Scenario: Submit edit successfully

- **WHEN** 用户修改字段并提交
- **THEN** 调用 PUT /api/v1/skills/{id}，成功后刷新列表

### Requirement: Delete skill confirmation

删除 Skill 时通过 Popconfirm 确认，builtin Skill 和自定义 Skill 显示不同的提示信息。

#### Scenario: Delete builtin skill warning

- **WHEN** 用户点击 builtin Skill 的 "Delete" 按钮
- **THEN** Popconfirm 显示 "This is a built-in skill. It will be re-created on next application restart. Continue?"
- **AND** 确认后调用 DELETE API 并刷新列表

#### Scenario: Delete custom skill confirmation

- **WHEN** 用户点击自定义 Skill 的 "Delete" 按钮
- **THEN** Popconfirm 显示 "Are you sure you want to delete this skill?"
- **AND** 确认后调用 DELETE API 并刷新列表

### Requirement: Search and filter

页面提供搜索框和类型筛选下拉，搜索匹配 name 和 description，类型筛选支持多选。

#### Scenario: Search by keyword

- **WHEN** 用户在搜索框输入 "document"
- **THEN** 仅显示 name 或 description 包含 "document"（不区分大小写）的 Skill

#### Scenario: Filter by type

- **WHEN** 用户在类型筛选中选择 "builtin"
- **THEN** 仅显示 skill_type 为 "builtin" 的 Skill

#### Scenario: Combined search and filter

- **WHEN** 用户同时输入关键词和选择类型
- **THEN** 仅显示同时满足两个条件的 Skill

#### Scenario: Clear filters

- **WHEN** 用户清空搜索框和类型筛选
- **THEN** 显示所有 Skill
