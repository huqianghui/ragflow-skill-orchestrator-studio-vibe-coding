## ADDED Requirements

### Requirement: PageHeader component
系统 SHALL 提供统一的 `PageHeader` 组件，用于所有页面的头部标题区域。

#### Scenario: Basic page header with title
- **WHEN** 页面渲染 `<PageHeader title="Skill Library" />`
- **THEN** 显示 `<Typography.Title level={3}>` 样式的标题，margin-bottom 为 16px

#### Scenario: Page header with action buttons
- **WHEN** 页面渲染 `<PageHeader title="Pipelines" extra={<Button>New Pipeline</Button>} />`
- **THEN** 标题左对齐，操作按钮右对齐，垂直居中

#### Scenario: Page header with back button
- **WHEN** 页面渲染 `<PageHeader title="Edit Skill" onBack={() => navigate('/skills')} />`
- **THEN** 标题左侧显示返回箭头按钮，点击触发 onBack 回调

### Requirement: PageHeader replaces inline headers
所有列表页和编辑页 MUST 使用 `PageHeader` 组件替换手写的 flex 布局头部。

#### Scenario: Consistent header across list pages
- **WHEN** 用户依次访问 SkillLibrary、Connections、Pipelines、DataSources、Targets 页面
- **THEN** 每个页面的标题区域有统一的视觉样式和间距

#### Scenario: Consistent header across editor pages
- **WHEN** 用户访问 SkillEditor、BuiltinSkillEditor、PipelineEditor 页面
- **THEN** 每个编辑器的标题区域使用统一的 PageHeader 样式（含返回按钮和操作按钮）
