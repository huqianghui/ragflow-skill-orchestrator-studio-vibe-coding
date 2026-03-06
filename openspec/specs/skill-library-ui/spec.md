# Skill Library UI Specification

## Purpose

Skill Library 前端页面的交互规格，基于 Ant Design Table 组件实现，支持表格展示、排序、列拖拽、图标、详情查看、创建/编辑表单、删除确认、搜索和筛选。

### Requirement: 表格展示与分页 [Phase 1 - 已实现]

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

#### Scenario: Name 列点击行为

- **WHEN** 点击 builtin skill 名称 → 导航到 /skills/{id}/configure（BuiltinSkillEditor 页面）
- **WHEN** 点击 python_code skill 名称 → 导航到 /skills/{id}/edit（SkillEditor 全页面）
- **WHEN** 点击其他 custom skill 名称 → 打开 Edit Form Modal

#### Scenario: Description 溢出 Popover

- **WHEN** Description 文本溢出列宽且鼠标 hover 0.5s
- **THEN** 弹出 Popover（maxWidth 400px）
- **AND** 未溢出时不弹出

#### Scenario: Actions 列按钮

- **THEN** 每行显示 View / Edit|Configure / Delete 按钮
- **AND** builtin skill 显示 "Configure" 按钮，点击导航到 /skills/{id}/configure
- **AND** python_code skill 的 Edit 点击导航到 /skills/{id}/edit

### Requirement: 表格排序 [Phase 1 - 已实现]

#### Scenario: 可排序列

- **THEN** Name、Type、Created At 三列支持客户端排序

### Requirement: 可拖拽调整列宽 [Phase 1 - 已实现]

基于 react-resizable 实现。

#### Scenario: 拖拽行为

- **THEN** Name 列可拖拽 (最小 100px)，Description 列可拖拽 (最小 150px)
- **AND** Type / Created At / Actions 列固定宽度

### Requirement: Skill 类型图标 [Phase 1 - 已实现]

#### Scenario: 类型图标映射

- **THEN** Type 列 Tag 中的图标和颜色:
  - builtin → ToolOutlined (蓝色)
  - web_api → ApiOutlined (绿色)
  - config_template → SettingOutlined (橙色)
  - python_code → CodeOutlined (紫色)

#### Scenario: 内置 Skill 专属图标 (Name 列)

- **THEN** 15 个内置 Skill 按名称显示专属图标:
  - DocumentCracker → FileSearchOutlined, TextSplitter → ScissorOutlined
  - TextMerger → MergeCellsOutlined, LanguageDetector → GlobalOutlined
  - EntityRecognizer → TagsOutlined, EntityLinker → BranchesOutlined
  - KeyPhraseExtractor → HighlightOutlined, SentimentAnalyzer → SmileOutlined
  - PIIDetector → EyeInvisibleOutlined, TextTranslator → TranslationOutlined
  - OCR → ScanOutlined, ImageAnalyzer → PictureOutlined
  - TextEmbedder → RobotOutlined, GenAIPrompt → OpenAIOutlined
  - Shaper → FunctionOutlined, Conditional → ForkOutlined

### Requirement: Skill 详情 Modal [Phase 1 - 已实现]

#### Scenario: 查看详情

- **WHEN** 点击 View 按钮或 builtin skill 名称
- **THEN** 打开 "Skill Details" Modal (宽 640px)
- **AND** 使用 Descriptions 组件显示: Name / Type (Tag) / Description / Built-in (Tag) / Config Schema (格式化 JSON) / Created At / Updated At

### Requirement: 创建 Skill [Phase 1 - 已实现]

#### Scenario: 两种创建入口

- **THEN** 页面顶部显示两个按钮:
  - "New Python Skill" → 导航到 /skills/new（SkillEditor 全页面）
  - "New Skill" → 打开 Form Modal

#### Scenario: Form Modal 创建

- **WHEN** 点击 "New Skill" 按钮
- **THEN** 打开表单 Modal，字段:
  - name (必填, Input)
  - description (可选, TextArea)
  - skill_type (必填, Select: web_api / config_template / python_code)
  - config_schema (可选, TextArea, JSON 格式)

#### Scenario: python_code 类型创建后重定向

- **WHEN** Form Modal 中选择 skill_type=python_code 并提交
- **THEN** 创建成功后自动导航到 /skills/{id}/edit（SkillEditor 页面）

#### Scenario: 创建重名 Skill 错误提示

- **WHEN** 提交的 name 与已有 Skill 重名
- **THEN** 后端返回 409 CONFLICT
- **AND** 前端通过 message.error() 显示 "Skill with name 'xxx' already exists"
- **AND** 表单保持打开，用户可修改 name 后重新提交

#### Scenario: config_schema JSON 校验

- **WHEN** config_schema 输入无效 JSON
- **THEN** 表单显示 "Invalid JSON format" 错误，阻止提交

### Requirement: 编辑 Skill [Phase 1 - 已实现]

#### Scenario: 打开编辑表单

- **WHEN** 点击非 builtin、非 python_code Skill 的 Edit 按钮
- **THEN** 打开预填当前值的编辑表单 Modal
- **AND** name 字段 SHALL 为 disabled（只读），不可修改

#### Scenario: 提交编辑

- **WHEN** 修改字段并提交
- **THEN** 调用 PUT /api/v1/skills/{id}，请求 body 中不包含 name 字段
- **AND** 成功后刷新列表

### Requirement: 删除确认 [Phase 1 - 已实现]

#### Scenario: 删除内置 Skill

- **WHEN** 点击 builtin Skill 的 Delete
- **THEN** Popconfirm: "This is a built-in skill. It will be re-created on next application restart. Continue?"
- **AND** 确认后调用 DELETE API 并刷新列表

#### Scenario: 删除自定义 Skill

- **WHEN** 点击自定义 Skill 的 Delete
- **THEN** Popconfirm: "Are you sure you want to delete this skill?"
- **AND** 确认后调用 DELETE API 并刷新列表

### Requirement: 搜索与筛选 [Phase 1 - 已实现]

客户端搜索和筛选，作用于当前页已加载的数据。

#### Scenario: 关键词搜索

- **WHEN** 在搜索框输入关键词
- **THEN** 仅显示 name 或 description 包含关键词（不区分大小写）的 Skill

#### Scenario: 类型筛选

- **WHEN** 在类型下拉中选择一个或多个类型 (builtin / web_api / config_template / python_code)
- **THEN** 仅显示 skill_type 匹配的 Skill

#### Scenario: 组合搜索

- **WHEN** 同时输入关键词和选择类型
- **THEN** 仅显示同时满足两个条件的 Skill
