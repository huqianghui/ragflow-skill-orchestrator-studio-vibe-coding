# Data Source UI Specification

## Purpose

定义数据源前端页面: 卡片网格类型选择器、配置 Modal 表单、列表页增强、Azure 官方 SVG 图标集成。

### Requirement: 卡片网格类型选择器

#### Scenario: 选择器页面布局

- **WHEN** 用户导航到 /data-sources/new
- **THEN** 显示:
  - 页面标题: "Choose a data source"
  - 副标题: "Select a data source type to configure"
  - 搜索过滤输入框
  - 3 列卡片网格, 按分类分组
  - "← Back to Data Sources" 返回链接

#### Scenario: 卡片分组显示

- **THEN** 卡片按 3 个分类分组, 每组有标题:
  - "Local" — 1 张卡片
  - "Built-in indexer" — 6 张卡片 (2 行 × 3 列)
  - "Logic Apps connector" — 9 张卡片 (3 行 × 3 列)

#### Scenario: 单个卡片内容

- **THEN** 每张卡片显示:
  - 左侧: Azure 官方 SVG 图标 (48×48px)
  - 右侧上: 数据源名称 (如 "Azure Blob Storage")
  - 右侧下: 分类标签 (如 "Built-in indexer"), 浅灰色
- **AND** hover 时卡片有浅蓝色边框高亮

#### Scenario: 搜索过滤

- **WHEN** 用户在搜索框输入 "blob"
- **THEN** 只显示名称匹配的卡片 (Azure Blob Storage)
- **AND** 空分类组自动隐藏

#### Scenario: 点击卡片

- **WHEN** 用户点击某个卡片 (如 Azure Blob Storage)
- **THEN** 弹出该类型的配置 Modal

### Requirement: 配置 Modal 表单

#### Scenario: 非 local_upload 类型

- **WHEN** 用户选择了非 local_upload 类型
- **THEN** Modal 显示:
  - 标题: "Configure {类型名}" (如 "Configure Azure Blob Storage")
  - Name 输入框 (必填)
  - Description 文本域 (可选)
  - 分隔线: "Connection"
  - 类型对应的配置字段 (secret 字段用 password 输入框)
  - 分隔线: "Optional"
  - Pipeline 下拉选择 (可选)
  - 底部按钮: Cancel | Test | Create

#### Scenario: local_upload 类型

- **WHEN** 用户选择了 Local File Upload
- **THEN** Modal 显示:
  - 标题: "Local File Upload"
  - Name 输入框 (必填)
  - Description 文本域 (可选)
  - Ant Design Upload.Dragger 文件拖放区
  - 支持格式提示: PDF, DOCX, TXT, MD, CSV, HTML, PNG, JPG, TIFF, JSON, JSONL, XLSX
  - 配额显示: "{used} MB / {total} MB used"
  - 底部按钮: Cancel | Upload & Create

#### Scenario: Test 按钮行为

- **WHEN** 用户点击 Modal 中的 Test 按钮
- **THEN** 先创建数据源 (POST), 然后执行测试 (POST /test)
- **OR** 在创建前用表单值直接测试 (POST /data-sources/test-config)
- **AND** 显示 loading 状态
- **AND** 成功 → green message, 失败 → red message with details

#### Scenario: Create 按钮行为

- **WHEN** 用户填写完毕点击 Create
- **THEN** 调用 POST /api/v1/data-sources
- **AND** 成功后导航回 /data-sources 列表页
- **AND** 显示 success message

### Requirement: 列表页增强

#### Scenario: 表格列定义

- **WHEN** 用户访问 /data-sources
- **THEN** Table 显示列:
  - Name (可点击, 打开编辑 Modal)
  - Type (图标 + Tag, 如 `[🔵] Azure Blob Storage`)
  - Status (颜色 Tag: active=green, inactive=default, error=red)
  - Files (数字)
  - Size (格式化: KB/MB/GB)
  - Created At (日期时间)
  - Actions (Test | Edit | Delete)

#### Scenario: New Data Source 按钮

- **WHEN** 用户点击 "New Data Source"
- **THEN** 导航到 /data-sources/new

#### Scenario: Test 按钮 (列表页)

- **WHEN** 用户点击某行的 Test
- **THEN** 调用 POST /api/v1/data-sources/{id}/test
- **AND** 显示 loading → 结果 message

#### Scenario: Edit 按钮

- **WHEN** 用户点击某行的 Edit
- **THEN** 弹出编辑 Modal, 表单预填当前值
- **AND** secret 字段显示 placeholder "Leave empty to keep current value"
- **AND** source_type 不可修改 (disabled)

#### Scenario: Delete 按钮

- **WHEN** 用户点击某行的 Delete
- **THEN** 弹出 Popconfirm 确认
- **AND** 确认后调用 DELETE /api/v1/data-sources/{id}

### Requirement: Azure 官方 SVG 图标

#### Scenario: 图标文件

- **GIVEN** 16 种 source type
- **THEN** 在 `frontend/public/icons/data-sources/` 目录下有 16 个 SVG 文件
- **AND** 文件命名: `{source_type 的 kebab-case}.svg`

#### Scenario: 图标使用

- **THEN** 卡片选择器和列表页 Type 列都使用对应 SVG 图标
- **AND** 图标大小: 卡片中 48×48px, 列表中 24×24px

### Requirement: 路由配置

#### Scenario: 新增路由

- **WHEN** App.tsx 路由配置
- **THEN** 新增: `/data-sources/new` → `DataSourceNew` 组件
- **AND** 保留: `/data-sources` → `DataSources` 组件 (增强版)
