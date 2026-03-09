## Why

Workflow 执行引擎（Change 3）需要从 DataSource 中枚举和读取文件，才能将文件路由到对应 Pipeline 处理。当前 DataSource 模块只支持连通性测试和本地文件上传，缺少通用的文件枚举和读取能力。

## What Changes

- 新增 `DataSourceReader` 服务，提供 `list_files()` 和 `read_file()` 方法
- 支持 `local_upload` 和 `azure_blob` 两种源类型的文件枚举与读取
- 新增 API 端点 `GET /api/v1/data-sources/{id}/files` 列出文件
- 新增 `FileInfo` 数据结构（name, path, size, mime_type, last_modified, etag）

## Capabilities

### New Capabilities

（无独立新 capability，功能扩展到现有 datasources）

### Modified Capabilities

- `datasources`: 新增文件枚举和读取 API，扩展 DataSource 的运行时能力

## Impact

- **后端**: 新增 `services/data_source_reader.py`，修改 `api/data_sources.py` 新增端点
- **数据库**: 无变更
- **前端**: 无变更（文件列表暂不在 UI 展示，由 Workflow 执行引擎内部使用）
