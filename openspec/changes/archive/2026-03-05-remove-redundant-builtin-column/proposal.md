## Why

Skill Library 表格中 Type 列和 Built-in 列展示了重复信息：`skill_type=builtin` 与 `is_builtin=true` 完全等价。Type 列已经通过标签颜色和文本区分了 builtin/web_api/config_template/python_code，Built-in 列是冗余的，浪费了表格横向空间。

## What Changes

- 移除 Skill Library 表格中的 Built-in 列
- 更新 e2e 测试中依赖 Built-in 列的选择器

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `skill-library-ui`: 移除 Built-in 列，相关排序和选择器需调整

## Impact

- `frontend/src/pages/SkillLibrary.tsx` — 删除 Built-in 列定义
- `e2e/skill-library.spec.ts` — 更新依赖 `.ant-tag:has-text("Built-in")` 的测试选择器
- 无后端改动
