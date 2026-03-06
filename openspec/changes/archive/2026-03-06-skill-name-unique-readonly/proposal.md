## Why

Skill 的 `name` 是用户在 UI 中识别 Skill 的唯一标识（`id` 为 UUID，用户不可见）。当前 `name` 没有 unique 约束，且编辑时允许修改 name，这会导致：1) 用户创建重名 Skill 造成混淆；2) 修改 name 后无法追溯历史引用。需要将 name 确立为业务层唯一键，并在编辑时禁止修改。

## What Changes

- **BREAKING**: 数据库 `skills.name` 列增加 `unique=True` 约束
- **BREAKING**: 后端 `SkillUpdate` schema 移除 `name` 字段，PUT API 不再接受 name 修改
- 后端 `SkillCreate` 增加重名校验，重名时返回 409 Conflict
- 前端编辑页面 name 字段设为只读（disabled）
- 前端创建时对重名返回的 409 错误给出友好提示
- 更新 Alembic migration 以包含 unique 约束

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `skills`: name 字段增加 unique 约束；更新 API 不再允许修改 name；创建 API 增加重名 409 响应
- `skill-library-ui`: 编辑表单中 name 字段变为只读；创建表单增加重名错误提示

## Impact

- **数据库**: skills 表 name 列增加 unique index，已有重名数据需先手动清理
- **后端 API**: PUT /api/v1/skills/{id} 不再接受 name 字段；POST /api/v1/skills 新增 409 响应码
- **前端**: SkillEditor 编辑模式 name 输入框 disabled；SkillLibrary 创建表单处理 409 错误
- **Alembic migration**: 需更新 init migration 或新增 migration 添加 unique 约束
