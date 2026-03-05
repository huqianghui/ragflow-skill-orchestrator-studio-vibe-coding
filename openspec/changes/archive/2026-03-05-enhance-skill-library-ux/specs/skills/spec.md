## MODIFIED Requirements

### Requirement: 列出所有 Skill

用户可以在 Skill Library 页面浏览所有 Skill，支持分页、搜索和筛选。

#### Scenario: 默认分页为每页 10 条
- **WHEN** 用户首次打开 Skill Library 页面
- **THEN** 表格 SHALL 默认每页显示 10 条数据
- **AND** 分页选项 SHALL 为 `[10, 20, 50, 100]`

#### Scenario: 点击 built-in skill 名称打开只读详情
- **WHEN** 用户点击一个 `is_builtin=true` 的 skill 名称链接
- **THEN** 系统 SHALL 打开 Detail Modal 展示该 skill 的只读详情

#### Scenario: 点击 custom skill 名称打开编辑表单
- **WHEN** 用户点击一个 `is_builtin=false` 的 skill 名称链接
- **THEN** 系统 SHALL 打开 Edit Form Modal 允许用户编辑该 skill

#### Scenario: Name 列显示为可点击的链接样式
- **WHEN** Skill Library 表格渲染 Name 列
- **THEN** 每个 skill 名称 SHALL 显示为蓝色链接样式（带图标）

#### Scenario: Description 列 hover 时仅溢出文本弹出 Popover
- **WHEN** 用户将鼠标悬停在一个被截断的 Description 单元格上超过 0.5 秒
- **THEN** 系统 SHALL 显示一个 Popover 卡片展示完整的 Description 纯文本
- **AND** Popover 最大宽度 SHALL 为 400px

#### Scenario: Description 未溢出时不弹出 Popover
- **WHEN** 用户将鼠标悬停在一个未被截断的 Description 单元格上
- **THEN** 系统 SHALL NOT 显示 Popover

#### Scenario: Actions 列保留 View 和 Edit 按钮
- **WHEN** Skill Library 表格渲染 Actions 列
- **THEN** 每行 SHALL 保留 View、Edit、Delete 按钮
- **AND** built-in skill 的 Edit 按钮 SHALL 保持 disabled 状态
