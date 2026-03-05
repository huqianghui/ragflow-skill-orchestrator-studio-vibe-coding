## MODIFIED Requirements

### Requirement: Skill CRUD 操作

用户可以创建、读取、更新、删除自定义 Skill。内置 Skill（`is_builtin = True`）不可被删除。

#### Scenario: 列出所有 Skill
- **WHEN** 用户请求 `GET /api/v1/skills`
- **THEN** 系统返回所有 Skill 列表（含内置和自定义）
- **AND** 支持按类型、名称筛选
- **AND** 支持分页

#### Scenario: 删除自定义 Skill
- **WHEN** 用户请求删除一个 `is_builtin = False` 的 Skill
- **THEN** 系统删除该 Skill 并返回 204

#### Scenario: 尝试删除内置 Skill
- **WHEN** 用户请求删除一个 `is_builtin = True` 的 Skill
- **THEN** 系统 SHALL 返回 HTTP 403 Forbidden
- **AND** 响应体包含错误信息 "Built-in skills cannot be deleted"

#### Scenario: 更新内置 Skill
- **WHEN** 用户请求更新一个 `is_builtin = True` 的 Skill
- **THEN** 系统 SHALL 返回 HTTP 403 Forbidden
- **AND** 响应体包含错误信息 "Built-in skills cannot be modified"
