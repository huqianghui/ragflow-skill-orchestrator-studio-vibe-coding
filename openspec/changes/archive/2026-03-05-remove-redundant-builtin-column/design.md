## Context

Skill Library 表格当前有 6 列：Name, Type, Description, Built-in, Created At, Actions。其中 Type 列显示 `builtin`/`web_api`/`config_template`/`python_code` 标签，Built-in 列显示 `Built-in`/`Custom` 标签。两者信息完全重复。

## Goals / Non-Goals

**Goals:**
- 移除 Built-in 列，减少冗余信息
- 更新 e2e 测试中引用 Built-in 列的选择器

**Non-Goals:**
- 不修改 Type 列的展示方式
- 不改变后端 `is_builtin` 字段

## Decisions

### Decision 1: 直接删除 Built-in 列

**选择**: 从 columns 数组中移除 Built-in 列定义

**理由**: Type 列已经有 `builtin` 标签（蓝色），能清楚区分内置和自定义 skill。删除后表格从 6 列变为 5 列，Description 列可以获得更多空间。

### Decision 2: e2e 测试选择器替换

**选择**: 将 `.ant-tag:has-text("Built-in")` 替换为 `.ant-tag:has-text("builtin")`（Type 列中的标签）

**理由**: 现有测试通过 Built-in 列的 tag 来定位 builtin skill 行，删除该列后需要改用 Type 列的 tag。

## Risks / Trade-offs

- **[信息丢失]** 无。Type 列已完整覆盖 builtin/custom 区分。
