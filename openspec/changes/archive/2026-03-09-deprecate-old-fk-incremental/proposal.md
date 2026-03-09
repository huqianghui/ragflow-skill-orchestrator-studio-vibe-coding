## Why

DataSource.pipeline_id 和 Target.pipeline_id 这两个旧 FK 已被 Workflow 路由机制取代。Workflow 的 routes 和 default_route 中直接包含 pipeline_id 和 target_ids，不再需要 DataSource/Target 与 Pipeline 之间的直接外键关联。

同时，需要新增增量处理支持：记录已处理文件的状态（etag），使得重复执行 Workflow 时只处理新增或变更的文件。

## What Changes

- 废弃 DataSource.pipeline_id 和 Target.pipeline_id（保留列但不再使用 FK）
- 新增 processed_files 表（workflow_id, data_source_id, file_path, etag, processed_at）
- WorkflowExecutor 在执行前比对 processed_files 表，只处理增量文件
- 前端 DataSource/Target 表单移除 Pipeline 关联选项

## Capabilities

### Modified Capabilities

- `data-sources`: 移除 pipeline_id 字段的 FK 约束
- `targets`: 移除 pipeline_id 字段的 FK 约束
- `workflow-runs`: 增量处理逻辑

## Impact

- **数据库**: 移除 2 个 FK 约束，新增 processed_files 表
- **后端**: 修改 WorkflowExecutor 加入增量逻辑
- **前端**: 简化 DataSource/Target 创建表单
