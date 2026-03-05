# System Module Specification

## Overview

系统模块涵盖全局性功能：健康检查、配置管理、中间结果清理策略、存储管理。MVP 阶段为单用户无认证模式。

---

## REQ-SYS-001: 健康检查

**Requirement:** 系统应提供健康检查端点，供监控和部署使用。

### Scenario: 健康检查成功

```
GIVEN 系统正常运行
WHEN 访问 GET /health
THEN 返回 200:
  {
    "status": "ok",
    "version": "0.1.0",
    "database": "connected",
    "uptime_seconds": 3600,  // [Phase 2]
    "storage": "available"   // [Phase 2]
  }
```

### Scenario: 健康检查部分失败

```
GIVEN 数据库连接异常
WHEN 访问 GET /health
THEN 返回 503:
  {
    "status": "degraded",
    "version": "0.1.0",
    "database": "disconnected",
    "storage": "available",  // [Phase 2]
    "errors": ["Database connection failed: timeout"]  // [Phase 2]
  }
```

---

## REQ-SYS-002: 配置管理

**Requirement:** 系统通过配置文件和环境变量管理运行时配置。

### Scenario: 加载配置

```
GIVEN 系统启动
WHEN 加载配置
THEN 按以下优先级读取配置:
  1. 环境变量 (最高优先级)
  2. config.yaml 配置文件
  3. 默认值
AND 配置项包括:
  - SERVER_HOST (默认 0.0.0.0)
  - SERVER_PORT (默认 8000)
  - DATABASE_URL (默认 sqlite:///./data/app.db)
  - STORAGE_PATH (默认 ./data/storage)
  - MAX_UPLOAD_SIZE_MB (默认 100)
  - SYNC_EXECUTION_TIMEOUT_S (默认 300)
  - CLEANUP_RETENTION_DAYS (默认 7)
  - LOG_LEVEL (默认 INFO)
```

### Scenario: 查看当前配置

```
GIVEN 系统已启动
WHEN 访问 GET /api/system/config
THEN 返回当前生效的配置（敏感信息如 API Key 脱敏显示）
```

---

## REQ-SYS-003: 中间结果清理策略

**Requirement:** 系统支持自动和手动清理 Pipeline 运行的中间结果。

### Scenario: 配置自动清理

```
GIVEN 管理员设置 CLEANUP_RETENTION_DAYS = 7
WHEN 清理任务执行 (每日凌晨 2:00)
THEN 系统扫描所有 Run:
  - finished_at 超过 7 天
  - 未被标记为 "保留"
AND 删除这些 Run 的中间结果数据 (input_data, output_data)
AND 保留 Run 元数据和 StepResult 摘要
AND 记录清理日志: "已清理 N 个 Run 的中间结果, 释放 X MB"
```

### Scenario: 手动触发清理

```
GIVEN 用户在系统管理页面
WHEN 用户点击 "立即清理" 并指定清理范围
THEN 系统执行清理
AND 返回清理结果摘要
```

### Scenario: 标记 Run 为保留

```
GIVEN 一个已完成的 Run
WHEN 用户点击 "保留此运行"
THEN 该 Run 标记为 retained = true
AND 自动清理策略跳过此 Run
```

---

## REQ-SYS-004: 存储管理

**Requirement:** 系统管理本地文件存储空间。

### Scenario: 查看存储状态

```
GIVEN 用户访问系统管理页面
WHEN 点击存储管理
THEN 显示:
  - 总存储使用量
  - 数据源文件占用
  - 中间结果占用
  - 可用空间
```

### Scenario: 存储空间不足警告

```
GIVEN 可用存储空间低于 1GB
WHEN 系统检测到空间不足
THEN 在界面顶部显示警告
AND 记录 WARN 日志
AND 建议用户清理中间结果或删除不需要的数据源
```

---

## REQ-SYS-005: API 通用规范

**Requirement:** 所有 API 遵循统一规范。

### Scenario: API 响应格式

```
GIVEN 任何 API 请求
WHEN 请求成功
THEN 返回:
  {
    "code": 200,
    "data": { ... },
    "message": "success"
  }

WHEN 请求失败
THEN 返回:
  {
    "code": 4xx/5xx,
    "data": null,
    "message": "错误描述",
    "details": { ... }  // 可选的详细错误信息
  }
```

### Scenario: 分页请求

```
GIVEN 列表类 API
WHEN 请求包含分页参数: page=1&page_size=20
THEN 返回:
  {
    "code": 200,
    "data": {
      "items": [...],
      "total": 100,
      "page": 1,
      "page_size": 20,
      "total_pages": 5
    }
  }
```

### Scenario: API 文档

```
GIVEN 系统启动
WHEN 访问 /docs
THEN 显示 Swagger UI (由 FastAPI 自动生成)
AND 所有 API 端点都有描述和示例
```
