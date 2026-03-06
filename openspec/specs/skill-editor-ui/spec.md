# Skill Editor UI Specification

## Purpose

Python Code Skill 的全页面编辑器，提供代码编写、Connection 绑定、依赖管理、在线测试等功能。新建和编辑模式共用同一页面。

### Requirement: 页面布局 [Phase 1 - 已实现]

#### Scenario: 左右分栏

- **WHEN** 用户访问 /skills/new 或 /skills/{id}/edit
- **THEN** 页面分为左右两栏:
  - 左栏: Skill 基本信息卡片 + 预加载导入折叠面板 + Monaco 代码编辑器
  - 右栏: Connection Mappings + Additional Requirements + Test Input + Test Output

#### Scenario: 顶部操作栏

- **THEN** 显示 Back 按钮、页面标题 ("New Python Skill" 或 "Edit: {name}")、Save 按钮
- **AND** 未保存修改时 Back 按钮弹出确认对话框
- **AND** 浏览器关闭/刷新时触发 beforeunload 警告

### Requirement: Skill 基本信息 [Phase 1 - 已实现]

#### Scenario: 新建模式

- **WHEN** isNew = true
- **THEN** name 输入框可编辑，description 可编辑

#### Scenario: 编辑模式

- **WHEN** isNew = false
- **THEN** name 输入框 disabled（只读），description 可编辑

### Requirement: 代码编辑器 [Phase 1 - 已实现]

#### Scenario: Monaco Editor 配置

- **THEN** 使用 @monaco-editor/react，language=python，高度 400px
- **AND** 关闭 minimap，行号显示，fontSize=13

#### Scenario: 预加载导入提示

- **WHEN** 加载页面时调用 GET /api/v1/skills/preloaded-imports
- **THEN** 在折叠面板中显示 standard_library 和 third_party 预装包列表（只读）

#### Scenario: 默认代码模板

- **WHEN** 新建 Skill
- **THEN** 编辑器预填默认 process(data, context) 函数模板

### Requirement: Connection Mappings [Phase 1 - 已实现]

#### Scenario: 添加连接映射

- **WHEN** 点击 "Add Connection" 按钮
- **THEN** 新增一行: Name 输入框 (如 "llm") + Connection 下拉选择 + 删除按钮
- **AND** Connection 下拉选项来自 GET /api/v1/connections，显示 "name (type)" 格式

#### Scenario: 保存映射

- **WHEN** 保存 Skill
- **THEN** connection_mappings 序列化为 {"name": "connection-id"} 格式

### Requirement: Additional Requirements [Phase 1 - 已实现]

#### Scenario: 输入额外依赖

- **THEN** TextArea 输入，每行一个 pip 包 (如 "beautifulsoup4==4.12.0")
- **AND** 保存时传递给 additional_requirements 字段

### Requirement: 在线测试 [Phase 1 - 已实现]

#### Scenario: Test Input 编辑

- **THEN** 使用 Monaco Editor (JSON, 200px)，预填 Azure Custom Skill 格式示例
- **AND** "Import from Pipeline Test Run" 按钮（Phase 2 占位，当前 disabled）

#### Scenario: 运行测试

- **WHEN** 点击 "Run Test"
- **THEN** 已保存 Skill 调用 POST /api/v1/skills/{id}/test
- **AND** 未保存 Skill 调用 POST /api/v1/skills/test-code

#### Scenario: 测试结果显示

- **THEN** 显示状态 Tag (Success / Errors / Timeout) + 执行耗时
- **AND** 每条 record 显示 recordId、data (成功, 绿色背景) 或 error + traceback (失败, Alert)
- **AND** 可折叠的 Logs 面板，按 level 着色 (ERROR=red, WARNING=orange, INFO=blue)

### Requirement: 保存逻辑 [Phase 1 - 已实现]

#### Scenario: 新建保存

- **WHEN** isNew 且点击 Save
- **THEN** 调用 POST /api/v1/skills 创建，成功后 navigate 到 /skills/{id}/edit (replace)

#### Scenario: 编辑保存

- **WHEN** 编辑模式且点击 Save
- **THEN** 调用 PUT /api/v1/skills/{id}，body 不包含 name

#### Scenario: 409 重名处理

- **WHEN** 创建时返回 409
- **THEN** message.error 显示 "Skill name already exists"
