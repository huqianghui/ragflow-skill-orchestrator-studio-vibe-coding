## MODIFIED Requirements

### Requirement: 创建 Skill

#### Scenario: 打开创建表单

- **WHEN** 点击 "New Skill" 按钮
- **THEN** 打开表单 Modal，字段:
  - name (必填, Input)
  - description (可选, TextArea)
  - skill_type (必填, Select: web_api / config_template / python_code)
  - config_schema (可选, TextArea, JSON 格式)

#### Scenario: 提交有效表单

- **WHEN** 填写所有必填字段并提交
- **THEN** 调用 POST /api/v1/skills，成功后刷新列表

#### Scenario: 创建重名 Skill 错误提示

- **WHEN** 提交的 name 与已有 Skill 重名
- **THEN** 后端返回 409 CONFLICT
- **AND** 前端通过 message.error() 显示 "Skill with name 'xxx' already exists"
- **AND** 表单保持打开，用户可修改 name 后重新提交

#### Scenario: config_schema JSON 校验

- **WHEN** config_schema 输入无效 JSON
- **THEN** 表单显示 "Invalid JSON format" 错误，阻止提交

### Requirement: 编辑 Skill

#### Scenario: 打开编辑表单

- **WHEN** 点击非 builtin Skill 的 Edit 按钮或名称
- **THEN** 打开预填当前值的编辑表单 Modal
- **AND** name 字段 SHALL 为 disabled（只读），不可修改

#### Scenario: 提交编辑

- **WHEN** 修改字段并提交
- **THEN** 调用 PUT /api/v1/skills/{id}，请求 body 中不包含 name 字段
- **AND** 成功后刷新列表
