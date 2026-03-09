## Context

Workflow 路由机制已实现（Change 1 + Change 3）。DataSource 和 Target 上残留的 pipeline_id FK 已无业务含义。需要清理旧 FK 并添加增量处理能力。

## Goals / Non-Goals

**Goals:**
- 移除 DataSource.pipeline_id FK 约束（保留列兼容旧数据，标记为 deprecated）
- 移除 Target.pipeline_id FK 约束（同上）
- 新增 ProcessedFile 模型记录处理状态
- WorkflowExecutor 支持增量处理（只处理新增/变更文件）

**Non-Goals:**
- 不删除 pipeline_id 列本身（避免破坏现有数据）
- 不修改 Pipeline 模型

## Decisions

### 1. 保留 pipeline_id 列但移除 FK

SQLite 不支持 DROP FOREIGN KEY。我们在 ORM 层移除 ForeignKey 声明，migration 中对新环境跳过创建 FK。旧环境的 FK 仍存在但不影响功能。

### 2. ProcessedFile 表设计

| 列 | 类型 | 说明 |
|---|------|------|
| id | String (UUID) | 主键 |
| workflow_id | String FK | 关联 Workflow |
| data_source_id | String | DataSource ID |
| file_path | String | 文件路径 |
| file_etag | String | 文件内容标识 |
| processed_at | DateTime | 处理时间 |

唯一约束: (workflow_id, data_source_id, file_path)

### 3. 增量逻辑

执行时，对每个文件查找 processed_files 表：
- 如果 (workflow_id, ds_id, file_path) 不存在 → 需处理
- 如果存在但 etag 不同 → 需处理
- 如果存在且 etag 相同 → 跳过

## Risks / Trade-offs

- **[旧数据兼容]** → pipeline_id 列保留，只是不再用于路由
- **[SQLite FK 限制]** → 无法真正 DROP FK，但 ORM 层不声明即可
