## MODIFIED Requirements

### Requirement: SkillLibrary uses shared components
SkillLibrary 页面 MUST 使用 PageHeader 和 ListToolbar 共享组件替换内联的页面头部和搜索栏。

#### Scenario: PageHeader integration
- **WHEN** 用户访问 Skill Library 页面
- **THEN** 页面标题 "Skill Library" 和 "New Python Skill" / "New Skill" 按钮通过 PageHeader 组件渲染

#### Scenario: ListToolbar integration
- **WHEN** 用户在 Skill Library 页面查看搜索/过滤区域
- **THEN** 搜索框和 "Filter by type" 下拉通过 ListToolbar 组件渲染，布局与其他列表页一致
