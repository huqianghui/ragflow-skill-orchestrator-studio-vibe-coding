## ADDED Requirements

### Requirement: DataSource File Reader Service

系统 SHALL 提供 DataSourceReader 服务，支持从 DataSource 枚举和读取文件。

#### Scenario: 枚举 local_upload 文件

- **WHEN** 调用 `list_files()` 且 DataSource 类型为 `local_upload`
- **THEN** 返回该 DataSource 上传目录下的所有文件的 FileInfo 列表
- **AND** 每个 FileInfo 包含 name, path, size, mime_type, last_modified

#### Scenario: 枚举 azure_blob 文件

- **WHEN** 调用 `list_files()` 且 DataSource 类型为 `azure_blob`
- **THEN** 使用 connection_config 中的 connection_string 和 container_name 连接
- **AND** 按 path_prefix 过滤，返回匹配的 blob 文件列表
- **AND** 默认最多返回 1000 条

#### Scenario: 读取 local_upload 文件

- **WHEN** 调用 `read_file()` 且 DataSource 类型为 `local_upload`
- **THEN** 返回文件的字节内容

#### Scenario: 读取 azure_blob 文件

- **WHEN** 调用 `read_file()` 且 DataSource 类型为 `azure_blob`
- **THEN** 下载并返回 blob 的字节内容

#### Scenario: 不支持的源类型

- **WHEN** 调用 `list_files()` 或 `read_file()` 且源类型未实现读取器
- **THEN** 抛出 ValidationException 提示该类型暂不支持文件读取

### Requirement: DataSource Files API Endpoint

系统 SHALL 提供 REST API 端点列出 DataSource 中的文件。

#### Scenario: 列出文件

- **WHEN** GET /api/v1/data-sources/{id}/files
- **THEN** 返回 FileInfo 列表
- **AND** 若 DataSource 不存在返回 404

#### Scenario: 列出文件失败

- **WHEN** GET /api/v1/data-sources/{id}/files 且连接失败
- **THEN** 返回 500 错误及错误信息
