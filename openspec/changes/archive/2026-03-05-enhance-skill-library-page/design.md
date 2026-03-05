## Context

Skill Library 页面 (`SkillLibrary.tsx`) 当前使用 Ant Design Table 展示技能列表，仅支持分页。后端 API (`/api/v1/skills`) 提供标准 CRUD 接口，但对 built-in 技能的编辑和删除有 403 限制。前端已有 `skillsApi.create`、`skillsApi.get` 等方法但未被页面使用。

技术栈: React 19 + TypeScript + Ant Design 6 + Vite (前端), FastAPI + SQLAlchemy async + SQLite (后端)。

## Goals / Non-Goals

**Goals:**
- 表格列支持客户端排序（利用 Ant Design Table 内置 sorter）
- 每种 skill_type 有对应图标，提升辨识度
- 允许删除 built-in 技能（后端移除限制，前端增加确认弹窗）
- 技能详情弹窗查看完整信息（config_schema JSON 展示）
- 新增技能表单弹窗（Modal + Form）
- 编辑自定义技能的表单弹窗
- 搜索框 + 类型筛选下拉

**Non-Goals:**
- 不做服务端排序（数据量小，客户端排序足够）
- 不做技能导入/导出功能
- 不修改 skill_seeder 逻辑
- 不做技能版本管理

## Decisions

### 1. 客户端排序 vs 服务端排序
**选择**: 客户端排序
**原因**: 技能数量预计 <100，Ant Design Table 原生支持 `sorter` 属性，无需后端改动。若后续数据量增大，可切换为服务端排序。

### 2. 技能图标方案
**选择**: 使用 Ant Design Icons，按 skill_type 映射固定图标
**映射**:
- `builtin` → `ToolOutlined`
- `web_api` → `ApiOutlined`
- `config_template` → `SettingOutlined`
- `python_code` → `CodeOutlined`

**原因**: 无需引入额外图标库，与现有 UI 风格一致。

### 3. Built-in 技能删除策略
**选择**: 后端移除 is_builtin 删除限制 + 前端 Popconfirm 二次确认
**确认提示**: 警告用户 "此为内置技能，删除后重启应用会自动恢复"
**原因**: skill_seeder 在启动时会检查缺失的 built-in 技能并重新创建，所以删除是安全可逆的。

### 4. 详情/新增/编辑 UI 模式
**选择**: Modal 弹窗（非路由页面）
**原因**: 操作轻量，无需离开列表页。详情用 Descriptions 组件展示，config_schema 用 JSON 高亮展示。新增/编辑共用同一个 Form 弹窗。

### 5. 搜索筛选方案
**选择**: 前端筛选（获取全量数据后本地过滤）
**替代方案**: 后端增加 search/filter 参数
**原因**: 数据量小时前端筛选更快捷，避免后端改动。搜索框匹配 name 和 description，类型筛选用 Select 下拉。

## Risks / Trade-offs

- **[数据量增大后前端排序/筛选性能下降]** → 届时迁移为服务端排序和搜索，API 已预留分页参数扩展空间
- **[删除 built-in 技能可能影响正在使用该技能的 pipeline]** → 详情弹窗中可展示关联信息（v2 考虑），当前通过确认弹窗警告用户
- **[config_schema JSON 编辑器体验不佳]** → 初期使用 Ant Design Input.TextArea + JSON 校验，后续可引入 Monaco Editor
