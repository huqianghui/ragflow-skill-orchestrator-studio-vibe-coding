# Roadmap

项目路线图 — 已完成的里程碑和未来方向。

## 已完成的里程碑

### M1: 基础骨架 (2026-03-05)
- 项目初始化、FastAPI + React 基础架构
- Skill 管理（CRUD、内置播种、Python 执行引擎）
- Connection 管理（加密存储、连通性测试）
- Pipeline 编排（节点管理、Enrichment Tree、Debug 模式）

### M2: 数据摄取 (2026-03-07)
- 16 种 DataSource 类型（本地上传、Azure Blob、AWS S3 等）
- 6 种 Target 输出（AI Search、Blob、CosmosDB、Neo4j、MySQL、PostgreSQL）
- Builtin Skill 执行引擎（Azure AI Language/Vision/OpenAI/Document Intelligence）
- Frontend UI 全面翻新（统一表格、手风琴布局、主题系统）

### M3: Agent 集成 (2026-03-08)
- Agent 后端（注册发现、Session 管理、WebSocket 通信）
- Agent Playground（交互式对话、消息持久化）
- Agent History（Session 列表、Detail Modal、搜索过滤）
- Playwright E2E 测试框架

### M4: Workflow 编排 (2026-03-09)
- Workflow CRUD + 路由规则
- DataSource File Reader（文件枚举）
- WorkflowRun + PipelineRun 执行引擎
- 增量处理（etag 检测）
- Dashboard 聚合统计
- Pipeline Runs 统一视图

### M5: 可视化编辑器 (2026-03-10)
- Workflow Flow Editor（React Flow 画布）
- 4 种节点类型（Router、DataSource、Pipeline、Target）
- 资源选择器、节点配置面板
- Pipeline 验证端点
- 24 个 Workflow Editor E2E 测试

## 未来方向

### 近期 (计划中)

| 方向 | 说明 | 状态 |
|------|------|------|
| 异步执行模式 | 大批量文件处理的后台任务队列 | 待设计 |
| Workflow 模板 | 预置常见编排模板（HR 培训、文档索引等） | 待设计 |
| 多模态 Pipeline | 图片/视频/音频在 Pipeline 内透明分流 | 待设计 |
| BlobUploader Skill | 内置 Skill 支持二进制文件上传到 Blob | 待设计 |

### 中期

| 方向 | 说明 |
|------|------|
| 认证系统 | 从 MVP 单用户模式升级到多用户认证 |
| PostgreSQL 支持 | 从 SQLite 切换到 PostgreSQL |
| Webhook / 事件驱动 | DataSource 变更自动触发 Workflow |
| 监控仪表板增强 | 实时执行进度、资源使用统计 |

### 远期

| 方向 | 说明 |
|------|------|
| 分布式执行 | 多节点并行处理大规模文件 |
| 插件市场 | 社区贡献 Skill / Pipeline 模板 |
| API Gateway | Rate limiting、API Key 管理 |

> 详细进度跟踪见 [GitHub Projects](../../projects)
