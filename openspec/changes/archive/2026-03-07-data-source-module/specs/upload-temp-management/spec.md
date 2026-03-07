# Upload Temp Management Specification

## Purpose

管理 `local_upload` 类型数据源的临时文件存储, 包括目录管理、配额限制、过期清理和 Settings 页面展示。

### Requirement: 临时目录管理

#### Scenario: 目录结构

- **GIVEN** `upload_temp_dir = ./data/uploads/tmp`
- **WHEN** 用户上传文件到数据源 ds_id
- **THEN** 文件存储在 `{upload_temp_dir}/{ds_id}/{filename}`

#### Scenario: 目录自动创建

- **WHEN** 首次上传文件
- **AND** 目标目录不存在
- **THEN** 自动创建 `{upload_temp_dir}/{ds_id}/` 目录

#### Scenario: 删除数据源时清理文件

- **WHEN** DELETE /api/v1/data-sources/{id}
- **AND** source_type = `local_upload`
- **THEN** 删除 `{upload_temp_dir}/{ds_id}/` 整个目录

### Requirement: 文件上传 API

#### Scenario: 上传文件

- **WHEN** POST /api/v1/data-sources/upload
- **AND** multipart form: `file` (文件) + `data_source_id` (数据源 ID)
- **AND** 文件大小 ≤ max_upload_size_mb
- **AND** 当前总用量 + 文件大小 ≤ upload_total_quota_mb
- **THEN** 存储文件, 更新数据源的 file_count 和 total_size
- **AND** 返回 `{ "filename": "...", "size": 12345, "path": "..." }`

#### Scenario: 文件大小超限

- **WHEN** 单个文件大小 > max_upload_size_mb (默认 100MB)
- **THEN** 返回 400: `"File size exceeds limit of 100 MB"`

#### Scenario: 配额超限

- **WHEN** 当前总用量 + 文件大小 > upload_total_quota_mb (默认 1024MB)
- **THEN** 返回 400: `"Upload quota exceeded. Used: 980 MB / 1024 MB. Please delete some files."`

### Requirement: 配额查询 API

#### Scenario: 查询配额

- **WHEN** GET /api/v1/data-sources/upload-quota
- **THEN** 返回:
  ```json
  {
    "total_mb": 1024,
    "used_mb": 234,
    "available_mb": 790,
    "retention_days": 7,
    "max_file_size_mb": 100,
    "temp_dir": "./data/uploads/tmp"
  }
  ```

### Requirement: 过期清理

#### Scenario: 启动时清理

- **WHEN** 应用启动 (lifespan)
- **THEN** 扫描 `upload_temp_dir` 下所有文件
- **AND** 删除修改时间 > cleanup_retention_days 的文件
- **AND** 删除空目录
- **AND** 日志记录: 删除了几个文件, 释放了多少空间

#### Scenario: 清理不删除数据库记录

- **WHEN** 文件被过期清理
- **THEN** 数据源记录保留, status 更新为 `inactive`
- **AND** file_count 和 total_size 重新计算

### Requirement: 系统配置

#### Scenario: 新增配置项

- **GIVEN** config.py Settings 类
- **THEN** 新增:
  - `upload_temp_dir: str = "./data/uploads/tmp"` — 临时上传目录
  - `upload_total_quota_mb: int = 1024` — 总配额 (MB)

### Requirement: Settings 页面展示

#### Scenario: Upload Storage 区域

- **WHEN** 用户访问 /settings
- **THEN** 在现有 Configuration card 中新增:
  - Upload Temp Directory: `./data/uploads/tmp`
  - Max Upload Size: `100 MB` (per file)
  - Total Quota: `1024 MB`
  - Used: `234 MB` (从 API 获取)
  - Available: `790 MB`
  - Progress Bar: 234/1024 (绿色 < 70%, 黄色 70-90%, 红色 > 90%)
  - Cleanup Retention: `7 days`
