# 数据源管理与 Pipeline 执行引擎 — 实施任务清单

## 阶段一：数据源抽象层与 CRUD

### 1.1 DataSource 模型与 API

- [ ] 创建 `data_sources` 数据库表及 migration 脚本
- [ ] 创建 `data_source_files` 数据库表及 migration 脚本
- [ ] 实现 `DataSourceBackend` 抽象基类，定义 `list_files`、`read_file`、`write_file`、`delete_file`、`get_file_info` 方法
- [ ] 实现 DataSource Pydantic 模型（创建、更新、响应）
- [ ] 实现 DataSource CRUD API（`POST/GET/PUT/DELETE /data-sources`）
- [ ] 实现 DataSource 文件列表 API（`GET /data-sources/{id}/files`）
- [ ] 编写 DataSource CRUD 单元测试
- [ ] 编写 DataSource API 集成测试

### 1.2 本地文件存储后端

- [ ] 实现 `LocalFileBackend(DataSourceBackend)` 类
- [ ] 实现存储目录结构管理（按 data_source_id / 年 / 月 分目录）
- [ ] 实现文件 SHA-256 checksum 计算
- [ ] 编写 LocalFileBackend 单元测试

### 1.3 分片上传

- [ ] 实现上传 session 管理（创建、查询、过期检测）
- [ ] 实现 `POST /uploads/init` 接口（返回 upload_id 和协商的 chunk_size）
- [ ] 实现 `PUT /uploads/{id}/chunks/{index}` 接口（接收并暂存分片）
- [ ] 实现 `POST /uploads/{id}/complete` 接口（合并分片、校验 checksum、写入最终存储）
- [ ] 实现并发上传数限制（per-user 限流）
- [ ] 编写分片上传完整流程集成测试
- [ ] 编写异常场景测试（重复分片、乱序上传、session 过期）

### 1.4 Azure Blob Storage 后端

- [ ] 添加 `azure-storage-blob` 依赖到 `requirements.txt` / `pyproject.toml`
- [ ] 实现 `AzureBlobBackend(DataSourceBackend)` 类
- [ ] 支持 Connection String 认证方式
- [ ] 支持 SAS Token 认证方式
- [ ] 实现 `POST /data-sources/{id}/test-connection` 接口
- [ ] 实现凭据加密存储（AES-256 加密 config 中的敏感字段）
- [ ] 编写 AzureBlobBackend 单元测试（使用 mock）
- [ ] 编写集成测试（需要 Azure 测试账号或 Azurite 模拟器）

## 阶段二：Pipeline 执行引擎

### 2.1 执行数据模型

- [ ] 创建 `executions` 数据库表及 migration 脚本
- [ ] 创建 `execution_steps` 数据库表及索引和 migration 脚本
- [ ] 实现 Execution / ExecutionStep Pydantic 模型
- [ ] 实现执行状态机（pending -> running -> completed/failed/cancelled）

### 2.2 DAG 拓扑排序

- [ ] 实现 `topological_sort(dag)` 函数（Kahn's algorithm）
- [ ] 实现 `layered_topological_sort(dag)` 函数（支持同层并行）
- [ ] 实现循环依赖检测，抛出 `CyclicDependencyError`
- [ ] 从 Pipeline 定义构建 DAG 的适配逻辑
- [ ] 编写拓扑排序单元测试（线性、分支、菱形、环形 DAG）

### 2.3 同步执行模式（Sync Runner）

- [ ] 实现 `SyncRunner` 类
- [ ] 实现 per-document 循环执行逻辑
- [ ] 实现 per-step 上下文传递（前序节点输出作为后续节点输入）
- [ ] 实现全局超时控制（默认 300 秒）
- [ ] 实现 `continue_on_error` 配置支持
- [ ] 实现 `POST /executions` 接口（mode=sync，同步返回结果）
- [ ] 编写同步执行完整流程测试

### 2.4 异步执行模式（Async Runner）

- [ ] 实现 `AsyncRunner` 基类
- [ ] 实现 `AsyncIORunner(AsyncRunner)`（基于 asyncio task queue）
- [ ] 实现 `CeleryRunner(AsyncRunner)`（基于 Celery，可选）
- [ ] 实现执行后端配置切换（`EXECUTION_BACKEND` 环境变量）
- [ ] 实现 `POST /executions` 接口（mode=async，返回 202 Accepted）
- [ ] 实现 `DELETE /executions/{id}` 取消执行接口
- [ ] 实现同层节点并行执行（基于 layered topological sort）
- [ ] 编写异步执行完整流程测试
- [ ] 编写取消执行测试

### 2.5 执行查询与进度

- [ ] 实现 `GET /executions` 列表接口（支持分页、状态过滤）
- [ ] 实现 `GET /executions/{id}` 详情接口
- [ ] 实现 `GET /executions/{id}/progress` 进度汇总接口
- [ ] 编写进度查询接口测试

## 阶段三：中间结果管理

### 3.1 存储实现

- [ ] 创建 `intermediate_results` 数据库表及 migration 脚本
- [ ] 实现 `save_intermediate_result()` 函数（根据阈值自动选择 inline / file 存储）
- [ ] 实现 inline 存储逻辑（JSONB 写入数据库）
- [ ] 实现 file 存储逻辑（写入文件系统，数据库记录引用路径）
- [ ] 实现 `load_intermediate_result()` 函数（根据 storage_type 读取）
- [ ] 配置化 `INLINE_THRESHOLD`（默认 1 MB）
- [ ] 编写中间结果存储/读取单元测试

### 3.2 查询接口

- [ ] 实现 `GET /executions/{id}/results` 接口
- [ ] 支持按 `document_id` 筛选
- [ ] 支持按 `step_id` 筛选
- [ ] 支持 `format=summary` 和 `format=full` 两种返回模式
- [ ] 编写查询接口集成测试

## 阶段四：日志系统

### 4.1 结构化日志

- [ ] 定义 `ExecutionLogEntry` 模型（timestamp, level, execution_id, document_id, step_id, message, details）
- [ ] 创建 `execution_logs` 数据库表及索引和 migration 脚本
- [ ] 实现 `ExecutionLogger` 类，封装日志写入逻辑
- [ ] 在 Step Executor 中集成 ExecutionLogger，关键节点自动记录日志
- [ ] 编写日志写入单元测试

### 4.2 SSE 日志实时推送

- [ ] 实现 `GET /executions/{id}/logs?stream=true` SSE 端点
- [ ] 实现基于 `asyncio.Queue` 的日志通道（Step Executor 写入，SSE handler 消费）
- [ ] 实现客户端断开后的 Queue 清理逻辑，防止内存泄漏
- [ ] 支持 `Last-Event-ID` 头实现断线重连
- [ ] 实现非 SSE 模式的日志分页查询（`GET /executions/{id}/logs`）
- [ ] 编写 SSE 日志推送集成测试

## 阶段五：清理调度器

### 5.1 APScheduler 集成

- [ ] 添加 `apscheduler` 依赖
- [ ] 实现 `CleanupScheduler` 类，封装调度器初始化和任务注册
- [ ] 在应用启动时初始化调度器，关闭时优雅停止

### 5.2 清理任务实现

- [ ] 实现 `cleanup_expired_executions()` —— 清理过期执行记录及级联数据
- [ ] 实现 `cleanup_expired_intermediate_results()` —— 清理过期中间结果文件
- [ ] 实现 `cleanup_expired_logs()` —— 清理过期执行日志
- [ ] 实现 `cleanup_expired_uploads()` —— 清理过期分片上传临时文件
- [ ] 所有保留期通过环境变量可配置
- [ ] 编写清理任务单元测试（mock 时间验证清理边界）

## 阶段六：集成测试与文档

### 6.1 端到端测试

- [ ] 编写完整 E2E 测试：创建 DataSource -> 上传文件 -> 创建 Pipeline -> 同步执行 -> 查询结果
- [ ] 编写完整 E2E 测试：创建 DataSource -> 配置 Azure Blob -> 异步执行 -> SSE 监控日志 -> 查询中间结果
- [ ] 编写执行失败和重试场景测试
- [ ] 编写并发执行场景测试

### 6.2 API 文档

- [ ] 为所有新增 API 端点编写 OpenAPI 文档注释
- [ ] 补充请求/响应示例
- [ ] 编写错误码说明文档

### 6.3 配置文档

- [ ] 整理所有新增环境变量和默认值
- [ ] 编写部署配置指南（本地存储路径、Azure 配置、Celery broker 配置）
