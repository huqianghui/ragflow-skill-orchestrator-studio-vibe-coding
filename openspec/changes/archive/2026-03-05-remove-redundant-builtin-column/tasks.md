## 1. 移除 Built-in 列

- [x] 1.1 从 SkillLibrary.tsx 的 columns 数组中删除 Built-in 列定义
- [x] 1.2 确认 TypeScript 编译通过

## 2. 更新 e2e 测试

- [x] 2.1 将 e2e 测试中 `.ant-tag:has-text("Built-in")` 选择器替换为 `.ant-tag:has-text("builtin")`（Type 列标签）
- [x] 2.2 运行 Playwright e2e 测试确认全部通过

## 3. 验证

- [x] 3.1 截图验证表格布局正常，Built-in 列已移除
