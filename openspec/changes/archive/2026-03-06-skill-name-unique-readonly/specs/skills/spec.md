## MODIFIED Requirements

### Requirement: Skill Data Model

#### Scenario: Skill 字段结构

- **GIVEN** 数据库中存在一个 Skill 记录
- **THEN** 该 Skill 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符, **唯一约束**)
  - skill_type (builtin | web_api | config_template | python_code)
  - description (功能描述, 可选)
  - config_schema (JSON 对象, 类型相关的配置参数 JSON Schema)
  - is_builtin (布尔值, 是否为内置 Skill)
  - created_at / updated_at (时间戳, 自动生成)
  - [Phase 2 计划字段]:
    - input_schema (JSON Schema 定义输入)
    - output_schema (JSON Schema 定义输出)
    - version (版本号)

### Requirement: Skill CRUD 操作

用户可以创建、读取、更新、删除 Skill。内置 Skill 不可更新。Skill name 创建后不可修改。

#### Scenario: 创建自定义 Skill

- **WHEN** POST /api/v1/skills，body 包含:
  - name (必填)
  - skill_type (必填, web_api | config_template | python_code)
  - description (可选)
  - config_schema (可选, 默认 {})
- **THEN** 系统创建 Skill 并返回 201 + 完整 Skill 对象

#### Scenario: 创建重名 Skill 被拒绝

- **GIVEN** 数据库中已存在 name 为 "my-skill" 的 Skill
- **WHEN** POST /api/v1/skills，body 中 name 为 "my-skill"
- **THEN** 返回 409 CONFLICT，message 为 "Skill with name 'my-skill' already exists"

#### Scenario: 列出所有 Skill（分页）

- **WHEN** GET /api/v1/skills?page=1&page_size=10
- **THEN** 返回分页响应，含 items / total / page / page_size / total_pages
- **AND** 按 created_at 倒序排列

#### Scenario: 获取 Skill 详情

- **WHEN** GET /api/v1/skills/{id}
- **THEN** 返回完整 Skill 对象
- **AND** 若不存在返回 404 NOT_FOUND

#### Scenario: 更新自定义 Skill（name 不可修改）

- **GIVEN** 一个 is_builtin=false 的 Skill
- **WHEN** PUT /api/v1/skills/{id}，body 含需更新的字段
- **THEN** 系统更新并返回更新后的 Skill 对象
- **AND** body 中的 name 字段 SHALL 被忽略（SkillUpdate schema 不包含 name）

#### Scenario: 更新内置 Skill 被拒绝

- **GIVEN** 一个 is_builtin=true 的 Skill
- **WHEN** PUT /api/v1/skills/{id}
- **THEN** 返回 403 FORBIDDEN "Built-in skills cannot be modified"

#### Scenario: 删除 Skill

- **WHEN** DELETE /api/v1/skills/{id}
- **THEN** 系统删除该 Skill 并返回 204
- **AND** 若不存在返回 404 NOT_FOUND

#### Scenario: 删除内置 Skill

- **GIVEN** 一个 is_builtin=true 的 Skill
- **WHEN** DELETE /api/v1/skills/{id}
- **THEN** 系统删除该 Skill 并返回 204
- **AND** skill_seeder 会在应用重启时重新创建缺失的内置 Skill
