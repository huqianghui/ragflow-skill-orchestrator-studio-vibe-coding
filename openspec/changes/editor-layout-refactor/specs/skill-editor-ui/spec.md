## MODIFIED Requirements

### Requirement: 页面布局 [Phase 1 - 已实现]

#### Scenario: 左右分栏

- **WHEN** 用户访问 /skills/new 或 /skills/{id}/edit
- **THEN** 页面分为左右两栏:
  - 左栏: Skill 基本信息卡片 + 预加载导入折叠面板 + Monaco 代码编辑器
  - 右栏: Accordion 折叠面板，包含以下 section（手风琴模式，同时只展开一个）:
    1. Connection Mappings
    2. Additional Requirements
    3. Test Input & Output
    4. Agent Assistant

#### Scenario: 顶部操作栏

- **THEN** 显示 Back 按钮、页面标题 ("New Python Skill" 或 "Edit: {name}")、Agent 按钮、Save 按钮
- **AND** Agent 按钮点击时展开右侧 Agent Assistant section
- **AND** 未保存修改时 Back 按钮弹出确认对话框
- **AND** 浏览器关闭/刷新时触发 beforeunload 警告

## REMOVED Requirements

### Requirement: Agent Drawer 浮层

**Reason**: Agent Assistant 改为右侧 Accordion 面板中的一个 section，不再使用 Drawer 浮层覆盖
**Migration**: Agent 按钮改为控制 Accordion activeKey，AgentChatWidget 直接渲染在 Collapse.Panel 中
