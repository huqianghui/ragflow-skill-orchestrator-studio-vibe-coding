## 1. Backend: 移除 Built-in 技能删除限制

- [x] 1.1 修改 `backend/app/api/skills.py` 的 `delete_skill` 端点，移除 `is_builtin` 检查，允许删除所有技能
- [x] 1.2 编写/更新后端测试验证 built-in 技能可被成功删除

## 2. Frontend: 表格排序与图标

- [x] 2.1 为 Name、Type、Built-in、Created At 列添加 Ant Design Table `sorter` 属性实现客户端排序
- [x] 2.2 创建 skill_type 图标映射（ToolOutlined、ApiOutlined、SettingOutlined、CodeOutlined），在 Type 列 Tag 前显示图标
- [x] 2.3 在 Skill 类型或 Table columns 中添加 `created_at` 列展示

## 3. Frontend: 搜索与筛选

- [x] 3.1 在表格上方添加搜索输入框（Input.Search），支持按 name 和 description 模糊匹配
- [x] 3.2 添加 skill_type 筛选下拉框（Select），支持多选过滤
- [x] 3.3 实现前端过滤逻辑，搜索和类型筛选可组合使用

## 4. Frontend: 技能详情弹窗

- [x] 4.1 创建 SkillDetailModal 组件，使用 Ant Design Modal + Descriptions 展示技能完整信息
- [x] 4.2 config_schema 使用 `<pre>` + `JSON.stringify` 格式化展示
- [x] 4.3 在表格 Actions 列添加 "View" 按钮，点击打开详情弹窗

## 5. Frontend: 新增/编辑技能表单

- [x] 5.1 创建 SkillFormModal 组件（Modal + Form），包含 name、description、skill_type（Select）、config_schema（TextArea + JSON 校验）字段
- [x] 5.2 "New Skill" 按钮连接到表单弹窗，提交后调用 `skillsApi.create` 并刷新列表
- [x] 5.3 "Edit" 按钮连接到同一表单弹窗（预填数据），提交后调用 `skillsApi.update` 并刷新列表

## 6. Frontend: 删除功能增强

- [x] 6.1 所有技能（包括 built-in）的 Delete 按钮均可点击，移除 `disabled={record.is_builtin}`
- [x] 6.2 Built-in 技能删除时使用 Popconfirm 显示警告信息："此为内置技能，删除后重启应用会自动恢复。确认删除？"
- [x] 6.3 自定义技能删除保持原有 Popconfirm 确认逻辑

## 7. 集成测试

- [x] 7.1 使用 Playwright 测试技能列表排序功能
- [x] 7.2 使用 Playwright 测试新增技能完整流程
- [x] 7.3 使用 Playwright 测试删除 built-in 技能流程
