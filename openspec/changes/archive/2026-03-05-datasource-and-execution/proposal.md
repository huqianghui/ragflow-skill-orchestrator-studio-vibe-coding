# 数据源管理与 Pipeline 执行引擎

## 变更编号

`datasource-and-execution`

## 问题描述

当前系统缺乏统一的数据源管理能力和 Pipeline 执行引擎。具体痛点如下：

1. **数据源接入单一**：用户无法灵活选择数据来源，需要同时支持本地文件上传和云端存储（如 Azure Blob Storage）两种模式。
2. **缺少执行引擎**：Pipeline 定义完成后，没有可靠的执行机制来驱动数据流经各个 Skill 节点，也不支持同步/异步两种执行模式。
3. **执行过程不可观测**：缺乏结构化日志和中间结果记录，用户无法追踪每个文档在每个步骤的处理状态。
4. **中间结果无法复用**：Pipeline 中间步骤的输出没有持久化，导致调试困难、无法断点续跑。

## 解决方案

实现以下四个核心模块：

### 1. DataSource CRUD 与文件管理

- 抽象 DataSource 层，统一本地文件和 Azure Blob 的操作接口
- 本地文件支持分片上传（chunked upload），适配大文件场景
- Azure Blob Storage 通过 `azure-storage-blob` SDK 集成，支持 SAS Token 和 Connection String 两种认证方式
- DataSource 元数据持久化到数据库，文件内容按策略存储

### 2. Pipeline 执行引擎

- **同步模式（Sync）**：在请求上下文中顺序执行，适用于小规模数据和调试场景
- **异步模式（Async）**：通过 Celery 或 asyncio task queue 提交后台任务，适用于生产环境批量处理
- 基于 DAG 拓扑排序确定 Skill 节点执行顺序
- 支持 per-document、per-step 粒度的结果追踪

### 3. 中间结果管理

- 小体量结果（< 1MB）以 JSON 格式存入数据库
- 大体量结果写入文件系统或对象存储，数据库仅记录引用路径
- 提供查询接口，支持按 execution_id / document_id / step_id 检索

### 4. 日志与清理

- 结构化日志（structured logging），统一 JSON 格式输出
- 通过 SSE（Server-Sent Events）实时推送执行日志到前端
- 基于 APScheduler 的定时清理调度器，自动回收过期中间结果和日志

## 影响范围

| 维度 | 说明 |
|------|------|
| 数据流 | 打通数据输入到处理流程的完整链路 |
| API 层 | 新增 DataSource、Execution、Log 三组 REST API |
| 数据库 | 新增 `data_sources`、`executions`、`execution_steps`、`intermediate_results`、`execution_logs` 表 |
| 依赖 | 新增 `azure-storage-blob`、`celery`（可选）、`apscheduler` |
| 前端 | 需配合实现数据源配置面板、执行监控面板、日志查看器 |

## 与其他变更的关系

- 依赖 `pipeline-and-skill` 变更提供的 Pipeline / Skill 模型定义
- 为后续 `monitoring-and-optimization` 变更提供执行数据基础
