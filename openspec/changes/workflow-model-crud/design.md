## Context

现有系统中 DataSource、Pipeline、Target 三个模块各自独立运作。DataSource 管理数据源连接与文件上传；Pipeline 通过 Skill 节点链编排数据处理流程；Target 定义输出目标（AI Search、Blob 等）。三者之间缺少一个编排层来定义"哪些文件经过哪个 Pipeline 写入哪些 Target"的路由逻辑。

本变更为端到端串联的第一步——建立 Workflow 实体的数据模型和 CRUD 基础设施。后续 Change 将在此基础上实现文件读取、执行引擎和增量处理。

## Goals / Non-Goals

**Goals:**

- 定义 Workflow 数据模型，存储路由规则（按文件扩展名/MIME/大小/路径模式过滤）
- 实现完整的 CRUD API（创建、列表、详情、更新、删除）
- 提供前端 Workflows 管理页面（列表 + 创建/编辑表单）
- 新增 Alembic migration 并保持与 init migration 同步
- 新增后端单元测试

**Non-Goals:**

- 不实现 Workflow 执行引擎（Change 3）
- 不实现 DataSource 文件读取（Change 2）
- 不实现 WorkflowRun / PipelineRun 模型（Change 3）
- 不废弃旧 FK（DataSource.pipeline_id / Target.pipeline_id）（Change 4）
- 不实现增量处理（Change 4）

## Decisions

### 1. Workflow 模型使用 JSON 字段存储路由规则

**决策**: `routes` 和 `default_route` 使用 JSON 列，`data_source_ids` 也用 JSON 列。

**理由**: 路由规则结构灵活、嵌套较深（file_filter 含 extensions、mime_types、size_range、path_pattern），使用关系表会导致 schema 过度复杂化。JSON 列在 SQLite 下也有良好支持，且 Pydantic 可以在 API 层做完整的结构校验。

**替代方案**: 为 Route 创建独立的关系表。缺点是增加表数量和查询复杂度，而路由规则不需要独立查询。

### 2. 路由匹配采用优先级排序

**决策**: 每条 Route 有 `priority` 字段（整数，值越小优先级越高），文件按优先级逐条匹配，命中第一条即停止。

**理由**: 简单直观，用户可以精确控制匹配顺序。默认路由（`default_route`）作为兜底，独立于 routes 数组存储。

### 3. 前端采用 Modal 表单而非独立编辑页

**决策**: Workflow 创建/编辑使用 Ant Design Modal，不新增独立路由页面。

**理由**: Workflow 的字段不多（name、description、status + 路由配置），Modal 足够承载。路由规则编辑器可以后续迭代为更复杂的可视化组件。与现有 Connections、DataSources 的 Modal 模式一致。

### 4. 复用现有 CRUD 代码模式

**决策**: 完全复用 Pipeline 模块的 CRUD 代码模式（路由、分页、异常处理）。

**理由**: 保持代码一致性，降低维护成本。

## Risks / Trade-offs

- **[JSON 列不可索引]** → routes 数据只在 API 层解析，不做数据库级过滤。Workflow 数量预期不大，全量返回后前端/业务层过滤即可。
- **[data_source_ids 可能引用不存在的 DataSource]** → API 层在创建/更新时校验引用完整性。
- **[pipeline_id / target_ids 在 Route 中可能引用不存在的实体]** → 同上，API 层校验。
