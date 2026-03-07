# Unified Table UI Specification

## Purpose

统一项目中所有列表页的 Ant Design Table 组件规范，包括共享组件（ResizableTitle、OverflowPopover）、搜索、排序、固定布局、分页配置。以 SkillLibrary 为标杆，确保所有表格页面的功能和体验一致。

### Requirement: 共享表格组件

系统 SHALL 提供两个可复用的表格辅助组件，供所有列表页统一使用。

#### Scenario: ResizableTitle 组件

- **WHEN** 列表页表格使用 ResizableTitle 作为表头 cell 组件
- **THEN** 用户可以拖拽列边框调整列宽
- **AND** 拖拽手柄位于表头 cell 右侧，光标显示 col-resize
- **AND** 列宽 SHALL 有最小值约束（不可缩到 0）

#### Scenario: OverflowPopover 组件

- **WHEN** 表格 cell 中的文本超出列宽
- **THEN** 文本以省略号（ellipsis）截断显示
- **AND** 鼠标悬停 0.5 秒后弹出 Popover 显示完整文本
- **AND** Popover 最大宽度 400px，超长文本自动换行
- **AND** 若文本未溢出，不显示 Popover

#### Scenario: 组件导出位置

- **WHEN** 开发者需要使用共享表格组件
- **THEN** 从 `components/TableUtils.tsx` 导入 ResizableTitle 和 OverflowPopover
- **AND** react-resizable CSS 在该文件中统一导入

### Requirement: 统一搜索栏

所有包含数据的列表页（非占位页）SHALL 在表格上方提供搜索功能。

#### Scenario: 搜索框行为

- **WHEN** 用户在搜索框中输入文本并搜索
- **THEN** 表格按 name 和 description 字段进行客户端模糊匹配过滤（大小写不敏感）
- **AND** 搜索框支持 allowClear 一键清除
- **AND** 清除搜索后恢复完整列表

#### Scenario: Pipelines 页搜索

- **WHEN** Pipelines 页面加载
- **THEN** 表格上方显示搜索框，支持按 name 和 description 过滤

#### Scenario: DataSources 页搜索

- **WHEN** DataSources 页面加载
- **THEN** 表格上方显示搜索框，支持按 name 过滤

#### Scenario: Targets 页搜索

- **WHEN** Targets 页面加载
- **THEN** 表格上方显示搜索框，支持按 name 过滤

#### Scenario: Connections 页搜索

- **WHEN** Connections 页面加载
- **THEN** 表格上方显示搜索框，支持按 name 和 description 过滤

### Requirement: 统一列排序

所有列表页表格 SHALL 支持客户端列排序。

#### Scenario: Name 列排序

- **WHEN** 用户点击 Name 列标题
- **THEN** 数据按 name 字段字母顺序升序/降序排列

#### Scenario: Created At 列排序

- **WHEN** 用户点击 Created At 列标题
- **THEN** 数据按创建时间升序/降序排列

#### Scenario: Status/Type 列排序

- **WHEN** 用户点击 Status 或 Type 列标题
- **THEN** 数据按该字段字母顺序排序

### Requirement: 统一表格布局

所有列表页表格 SHALL 使用固定布局并合理设定列宽。

#### Scenario: 固定表格布局

- **WHEN** 任何列表页表格渲染
- **THEN** Table 组件使用 `tableLayout="fixed"`
- **AND** 使用 ResizableTitle 作为 header cell 组件
- **AND** 每列设定初始宽度
- **AND** 设置 `scroll.x` 为列宽总和，确保列标题不被截断

#### Scenario: 长文本列处理

- **WHEN** Name 或 Description 列文本超出列宽
- **THEN** 使用 OverflowPopover 组件显示截断文本和悬停弹窗

### Requirement: 统一分页配置

所有列表页表格 SHALL 使用标准化的分页配置。

#### Scenario: 分页组件配置

- **WHEN** 任何列表页表格渲染
- **THEN** 分页配置 SHALL 包含：
  - showSizeChanger: true
  - pageSizeOptions: [10, 20, 50, 100]
  - showTotal: 显示总数文案（如 "Total 42 pipelines"）
- **AND** 默认 pageSize 为 20

#### Scenario: Targets 页添加分页

- **WHEN** Targets 页面加载
- **THEN** 表格 SHALL 支持分页（当前无分页）
- **AND** 使用标准分页配置

#### Scenario: RunHistory 占位页分页

- **WHEN** RunHistory 页面加载
- **THEN** 即使数据为空，表格 SHALL 配置标准分页参数

### Requirement: SkillLibrary 去重

SkillLibrary 页面 SHALL 复用共享组件而非自行定义。

#### Scenario: 导入共享组件

- **WHEN** SkillLibrary 页面代码更新后
- **THEN** ResizableTitle 和 OverflowPopover 从 `components/TableUtils.tsx` 导入
- **AND** 页面中不再包含这两个组件的内联定义
- **AND** 页面行为与改造前完全一致
