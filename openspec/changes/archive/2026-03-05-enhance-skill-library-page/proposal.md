## Why

Skill Library 页面当前功能过于基础，仅提供简单的表格列表和删除操作。用户无法排序、无法查看技能详情、无法新增自定义技能，且 built-in 技能缺少直观的图标标识。这些不足严重影响了日常使用体验和管理效率。

## What Changes

- **列排序**: 表格所有关键列（名称、类型、创建时间等）支持点击排序
- **技能图标**: 根据 skill_type 为每个技能展示对应的图标，提升视觉辨识度
- **Built-in 技能可删除**: 移除后端对 built-in 技能删除的限制，前端增加二次确认弹窗（警告删除后可通过重启恢复）
- **技能详情查看**: 点击技能名称或操作按钮可查看完整的技能信息（描述、config_schema、元数据等）
- **新增技能功能**: "New Skill" 按钮打开表单弹窗，支持填写名称、描述、类型、配置 schema 来创建自定义技能
- **搜索与筛选**: 添加关键词搜索和按类型筛选功能
- **编辑技能**: 自定义技能支持编辑功能

## Capabilities

### New Capabilities
- `skill-library-ui`: Skill Library 页面的前端增强功能，包括排序、图标、搜索筛选、详情查看、新增/编辑表单

### Modified Capabilities
- `skills`: 修改 built-in 技能删除限制，允许删除 built-in 技能（重启后会重新 seed）

## Impact

- **Frontend**: `frontend/src/pages/SkillLibrary.tsx` 重构，新增详情弹窗和表单组件
- **Frontend**: `frontend/src/types/index.ts` 可能需要扩展类型定义
- **Backend**: `backend/app/api/skills.py` 删除接口移除 is_builtin 限制，可能增加排序/搜索参数
- **Backend**: `backend/app/services/skill_seeder.py` 无需修改（重启自动 seed 缺失的 built-in 技能）
