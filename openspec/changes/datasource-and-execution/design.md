# 数据源管理与 Pipeline 执行引擎 — 技术设计

## 1. 数据源抽象层（DataSource Abstraction Layer）

### 1.1 统一接口定义

所有数据源实现统一的抽象接口，屏蔽底层存储差异：

```python
class DataSourceBackend(ABC):
    """数据源后端抽象基类"""

    @abstractmethod
    async def list_files(self, prefix: str = "") -> List[FileInfo]:
        """列出数据源中的文件"""
        ...

    @abstractmethod
    async def read_file(self, file_path: str) -> AsyncIterator[bytes]:
        """流式读取文件内容"""
        ...

    @abstractmethod
    async def write_file(self, file_path: str, data: AsyncIterator[bytes]) -> FileInfo:
        """写入文件"""
        ...

    @abstractmethod
    async def delete_file(self, file_path: str) -> None:
        """删除文件"""
        ...

    @abstractmethod
    async def get_file_info(self, file_path: str) -> FileInfo:
        """获取文件元信息"""
        ...
```

### 1.2 DataSource 数据模型

```sql
CREATE TABLE data_sources (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    type          VARCHAR(50)  NOT NULL,  -- 'local' | 'azure_blob'
    config        JSONB        NOT NULL,  -- 后端特定配置（加密存储）
    description   TEXT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE data_source_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id  UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    file_path       VARCHAR(1024) NOT NULL,
    file_name       VARCHAR(255)  NOT NULL,
    file_size       BIGINT        NOT NULL,
    content_type    VARCHAR(255),
    checksum_sha256 VARCHAR(64),
    storage_path    VARCHAR(1024),  -- 实际存储路径
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(data_source_id, file_path)
);
```

## 2. 本地文件上传（Local File Upload）

### 2.1 分片上传流程（Chunked Upload）

针对大文件场景，采用分片上传策略：

```
客户端                          服务端
  |                               |
  |-- POST /uploads/init -------->|  创建 upload session
  |<-- { upload_id, chunk_size } -|
  |                               |
  |-- PUT /uploads/{id}/chunks/0 ->|  上传第 1 片
  |<-- { status: "received" } ----|
  |                               |
  |-- PUT /uploads/{id}/chunks/1 ->|  上传第 2 片
  |<-- { status: "received" } ----|
  |         ...                   |
  |-- POST /uploads/{id}/complete->|  合并分片、校验 checksum
  |<-- { file_id, file_info } ----|
```

**关键参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `chunk_size` | 5 MB | 每片大小，客户端可协商 |
| `max_file_size` | 2 GB | 单文件上限 |
| `upload_timeout` | 3600s | Session 过期时间，过期自动清理 |
| `max_concurrent_uploads` | 10 | 单用户并发上传数 |

### 2.2 存储策略

```
storage_root/
├── uploads/           # 分片临时目录
│   └── {upload_id}/
│       ├── chunk_0
│       ├── chunk_1
│       └── ...
└── files/             # 合并后的最终文件
    └── {data_source_id}/
        └── {year}/{month}/
            └── {file_id}_{original_name}
```

- 分片临时文件在合并完成或 session 过期后清理
- 最终文件按 data_source_id 和日期分目录存放，避免单目录文件过多

## 3. Azure Blob Storage 集成

### 3.1 认证方式

支持两种认证模式，配置存储在 `data_sources.config` 字段（加密）：

```python
# 方式一：Connection String
azure_config_conn_str = {
    "auth_type": "connection_string",
    "connection_string": "DefaultEndpointsProtocol=https;AccountName=...",
    "container_name": "ragflow-data"
}

# 方式二：SAS Token
azure_config_sas = {
    "auth_type": "sas_token",
    "account_url": "https://<account>.blob.core.windows.net",
    "sas_token": "sv=2022-11-02&ss=b&srt=sco&sp=rwdlac...",
    "container_name": "ragflow-data"
}
```

### 3.2 Backend 实现要点

- 使用 `azure-storage-blob` SDK 的异步客户端 `BlobServiceClient`
- 文件列表通过 `ContainerClient.list_blobs(name_starts_with=prefix)` 实现
- 大文件下载使用 `BlobClient.download_blob()` 的 chunks 迭代器，避免内存溢出
- 上传使用 `BlobClient.upload_blob(data, overwrite=True)`，SDK 内部自动处理分块
- Connection String 和 SAS Token 存入数据库前使用 AES-256 加密

### 3.3 连接测试

提供 `POST /data-sources/{id}/test-connection` 接口，验证：

1. 认证凭据有效性
2. Container 是否存在且可访问
3. 读写权限检查（尝试写入并删除临时 blob）

## 4. Pipeline 执行引擎架构

### 4.1 整体架构

```
                    ┌──────────────┐
                    │  REST API    │
                    │  /executions │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Execution   │
                    │  Manager     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──┐  ┌──────▼──┐  ┌─────▼────┐
       │  Sync   │  │  Async  │  │  DAG     │
       │  Runner │  │  Runner │  │  Resolver│
       └────┬────┘  └────┬────┘  └──────────┘
            │             │
       ┌────▼─────────────▼────┐
       │    Step Executor      │
       │  (per-document loop)  │
       └────┬──────────────────┘
            │
  ┌─────────┼──────────┐
  │         │          │
  ▼         ▼          ▼
Skill A   Skill B   Skill C
```

### 4.2 执行数据模型

```sql
-- 执行记录主表
CREATE TABLE executions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id    UUID NOT NULL REFERENCES pipelines(id),
    data_source_id UUID NOT NULL REFERENCES data_sources(id),
    mode           VARCHAR(20) NOT NULL,  -- 'sync' | 'async'
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- pending | running | completed | failed | cancelled
    config         JSONB DEFAULT '{}',    -- 执行参数覆盖
    started_at     TIMESTAMP WITH TIME ZONE,
    finished_at    TIMESTAMP WITH TIME ZONE,
    error_message  TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 每步执行记录
CREATE TABLE execution_steps (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id   UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    skill_node_id  VARCHAR(255) NOT NULL,  -- Pipeline DAG 中的节点 ID
    document_id    UUID,                    -- 关联的文档（per-document 粒度）
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
    input_ref      VARCHAR(1024),          -- 输入数据引用
    output_ref     VARCHAR(1024),          -- 输出数据引用
    started_at     TIMESTAMP WITH TIME ZONE,
    finished_at    TIMESTAMP WITH TIME ZONE,
    duration_ms    INTEGER,
    error_message  TEXT,
    retry_count    INTEGER DEFAULT 0
);
CREATE INDEX idx_exec_steps_execution ON execution_steps(execution_id);
CREATE INDEX idx_exec_steps_document  ON execution_steps(execution_id, document_id);
```

### 4.3 同步模式（Sync Mode）

同步模式在 HTTP 请求上下文中直接执行，适用于：

- 少量文档（< 10 个）的快速测试
- 调试单个 Skill 节点
- 前端 "立即执行并等待" 场景

```python
async def run_sync(execution_id: UUID) -> ExecutionResult:
    execution = await load_execution(execution_id)
    dag = build_dag(execution.pipeline)
    sorted_nodes = topological_sort(dag)

    for document in execution.documents:
        context = DocumentContext(document)
        for node in sorted_nodes:
            step = await create_step(execution_id, node, document)
            try:
                result = await node.skill.execute(context)
                await save_intermediate_result(step, result)
                context.update(node.id, result)
                await mark_step_completed(step)
            except Exception as e:
                await mark_step_failed(step, e)
                if not node.continue_on_error:
                    raise

    return await finalize_execution(execution_id)
```

**超时控制**：同步模式设置全局 timeout（默认 300 秒），超时后返回 `408 Request Timeout`。

### 4.4 异步模式（Async Mode）

异步模式将任务提交到后台队列，适用于：

- 大批量文档处理
- 长时间运行的 Pipeline
- 生产环境常规执行

**方案选型：**

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| Celery + Redis | 成熟稳定、支持重试/优先级 | 部署复杂度高 | 生产环境 |
| asyncio task queue | 轻量、无额外依赖 | 单进程、无持久化 | 开发/小规模 |

系统默认使用 asyncio task queue，可通过配置切换到 Celery：

```python
# config.py
EXECUTION_BACKEND = os.getenv("EXECUTION_BACKEND", "asyncio")  # "asyncio" | "celery"
```

异步模式 API 交互流程：

```
POST /executions  { mode: "async", ... }
  -> 202 Accepted  { execution_id, status: "pending" }

GET /executions/{id}
  -> 200 OK  { status: "running", progress: { completed: 5, total: 20 } }

GET /executions/{id}/logs?stream=true
  -> 200 OK  (SSE stream)

DELETE /executions/{id}
  -> 200 OK  { status: "cancelled" }
```

### 4.5 DAG 拓扑排序

Pipeline 中 Skill 节点之间存在依赖关系，执行前需通过拓扑排序确定执行顺序：

```python
def topological_sort(dag: Dict[str, List[str]]) -> List[str]:
    """
    Kahn's algorithm 实现拓扑排序。
    dag: { node_id: [dependency_node_ids] }
    返回: 按执行顺序排列的 node_id 列表
    抛出: CyclicDependencyError 如果检测到环
    """
    in_degree = {node: 0 for node in dag}
    for node, deps in dag.items():
        for dep in deps:
            in_degree[node] += 1

    queue = deque([n for n, d in in_degree.items() if d == 0])
    result = []

    while queue:
        node = queue.popleft()
        result.append(node)
        for candidate, deps in dag.items():
            if node in deps:
                in_degree[candidate] -= 1
                if in_degree[candidate] == 0:
                    queue.append(candidate)

    if len(result) != len(dag):
        raise CyclicDependencyError("Pipeline DAG 中存在循环依赖")

    return result
```

**并行优化**：同一拓扑层级内无依赖的节点可并行执行，通过分层拓扑排序实现：

```python
def layered_topological_sort(dag) -> List[List[str]]:
    """返回分层结果，同层节点可并行执行"""
    ...
```

### 4.6 Per-Document Per-Step 结果追踪

每个文档在每个 Skill 节点的执行结果独立追踪：

```
Execution #1
├── Document A
│   ├── Step: chunking     -> completed (1.2s)
│   ├── Step: embedding    -> completed (3.5s)
│   └── Step: indexing     -> completed (0.8s)
├── Document B
│   ├── Step: chunking     -> completed (0.9s)
│   ├── Step: embedding    -> failed (timeout)
│   └── Step: indexing     -> skipped
└── Document C
    ├── Step: chunking     -> running...
    └── ...
```

进度汇总 API：

```json
GET /executions/{id}/progress

{
    "total_documents": 3,
    "completed_documents": 1,
    "failed_documents": 1,
    "running_documents": 1,
    "steps_summary": {
        "chunking":  { "completed": 3, "failed": 0, "pending": 0 },
        "embedding": { "completed": 1, "failed": 1, "pending": 1 },
        "indexing":  { "completed": 1, "failed": 0, "pending": 2 }
    }
}
```

## 5. 中间结果存储（Intermediate Result Storage）

### 5.1 存储策略

根据结果体量选择存储方式：

```python
INLINE_THRESHOLD = 1 * 1024 * 1024  # 1 MB

async def save_intermediate_result(step: ExecutionStep, result: Any) -> str:
    serialized = json.dumps(result, ensure_ascii=False)

    if len(serialized.encode("utf-8")) <= INLINE_THRESHOLD:
        # 小结果：直接存入数据库 JSONB 字段
        ref = f"db://{step.id}"
        await store_inline(step.id, serialized)
    else:
        # 大结果：写入文件系统，数据库记录引用路径
        path = f"intermediate/{step.execution_id}/{step.id}.json"
        ref = f"file://{path}"
        await store_to_filesystem(path, serialized)

    return ref
```

### 5.2 数据模型

```sql
CREATE TABLE intermediate_results (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_step_id UUID NOT NULL REFERENCES execution_steps(id) ON DELETE CASCADE,
    storage_type      VARCHAR(20) NOT NULL,  -- 'inline' | 'file'
    inline_data       JSONB,                  -- storage_type='inline' 时使用
    file_path         VARCHAR(1024),          -- storage_type='file' 时使用
    size_bytes        BIGINT NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX idx_ir_step ON intermediate_results(execution_step_id);
```

### 5.3 查询接口

```
GET /executions/{execution_id}/results
    ?document_id=xxx          # 按文档筛选
    &step_id=xxx              # 按步骤筛选
    &format=summary|full      # summary 只返回元信息，full 返回数据内容
```

## 6. 日志架构（Logging Architecture）

### 6.1 结构化日志格式

所有执行日志统一为 JSON 格式：

```json
{
    "timestamp": "2026-03-05T10:30:15.123Z",
    "level": "INFO",
    "execution_id": "uuid-xxx",
    "document_id": "uuid-yyy",
    "step_id": "chunking",
    "message": "文档分片完成",
    "details": {
        "chunk_count": 42,
        "avg_chunk_size": 512
    }
}
```

### 6.2 日志存储

```sql
CREATE TABLE execution_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id  UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    document_id   UUID,
    step_id       VARCHAR(255),
    level         VARCHAR(10) NOT NULL,  -- DEBUG | INFO | WARN | ERROR
    message       TEXT NOT NULL,
    details       JSONB,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX idx_logs_execution ON execution_logs(execution_id, created_at);
```

### 6.3 SSE 日志实时推送

通过 Server-Sent Events 向前端推送实时日志流：

```
GET /executions/{id}/logs?stream=true

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

event: log
data: {"level":"INFO","message":"开始执行 Pipeline...","timestamp":"..."}

event: log
data: {"level":"INFO","message":"处理文档 A - chunking 完成","timestamp":"..."}

event: progress
data: {"completed":1,"total":20}

event: done
data: {"status":"completed"}
```

实现要点：

- 使用 `asyncio.Queue` 作为日志通道，Step Executor 写入，SSE handler 消费
- 客户端断开后自动清理 Queue，避免内存泄漏
- 支持 `Last-Event-ID` 头实现断线重连

## 7. 清理调度器（Cleanup Scheduler）

### 7.1 清理策略

| 对象 | 默认保留期 | 配置项 |
|------|-----------|--------|
| 执行记录 | 30 天 | `EXECUTION_RETENTION_DAYS` |
| 中间结果 | 7 天 | `INTERMEDIATE_RESULT_RETENTION_DAYS` |
| 执行日志 | 14 天 | `EXECUTION_LOG_RETENTION_DAYS` |
| 分片上传临时文件 | 1 小时 | `UPLOAD_SESSION_TIMEOUT` |

### 7.2 APScheduler 集成

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()

# 每天凌晨 2:00 清理过期执行记录和中间结果
scheduler.add_job(
    cleanup_expired_executions,
    CronTrigger(hour=2, minute=0),
    id="cleanup_executions",
    replace_existing=True
)

# 每小时清理过期的分片上传 session
scheduler.add_job(
    cleanup_expired_uploads,
    CronTrigger(minute=0),
    id="cleanup_uploads",
    replace_existing=True
)

scheduler.start()
```

### 7.3 清理流程

```python
async def cleanup_expired_executions():
    cutoff = datetime.utcnow() - timedelta(days=EXECUTION_RETENTION_DAYS)

    # 1. 查找过期执行
    expired = await db.fetch(
        "SELECT id FROM executions WHERE created_at < $1", cutoff
    )

    for execution in expired:
        # 2. 删除文件系统中的中间结果
        await cleanup_intermediate_files(execution.id)
        # 3. 级联删除数据库记录（execution_steps, intermediate_results, execution_logs）
        await db.execute(
            "DELETE FROM executions WHERE id = $1", execution.id
        )

    logger.info(f"清理了 {len(expired)} 条过期执行记录")
```

## 8. API 总览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/data-sources` | 创建数据源 |
| GET | `/data-sources` | 列出数据源 |
| GET | `/data-sources/{id}` | 获取数据源详情 |
| PUT | `/data-sources/{id}` | 更新数据源 |
| DELETE | `/data-sources/{id}` | 删除数据源 |
| POST | `/data-sources/{id}/test-connection` | 测试连接 |
| GET | `/data-sources/{id}/files` | 列出数据源文件 |
| POST | `/uploads/init` | 初始化分片上传 |
| PUT | `/uploads/{id}/chunks/{index}` | 上传分片 |
| POST | `/uploads/{id}/complete` | 完成上传 |
| POST | `/executions` | 创建并启动执行 |
| GET | `/executions` | 列出执行记录 |
| GET | `/executions/{id}` | 获取执行详情 |
| DELETE | `/executions/{id}` | 取消执行 |
| GET | `/executions/{id}/progress` | 获取执行进度 |
| GET | `/executions/{id}/results` | 获取中间结果 |
| GET | `/executions/{id}/logs` | 获取日志（支持 SSE） |
