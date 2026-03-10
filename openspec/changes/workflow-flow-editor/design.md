## Context

Workflow 当前通过 720px Modal 弹窗配置（`Workflows.tsx`），使用 Form.List 动态管理路由 Card。Pipeline 已有成熟的 React Flow 画布编辑器（`PipelineEditor.tsx`，约 1700 行），支持拖放添加节点、连线、右侧栏配置、Agent 助手。两者交互体验差异大。

现有 Workflow 数据模型使用 `data_source_ids`、`routes`、`default_route` 三个独立 JSON 字段，后端执行引擎（`workflow_executor.py`）依赖这些字段做路由匹配和增量处理。

## Goals / Non-Goals

**Goals:**
- 新增 WorkflowEditor 页面，使用 React Flow 画布编辑 Workflow 路由拓扑
- 支持 4 种节点类型：DataSource、Router、Pipeline、Target，从左到右布局
- 支持拖放 + 点击两种添加节点方式
- 保存时自动从 graph 同步生成 routes/data_source_ids/default_route，后端执行引擎零改动
- 已有无 graph_data 的 Workflow 首次打开编辑器时自动从 routes 反推生成初始 graph

**Non-Goals:**
- 不改造后端执行引擎（继续读 routes 字段）
- 不做 Workflow 的 Debug 模式（与 PipelineEditor 的 Debug Mode 不同，Workflow 的运行结果在 WorkflowRunHistory 页面查看）
- 不做画布上的 Workflow 运行触发（保留在列表页）
- 不废弃现有 Modal（保留作为快速创建入口，只填 name + description）

## Decisions

### D1: 渐进式 graph_data 字段

**选择**: 给 Workflow 模型新增 `graph_data` JSON 字段，保留原有 `routes`/`data_source_ids`/`default_route` 字段。保存时前端从 graph 推导出这三个字段一起发给后端。

**替代方案**: 完全用 graph_data 替代三个字段，后端执行引擎也从 graph 解析。

**理由**: 渐进式方案后端零改动、向后兼容、已有 Workflow 数据不受影响。执行引擎稳定性不会因 UI 重构受影响。

### D2: 显式存储边（Edges）

**选择**: Workflow 的 graph_data 中边是显式存储的 `{id, source, target}`。

**替代方案**: 像 Pipeline 那样从数据路径推导边。

**理由**: Pipeline 的边代表数据流（input source 引用 output path），可推导。Workflow 的边代表路由关系（哪个 DS 的文件经过哪个 Router），是纯拓扑信息，无法从节点属性推导，必须显式存储。

### D3: 连线类型约束

**选择**: 严格的四列连线规则：
- DataSource → Router ✓ (N:N)
- Router → Pipeline ✓ (1:1，一个 Router 只连一个 Pipeline)
- Pipeline → Target ✓ (1:N)
- 其他方向/同类互连 ✗

**理由**: 与 Workflow 的语义模型完全对齐。一条 Route = 一个 Router 节点 + 它连接的 Pipeline + 该 Pipeline 连接的 Target。

### D4: 复用 PipelineEditor 的侧边栏模式

**选择**: 右侧栏三态切换（Add Node / Node Config / Agent Assistant），与 PipelineEditor 保持一致。

**理由**: 统一交互体验。用户在 Pipeline 和 Workflow 编辑器中获得相同的操作范式。

### D5: Default Router 作为特殊节点

**选择**: Default Route 作为一个特殊的 Router 节点（`is_default: true`），视觉上用虚线边框区分，无 file_filter 配置。

**替代方案**: 不支持 Default Route。

**理由**: 保留现有 default_route 的语义，用户可以在画布上直观看到兜底路由的存在。

### D6: 旧 Workflow 反推 graph

**选择**: 已有 Workflow（无 graph_data）首次在编辑器打开时，自动从 routes + data_source_ids + default_route 反推生成 graph_data，使用自动布局算法放置节点。

**理由**: 平滑迁移，用户不需要重新配置已有 Workflow。

### D7: 节点拖放 + 点击添加

**选择**: 两种方式都支持。
- 拖放：从右侧栏拖入画布 → 落点创建节点 → 弹出 Select 选择具体资源（DataSource/Pipeline/Target）或直接创建空 Router
- 点击：右侧栏点 "+" 按钮 → 弹出资源选择器 → 节点出现在画布默认位置

**理由**: 拖放更直觉，点击更精确，两者互补。

## Risks / Trade-offs

- **[文件大小]** WorkflowEditor.tsx 可能达到 1000+ 行（参考 PipelineEditor 1700 行）→ 可在后续 refactor 中拆分子组件
- **[反推精度]** 旧 Workflow 反推 graph 时，DataSource → Router 的多对多关系可能无法完美还原（原模型中 data_source_ids 是全局的，不是 per-route 的）→ 反推时所有 DataSource 连接到所有 Router，用户可在编辑器中手动调整
- **[graph 与 routes 不一致]** 用户如果直接调 API 修改 routes 而不更新 graph_data → 下次打开编辑器时以 graph_data 为准，忽略外部 routes 修改。文档中说明此行为。
