# Data Sources Module Specification

## Purpose

数据源模块负责管理 Pipeline 的输入数据来源。Phase 1 支持本地文件上传和 Azure Blob Storage 两种数据源，支持多种文件格式。

### Requirement: 数据源 Data Model

系统应维护数据源配置的完整数据模型。

#### Scenario: 数据源基本结构

- **GIVEN** 用户查看数据源详情
- **THEN** 数据源应包含以下字段:
  - id (唯一标识)
  - name (显示名称)
  - description (描述, 可选)
  - source_type (local_upload | azure_blob)
  - status (active | inactive | error)
  - connection_config (类型相关配置)
  - pipeline_id (关联 Pipeline, 可选)
  - file_count (文件数量)
  - total_size (总大小)
  - created_at / updated_at
  - last_synced_at (最后同步时间, 仅 azure_blob) [Phase 2]

### Requirement: 本地文件上传

用户可以上传本地文件作为 Pipeline 数据源。

#### Scenario: 上传单个文件

- **GIVEN** 用户在数据源页面点击 "上传文件"
- **WHEN** 用户选择一个 PDF 文件 (< 100MB)
- **THEN** 系统上传文件到服务端存储
- **AND** 显示上传进度
- **AND** 上传完成后文件出现在数据源文件列表中

#### Scenario: 批量上传文件

- **GIVEN** 用户在数据源页面点击 "上传文件"
- **WHEN** 用户选择多个文件或拖拽文件夹
- **THEN** 系统并行上传所有文件
- **AND** 显示每个文件的上传进度
- **AND** 跳过不支持的文件格式并提示

#### Scenario: 支持的文件格式

- **GIVEN** 用户上传文件
- **WHEN** 文件格式为以下之一:
  - PDF (.pdf)
  - Word (.docx, .doc)
  - 纯文本 (.txt, .md, .csv)
  - HTML (.html, .htm)
  - 图片 (.png, .jpg, .jpeg, .tiff)
  - JSON (.json, .jsonl)
  - Excel (.xlsx, .xls)
- **THEN** 系统接受上传
- **WHEN** 文件格式不在支持列表中
- **THEN** 系统拒绝上传并提示 "不支持的文件格式: [ext]"

#### Scenario: 文件大小限制

- **GIVEN** 用户上传文件
- **WHEN** 单个文件超过 100MB
- **THEN** 系统拒绝上传并提示 "文件大小超过限制 (最大 100MB)"

### Requirement: Azure Blob Storage 数据源

用户可以配置 Azure Blob Storage 作为数据源。

#### Scenario: 配置 Azure Blob 连接

- **GIVEN** 用户选择新建 Azure Blob 数据源
- **WHEN** 用户填写:
  - connection_string 或 account_name + account_key
  - container_name
  - prefix (可选, 用于过滤路径)
- **THEN** 系统验证连接有效性
- **AND** 列出 container 中匹配的文件
- **AND** 保存数据源配置

#### Scenario: 连接验证失败

- **GIVEN** 用户填写了 Azure Blob 配置
- **WHEN** connection_string 无效或无权限
- **THEN** 系统显示 "连接失败: [错误详情]"
- **AND** 不保存数据源

#### Scenario: 同步文件列表

- **GIVEN** 一个已配置的 Azure Blob 数据源
- **WHEN** 用户点击 "同步" 或系统自动同步
- **THEN** 系统扫描 container 中的文件
- **AND** 更新文件列表（新增/删除）
- **AND** 更新 last_synced_at 时间戳

### Requirement: 数据源 CRUD

用户可以管理数据源的完整生命周期。

#### Scenario: 列出数据源

- **GIVEN** 用户访问数据源页面
- **WHEN** 页面加载
- **THEN** 显示所有数据源，含名称、类型、文件数、状态

#### Scenario: 删除数据源

- **GIVEN** 一个数据源未被任何运行中的 Pipeline 使用
- **WHEN** 用户点击删除并确认
- **THEN** 系统删除数据源配置
- **AND** 对于本地上传，同时删除已上传的文件
- **GIVEN** 一个数据源正被运行中的 Pipeline 使用
- **WHEN** 用户点击删除
- **THEN** 系统阻止删除并提示

#### Scenario: 浏览数据源文件

- **GIVEN** 一个数据源包含文件
- **WHEN** 用户点击进入数据源详情
- **THEN** 显示文件列表:
  - 文件名
  - 大小
  - 格式
  - 上传/同步时间
- **AND** 支持预览文本类文件的前 1000 字符
