## REMOVED Requirements

### Requirement: Built-in column display
**Reason**: Built-in 列与 Type 列信息重复（`skill_type=builtin` 等价于 `is_builtin=true`），属于冗余列。
**Migration**: 通过 Type 列的 `builtin` 标签区分内置和自定义 skill。
