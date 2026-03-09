## Context

Workflow 模型和 DataSource File Reader 已就绪。本变更实现执行引擎，将文件从 DataSource 路由到 Pipeline 处理。

## Goals / Non-Goals

**Goals:**
- WorkflowRun / PipelineRun 数据模型
- 路由匹配引擎（按 priority 排序，逐条匹配 file_filter）
- 同步执行模式（HTTP 请求等待完成）
- API 端点：触发执行、查询运行列表和详情
- 前端：运行按钮 + 运行状态查看

**Non-Goals:**
- 异步执行模式（后台任务 + 轮询）暂不实现
- Target 写入暂不实现（执行到 Pipeline 输出为止）
- 增量处理（Change 4）

## Decisions

### 1. WorkflowRun 和 PipelineRun 为独立模型

不复用现有 Run 模型，因为 WorkflowRun 包含多个 PipelineRun 子记录。

### 2. 路由匹配逻辑简洁实现

按 routes 的 priority 排序，对每个文件逐条检查 file_filter（extensions/mime_types/size_range/path_pattern），命中即停止。未匹配文件归入 default_route。

### 3. 同步执行优先

第一版只实现同步执行模式。异步模式和 Target 写入留给后续迭代。

## Risks / Trade-offs

- **[执行超时]** → 设置全局超时（使用 config.sync_execution_timeout_s）
- **[大文件内存]** → 当前 read_file 返回 bytes，大文件可能消耗内存。后续优化为流式处理。
