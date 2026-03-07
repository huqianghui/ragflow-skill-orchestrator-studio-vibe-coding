# System Module Specification

## Purpose

系统模块涵盖全局性功能：健康检查、配置管理、API 通用规范、数据库初始化。MVP 阶段为单用户无认证模式。

### Requirement: 健康检查

#### Scenario: 健康检查成功

- **WHEN** GET /health
- **AND** 数据库连接正常
- **THEN** 返回 200:
  ```json
  {"status": "ok", "version": "0.1.0", "database": "connected"}
  ```

#### Scenario: 数据库异常

- **WHEN** GET /health
- **AND** 数据库连接失败
- **THEN** 返回 200 (status = degraded):
  ```json
  {"status": "degraded", "version": "0.1.0", "database": "disconnected"}
  ```

### Requirement: 配置管理

通过 pydantic-settings 管理，支持环境变量和 .env 文件。字段名自动映射为大写环境变量。

| 字段名 (config.py) | 默认值 | 说明 |
|---------------------|--------|------|
| app_name | RAGFlow Skill Orchestrator Studio | 应用名称 |
| version | 0.1.0 | 版本号 |
| debug | true | 调试模式 |
| database_url | sqlite+aiosqlite:///./data/app.db | 数据库连接 |
| api_prefix | /api/v1 | API 路径前缀 |
| cors_origins | ["http://localhost:15173"] | 允许的跨域来源 |
| secret_encryption_key | (内置默认) | Connection 加密密钥 (Fernet) |
| skill_venvs_root | ./data/skill_venvs | Skill venv 存储目录 |
| max_upload_size_mb | 100 | 单文件最大上传大小 (MB) |
| upload_temp_dir | ./data/uploads/tmp | 本地上传临时目录 |
| upload_total_quota_mb | 1024 | 上传存储总配额 (MB) |
| sync_execution_timeout_s | 300 | Pipeline 同步执行超时 (s) |
| cleanup_retention_days | 7 | 文件保留天数（上传清理 + 中间结果） |
| log_level | INFO | 日志级别 |

### Requirement: API 通用规范

#### Scenario: 成功响应

- 直接返回数据对象（无外层包装）
- 创建操作返回 201，删除操作返回 204

#### Scenario: 错误响应

- 返回对应 HTTP 状态码和 JSON:
  ```json
  { "code": "NOT_FOUND", "message": "...", "details": null }
  ```
- 错误码: NOT_FOUND / FORBIDDEN / VALIDATION_ERROR / CONFLICT

#### Scenario: 分页响应

- GET ?page=1&page_size=20 → `{ items, total, page, page_size, total_pages }`
- page ≥ 1, page_size 1~100, 默认 20

#### Scenario: API 文档

- GET /docs → Swagger UI

### Requirement: CORS 配置

- 允许 cors_origins 列表中的来源，允许所有方法和请求头，允许携带凭证

### Requirement: 数据库初始化

#### Scenario: 应用启动

- FastAPI lifespan 启动时：
  - 自动创建所有 ORM 表 (Base.metadata.create_all)
  - 执行内置 Skill 播种
  - 初始化基础 venv
  - 清理过期上传临时文件 (UploadManager.cleanup_expired)
- 应用关闭时释放数据库连接

### Requirement: 中间结果清理 [Phase 2]

- cleanup_retention_days = 7 天
- 每日凌晨 2:00 删除过期 Run 中间结果
