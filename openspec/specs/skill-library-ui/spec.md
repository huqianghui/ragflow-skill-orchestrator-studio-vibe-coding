# Skill Library UI Specification

## Purpose

Skill Library 前端页面的交互规格，基于 Ant Design Table 组件实现，支持表格展示、排序、列拖拽、图标、详情查看、创建/编辑表单、删除确认、搜索和筛选。

### Requirement: 表格展示与分页

#### Scenario: 默认分页

- **WHEN** 用户首次打开 Skill Library 页面
- **THEN** 调用 GET /api/v1/skills?page=1&page_size=10
- **AND** 表格默认每页 10 条，分页选项 [10, 20, 50, 100]
- **AND** 页脚显示 "Total N skills"

#### Scenario: 表格列结构

- **THEN** 表格包含 5 列:
  - Name (可拖拽调整宽度, 默认 160px, 最小 100px)
  - Type (固定 100px)
  - Description (可拖拽调整宽度, 默认 350px, 最小 150px)
  - Created At (固定 160px)
  - Actions (固定 180px)

#### Scenario: Name 列为可点击链接

- **WHEN** 点击 builtin skill 名称
- **THEN** 打开 Detail Modal（只读）
- **WHEN** 点击 custom skill 名称
- **THEN** 打开 Edit Form Modal（可编辑）

#### Scenario: Description 溢出 Popover

- **WHEN** Description 文本溢出列宽且鼠标 hover 0.5s
- **THEN** 弹出 Popover（maxWidth 400px）
- **AND** 未溢出时不弹出

#### Scenario: Actions 列按钮

- **THEN** 每行显示 View / Edit / Delete 按钮
- **AND** builtin skill 的 Edit 按钮为 disabled

### Requirement: 表格排序

支持客户端排序，点击列头切换升序/降序/无排序。

#### Scenario: 可排序列

- **THEN** Name、Type、Created At 三列支持排序
- **AND** 排序为客户端排序（在当前页数据上排序）

### Requirement: 可拖拽调整列宽

基于 react-resizable 实现，Name 和 Description 列支持拖拽，其他列固定宽度。

#### Scenario: 拖拽行为

- **WHEN** 拖拽 Name 列右边框
- **THEN** 列宽变化，最小 100px
- **WHEN** 拖拽 Description 列右边框
- **THEN** 列宽变化，最小 150px
- **AND** Type / Created At / Actions 列头无拖拽手柄

### Requirement: Skill 类型图标

每行 Skill 在 Name 列和 Type 列显示对应图标。

#### Scenario: 类型图标映射

- **THEN** Type 列 Tag 中的图标:
  - builtin → ToolOutlined (蓝色)
  - web_api → ApiOutlined (绿色)
  - config_template → SettingOutlined (橙色)
  - python_code → CodeOutlined (紫色)

#### Scenario: 内置 Skill 专属图标 (Name 列)

- **THEN** 15 个内置 Skill 按名称显示专属图标:
  - DocumentCracker → FileSearchOutlined
  - TextSplitter → ScissorOutlined
  - TextMerger → MergeCellsOutlined
  - LanguageDetector → GlobalOutlined
  - EntityRecognizer → TagsOutlined
  - EntityLinker → BranchesOutlined
  - KeyPhraseExtractor → HighlightOutlined
  - SentimentAnalyzer → SmileOutlined
  - PIIDetector → EyeInvisibleOutlined
  - TextTranslator → TranslationOutlined
  - OCR → ScanOutlined
  - ImageAnalyzer → PictureOutlined
  - TextEmbedder → RobotOutlined
  - Shaper → FunctionOutlined
  - Conditional → ForkOutlined

### Requirement: Skill 详情 Modal

#### Scenario: 查看详情

- **WHEN** 点击 View 按钮或 builtin skill 名称
- **THEN** 打开 "Skill Details" Modal (宽 640px)
- **AND** 使用 Descriptions 组件显示: Name / Type (Tag) / Description / Built-in (Tag) / Config Schema (格式化 JSON, pre 标签) / Created At / Updated At

#### Scenario: 关闭详情

- **WHEN** 点击关闭按钮或 Modal 外部
- **THEN** Modal 关闭

### Requirement: 创建 Skill

#### Scenario: 打开创建表单

- **WHEN** 点击 "New Skill" 按钮
- **THEN** 打开表单 Modal，字段:
  - name (必填, Input)
  - description (可选, TextArea)
  - skill_type (必填, Select: web_api / config_template / python_code)
  - config_schema (可选, TextArea, JSON 格式)

#### Scenario: 提交有效表单

- **WHEN** 填写所有必填字段并提交
- **THEN** 调用 POST /api/v1/skills，成功后刷新列表

#### Scenario: config_schema JSON 校验

- **WHEN** config_schema 输入无效 JSON
- **THEN** 表单显示 "Invalid JSON format" 错误，阻止提交

### Requirement: 编辑 Skill

#### Scenario: 打开编辑表单

- **WHEN** 点击非 builtin Skill 的 Edit 按钮或名称
- **THEN** 打开预填当前值的编辑表单 Modal

#### Scenario: 提交编辑

- **WHEN** 修改字段并提交
- **THEN** 调用 PUT /api/v1/skills/{id}，成功后刷新列表

### Requirement: 删除确认

#### Scenario: 删除内置 Skill

- **WHEN** 点击 builtin Skill 的 Delete
- **THEN** Popconfirm: "This is a built-in skill. It will be re-created on next application restart. Continue?"
- **AND** 确认后调用 DELETE API 并刷新列表

#### Scenario: 删除自定义 Skill

- **WHEN** 点击自定义 Skill 的 Delete
- **THEN** Popconfirm: "Are you sure you want to delete this skill?"
- **AND** 确认后调用 DELETE API 并刷新列表

### Requirement: 搜索与筛选

客户端搜索和筛选，作用于当前页已加载的数据。

#### Scenario: 关键词搜索

- **WHEN** 在搜索框输入关键词
- **THEN** 仅显示 name 或 description 包含关键词（不区分大小写）的 Skill

#### Scenario: 类型筛选

- **WHEN** 在类型下拉中选择一个或多个类型
- **THEN** 仅显示 skill_type 匹配的 Skill

#### Scenario: 组合搜索

- **WHEN** 同时输入关键词和选择类型
- **THEN** 仅显示同时满足两个条件的 Skill

#### Scenario: 清除筛选

- **WHEN** 清空搜索框和类型筛选
- **THEN** 显示所有 Skill
