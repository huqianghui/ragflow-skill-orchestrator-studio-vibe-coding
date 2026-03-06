# System Module Specification

## Purpose

系统模块涵盖全局性功能：健康检查、配置管理、API 通用规范、数据库初始化。MVP 阶段为单用户无认证模式。

### Requirement: 健康检查 [Phase 1 - 已实现]

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
- **THEN** 返回 200 (但 status 为 degraded):
  ```json
  {"status": "degraded", "version": "0.1.0", "database": "disconnected"}
  ```

### Requirement: 配置管理 [Phase 1 - 已实现]

通过 pydantic-settings 管理，支持环境变量和 .env 文件。

#### Scenario: 配置项

- **GIVEN** 系统启动
- **THEN** 加载以下配置 (环境变量优先于 .env 优先于默认值):

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| APP_NAME | RAGFlow Skill Orchestrator Studio | 应用名称 |
| VERSION | 0.1.0 | 版本号 |
| DEBUG | true | 调试模式 |
| DATABASE_URL | sqlite+aiosqlite:///./data/app.db | 数据库连接 |
| API_PREFIX | /api/v1 | API 路径前缀 |
| CORS_ORIGINS | ["http://localhost:15173"] | 允许的跨域来源 |
| ENCRYPTION_KEY | (必填) | Connection 加密密钥 (Fernet) |
| PYTHON_SKILL_TIMEOUT_S | 30 | Python Skill 执行超时 |
| VENV_BASE_DIR | ./data/venvs | Skill venv 存储目录 |
| MAX_UPLOAD_SIZE_MB | 100 | 最大上传文件大小 [Phase 2] |
| SYNC_EXECUTION_TIMEOUT_S | 300 | Pipeline 同步执行超时 [Phase 2] |
| CLEANUP_RETENTION_DAYS | 7 | 中间结果保留天数 [Phase 2] |
| LOG_LEVEL | INFO | 日志级别 |

### Requirement: API 通用规范 [Phase 1 - 已实现]

#### Scenario: 成功响应

- **GIVEN** 任何 API 请求成功
- **THEN** 直接返回数据对象（无外层包装）
- **AND** 创建操作返回 201，删除操作返回 204

#### Scenario: 错误响应

- **GIVEN** 请求失败
- **THEN** 返回对应 HTTP 状态码和 JSON:
  ```json
  {
    "code": "NOT_FOUND",
    "message": "Skill with id 'xxx' not found",
    "details": null
  }
  ```
- **AND** 错误码: NOT_FOUND / FORBIDDEN / VALIDATION_ERROR / CONFLICT

#### Scenario: 分页响应

- **GIVEN** 列表 API 请求 ?page=1&page_size=20
- **THEN** 返回:
  ```json
  {
    "items": [...],
    "total": 100,
    "page": 1,
    "page_size": 20,
    "total_pages": 5
  }
  ```
- **AND** page 最小 1，page_size 范围 1~100，默认 20

#### Scenario: API 文档

- **WHEN** 访问 /docs
- **THEN** 显示 FastAPI 自动生成的 Swagger UI

### Requirement: CORS 配置 [Phase 1 - 已实现]

#### Scenario: 跨域请求

- **THEN** 允许 CORS_ORIGINS 列表中的来源
- **AND** 允许所有 HTTP 方法和请求头
- **AND** 允许携带凭证

### Requirement: 数据库初始化 [Phase 1 - 已实现]

#### Scenario: 应用启动

- **WHEN** FastAPI lifespan 启动
- **THEN** 自动创建所有 ORM 表 (Base.metadata.create_all)
- **AND** 执行内置 Skill 播种
- **AND** 初始化基础 venv (预装常用 Python 包)
- **AND** 应用关闭时释放数据库连接

### Requirement: 中间结果清理 [Phase 2]

#### Scenario: 自动清理

- **GIVEN** CLEANUP_RETENTION_DAYS = 7
- **WHEN** 每日凌晨 2:00 执行清理任务
- **THEN** 删除超过 7 天且未标记 "保留" 的 Run 中间结果

### Requirement: 存储管理 [Phase 2]

#### Scenario: 查看存储状态

- **THEN** 显示: 总使用量、数据源文件占用、中间结果占用、可用空间

#### Scenario: 空间不足警告

- **WHEN** 可用空间低于 1GB
- **THEN** 界面顶部显示警告
