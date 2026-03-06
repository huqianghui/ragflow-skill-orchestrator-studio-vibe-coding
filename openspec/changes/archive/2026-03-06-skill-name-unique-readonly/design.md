## Context

当前 Skill 模型使用 UUID `id` 作为主键，`name` 字段仅有普通索引（无 unique 约束）。`SkillUpdate` schema 包含 `name` 字段，允许通过 PUT API 修改名称。前端编辑页面也允许自由编辑 name。

Connection 模型已经对 `name` 设置了 `unique=True`（`connection.py:10`），Skill 应保持一致的业务约定。

## Goals / Non-Goals

**Goals:**
- 在数据库层面确保 `skills.name` 唯一
- 禁止通过 API 修改已有 Skill 的 name
- 创建 Skill 时检测重名并返回明确错误
- 前端编辑时 name 字段只读，创建时展示重名错误

**Non-Goals:**
- 不做 name 的格式校验（如强制 kebab-case），保持现有行为
- 不影响内置 Skill seeder 逻辑（seeder 已按 name 匹配，天然兼容）
- 不做 Skill rename 迁移工具

## Decisions

### 1. 数据库约束方式

**选择**: 在 SQLAlchemy model 中设置 `unique=True`，同时更新 Alembic init migration。

**理由**: 与 Connection 模型保持一致。数据库层面的 unique 约束是最终防线，即使绕过 API 直接操作数据库也能保证一致性。

**替代方案**: 仅在 API 层做查重 → 存在并发竞态条件，不够可靠。

### 2. API 层重名检测

**选择**: 在 `create_skill` handler 中先查询 `Skill.name == body.name`，若存在则返回 409 Conflict，message 为 `"Skill with name '{name}' already exists"`。

**理由**: 409 是 HTTP 语义上最准确的状态码（资源冲突）。同时兜底：若并发写入绕过了 API 检查，数据库 unique 约束会抛出 IntegrityError，catch 后同样返回 409。

### 3. 更新 API 移除 name

**选择**: 从 `SkillUpdate` schema 中删除 `name` 字段。API 接收到 name 字段时自动忽略（Pydantic `model_fields` 不包含 name）。

**理由**: 比 "接受但报错" 更简洁。前端无需发送 name，后端也不需要额外校验逻辑。

**替代方案**: 保留 name 字段但在 handler 中检查是否修改并报错 → 增加不必要的复杂度。

### 4. 前端处理

**选择**: 编辑模式下 name 输入框设置 `disabled`；创建模式下 catch 409 错误并通过 `message.error()` 展示 "Skill name already exists"。

**理由**: disabled 而非隐藏——用户仍需看到当前 Skill 名称以确认编辑对象。

## Risks / Trade-offs

- **[已有重名数据]** → 加 unique 约束前若已有重名 Skill，migration 会失败。Mitigation: 这是新项目，数据量极少，手动清理即可；在 migration 注释中说明。
- **[Breaking API change]** → PUT 不再接受 name 字段。Mitigation: 目前无外部 API 消费者，仅前端使用；前端同步修改即可。
