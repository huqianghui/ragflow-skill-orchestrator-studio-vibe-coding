# 技术设计：Pipeline 编排引擎

## 1. Pipeline 数据模型设计

### 1.1 Pipeline 作为 DAG 的存储方案

Pipeline 的本质是一个有向无环图（DAG），由节点（Node）和边（Edge）组成。采用 **关系表 + JSON 混合存储** 策略：

- Pipeline 元数据存储在关系表中（名称、状态、版本等）
- Node 和 Edge 各自独立建表，通过外键关联到 Pipeline
- 节点的画布位置信息（x, y 坐标）和 Skill 配置以 JSON 形式存储在 Node 表中
- 字段映射（Field Mapping）存储在 Edge 表的 JSON 字段中

这种设计兼顾了查询效率（关系表支持索引和过滤）和灵活性（JSON 存储适配不同 Skill 的配置结构）。

### 1.2 核心数据库表结构

#### Pipeline 表

```python
class Pipeline(BaseModel):
    __tablename__ = "pipelines"

    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, active, archived
    version: Mapped[int] = mapped_column(default=1)
    tags: Mapped[list | None] = mapped_column(JSON, default=list)
    template_id: Mapped[str | None] = mapped_column(
        ForeignKey("pipeline_templates.id"), nullable=True
    )
    viewport: Mapped[dict | None] = mapped_column(JSON)
    # React Flow viewport 状态：{ x, y, zoom }
```

#### PipelineNode 表

```python
class PipelineNode(BaseModel):
    __tablename__ = "pipeline_nodes"

    pipeline_id: Mapped[str] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    skill_id: Mapped[str] = mapped_column(
        ForeignKey("skills.id"), index=True
    )
    node_key: Mapped[str] = mapped_column(String(100))
    # 节点在 Pipeline 内的唯一标识（如 "parser_1", "embedder_1"）
    label: Mapped[str | None] = mapped_column(String(255))
    # 用户自定义的节点显示名称
    position_x: Mapped[float] = mapped_column(default=0.0)
    position_y: Mapped[float] = mapped_column(default=0.0)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    # Skill 的实例化配置参数（根据 Skill.config_schema 填写）

    # 关系
    pipeline: Mapped["Pipeline"] = relationship(back_populates="nodes")
    skill: Mapped["Skill"] = relationship()
```

#### PipelineEdge 表

```python
class PipelineEdge(BaseModel):
    __tablename__ = "pipeline_edges"

    pipeline_id: Mapped[str] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    source_node_id: Mapped[str] = mapped_column(
        ForeignKey("pipeline_nodes.id", ondelete="CASCADE")
    )
    target_node_id: Mapped[str] = mapped_column(
        ForeignKey("pipeline_nodes.id", ondelete="CASCADE")
    )
    source_handle: Mapped[str | None] = mapped_column(String(100))
    # 源节点的输出端口标识
    target_handle: Mapped[str | None] = mapped_column(String(100))
    # 目标节点的输入端口标识
    field_mapping: Mapped[dict | None] = mapped_column(JSON)
    # 字段映射配置，格式见 1.3 节

    # 关系
    pipeline: Mapped["Pipeline"] = relationship(back_populates="edges")
    source_node: Mapped["PipelineNode"] = relationship(
        foreign_keys=[source_node_id]
    )
    target_node: Mapped["PipelineNode"] = relationship(
        foreign_keys=[target_node_id]
    )
```

#### Pipeline 关系定义

```python
class Pipeline(BaseModel):
    # ... 其他字段 ...

    nodes: Mapped[list["PipelineNode"]] = relationship(
        back_populates="pipeline", cascade="all, delete-orphan"
    )
    edges: Mapped[list["PipelineEdge"]] = relationship(
        back_populates="pipeline", cascade="all, delete-orphan"
    )
```

### 1.3 字段映射（Field Mapping）数据结构

Edge 上的 `field_mapping` 以 JSON 格式存储上下游节点之间的字段对应关系：

```json
{
  "mappings": [
    {
      "source_field": "parsed_text",
      "target_field": "input_text",
      "transform": null
    },
    {
      "source_field": "metadata.title",
      "target_field": "doc_title",
      "transform": "string_truncate(100)"
    }
  ],
  "auto_mapped": true
}
```

- `source_field`：源节点的输出字段路径（支持点号嵌套访问）
- `target_field`：目标节点的输入字段路径
- `transform`：可选的简单转换表达式（MVP 阶段可不实现）
- `auto_mapped`：标记该映射是否由系统自动生成

## 2. Node 与 Edge 数据结构

### 2.1 Pydantic Schema 定义

#### Node Schema

```python
class PipelineNodeCreate(BaseModel):
    skill_id: str
    node_key: str = Field(..., pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$")
    label: str | None = None
    position_x: float = 0.0
    position_y: float = 0.0
    config: dict = Field(default_factory=dict)

class PipelineNodeResponse(PipelineNodeCreate):
    id: str
    pipeline_id: str
    skill: SkillResponse  # 嵌套返回 Skill 信息
    created_at: datetime
    updated_at: datetime
```

#### Edge Schema

```python
class PipelineEdgeCreate(BaseModel):
    source_node_id: str
    target_node_id: str
    source_handle: str | None = None
    target_handle: str | None = None
    field_mapping: FieldMappingConfig | None = None

class FieldMappingConfig(BaseModel):
    mappings: list[FieldMapping] = []
    auto_mapped: bool = False

class FieldMapping(BaseModel):
    source_field: str
    target_field: str
    transform: str | None = None
```

#### Pipeline 完整 Schema

```python
class PipelineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    tags: list[str] = []

class PipelineUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: Literal["draft", "active", "archived"] | None = None
    tags: list[str] | None = None
    viewport: dict | None = None

class PipelineGraphUpdate(BaseModel):
    """整体更新 Pipeline 图结构（画布保存时调用）"""
    nodes: list[PipelineNodeCreate]
    edges: list[PipelineEdgeCreate]
    viewport: dict | None = None

class PipelineDetailResponse(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    version: int
    tags: list[str]
    nodes: list[PipelineNodeResponse]
    edges: list[PipelineEdgeResponse]
    viewport: dict | None
    created_at: datetime
    updated_at: datetime
```

## 3. Pipeline 图验证（Graph Validation）

### 3.1 验证引擎架构

所有验证逻辑封装在 `PipelineValidator` 类中，采用责任链模式依次执行多项验证：

```python
class PipelineValidator:
    """Pipeline DAG 验证引擎"""

    def validate(
        self, nodes: list[PipelineNode], edges: list[PipelineEdge]
    ) -> ValidationResult:
        """执行全量验证，返回所有发现的问题"""
        errors: list[ValidationError] = []
        warnings: list[ValidationWarning] = []

        errors.extend(self._check_cycles(nodes, edges))
        errors.extend(self._check_type_compatibility(nodes, edges))
        errors.extend(self._check_required_inputs(nodes, edges))
        warnings.extend(self._check_connectivity(nodes, edges))
        warnings.extend(self._check_orphan_nodes(nodes, edges))

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )
```

### 3.2 环检测（Cycle Detection）

使用 Kahn 算法（基于入度的拓扑排序）进行环检测：

```python
def _check_cycles(
    self, nodes: list[PipelineNode], edges: list[PipelineEdge]
) -> list[ValidationError]:
    """基于 Kahn 算法的环检测"""
    # 1. 构建邻接表和入度表
    in_degree = {n.id: 0 for n in nodes}
    adjacency = {n.id: [] for n in nodes}
    for edge in edges:
        adjacency[edge.source_node_id].append(edge.target_node_id)
        in_degree[edge.target_node_id] += 1

    # 2. 将入度为 0 的节点加入队列
    queue = deque([nid for nid, deg in in_degree.items() if deg == 0])
    visited_count = 0

    # 3. BFS 逐步移除入度为 0 的节点
    while queue:
        node_id = queue.popleft()
        visited_count += 1
        for neighbor in adjacency[node_id]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # 4. 如果未能访问所有节点，说明存在环
    if visited_count != len(nodes):
        cycle_nodes = [
            nid for nid, deg in in_degree.items() if deg > 0
        ]
        return [
            ValidationError(
                code="CYCLE_DETECTED",
                message="Pipeline 中存在循环依赖",
                affected_nodes=cycle_nodes,
            )
        ]
    return []
```

### 3.3 类型兼容性检查（Type Compatibility）

每个 Skill 定义了其输入/输出的数据类型。验证器检查每条边的源节点输出类型是否与目标节点输入类型兼容：

```python
# 类型兼容矩阵
TYPE_COMPATIBILITY = {
    "text": {"text", "any"},
    "document": {"document", "any"},
    "embedding": {"embedding", "any"},
    "structured_data": {"structured_data", "any"},
    "any": {"text", "document", "embedding", "structured_data", "any"},
}

def _check_type_compatibility(
    self, nodes: list[PipelineNode], edges: list[PipelineEdge]
) -> list[ValidationError]:
    errors = []
    for edge in edges:
        source_output_type = self._get_output_type(edge.source_node)
        target_input_type = self._get_input_type(edge.target_node)
        compatible_types = TYPE_COMPATIBILITY.get(
            source_output_type, set()
        )
        if target_input_type not in compatible_types:
            errors.append(
                ValidationError(
                    code="TYPE_INCOMPATIBLE",
                    message=(
                        f"节点 '{edge.source_node.label}' 的输出类型 "
                        f"'{source_output_type}' 与节点 "
                        f"'{edge.target_node.label}' 的输入类型 "
                        f"'{target_input_type}' 不兼容"
                    ),
                    affected_edges=[edge.id],
                )
            )
    return errors
```

### 3.4 连通性验证（Connectivity Check）

使用 Union-Find（并查集）或 BFS 检查图是否连通。非连通图作为 Warning 而非 Error，允许用户在编辑过程中暂时存在孤立节点：

```python
def _check_connectivity(
    self, nodes: list[PipelineNode], edges: list[PipelineEdge]
) -> list[ValidationWarning]:
    if not nodes:
        return []

    # BFS 从第一个节点开始遍历（将有向边视为无向边）
    undirected = {n.id: set() for n in nodes}
    for edge in edges:
        undirected[edge.source_node_id].add(edge.target_node_id)
        undirected[edge.target_node_id].add(edge.source_node_id)

    visited = set()
    queue = deque([nodes[0].id])
    while queue:
        nid = queue.popleft()
        if nid in visited:
            continue
        visited.add(nid)
        queue.extend(undirected[nid] - visited)

    if len(visited) < len(nodes):
        orphans = [n.id for n in nodes if n.id not in visited]
        return [
            ValidationWarning(
                code="DISCONNECTED_NODES",
                message=f"存在 {len(orphans)} 个未连接的孤立节点",
                affected_nodes=orphans,
            )
        ]
    return []
```

### 3.5 验证结果数据结构

```python
class ValidationError(BaseModel):
    code: str            # 错误码
    message: str         # 人类可读的描述
    affected_nodes: list[str] = []
    affected_edges: list[str] = []

class ValidationWarning(BaseModel):
    code: str
    message: str
    affected_nodes: list[str] = []
    affected_edges: list[str] = []

class ValidationResult(BaseModel):
    valid: bool
    errors: list[ValidationError] = []
    warnings: list[ValidationWarning] = []
```

### 3.6 验证 API 端点

```
POST /api/v1/pipelines/{id}/validate
```

返回 `ValidationResult`，前端可据此在画布上高亮有问题的节点和边。

## 4. 字段映射（Field Mapping）详细设计

### 4.1 Skill 的输入输出定义

在 Skill 的 `config_schema` 中增加 `input_fields` 和 `output_fields` 描述：

```json
{
  "input_fields": [
    {
      "name": "input_text",
      "type": "text",
      "required": true,
      "description": "待处理的文本内容"
    }
  ],
  "output_fields": [
    {
      "name": "embedding_vector",
      "type": "embedding",
      "description": "生成的向量表示"
    },
    {
      "name": "token_count",
      "type": "number",
      "description": "Token 数量"
    }
  ]
}
```

### 4.2 自动映射算法

当用户在画布上连接两个节点时，系统尝试自动映射字段：

```python
def auto_map_fields(
    source_fields: list[FieldDef],
    target_fields: list[FieldDef],
) -> FieldMappingConfig:
    """按名称精确匹配 -> 按类型匹配 -> 未匹配的标记为待手动配置"""
    mappings = []
    unmapped_targets = list(target_fields)

    # 第一轮：按名称精确匹配
    for sf in source_fields:
        for tf in unmapped_targets:
            if sf.name == tf.name and is_type_compatible(sf.type, tf.type):
                mappings.append(FieldMapping(
                    source_field=sf.name, target_field=tf.name
                ))
                unmapped_targets.remove(tf)
                break

    # 第二轮：按类型匹配（仅对剩余未映射字段）
    mapped_sources = {m.source_field for m in mappings}
    remaining_sources = [
        sf for sf in source_fields if sf.name not in mapped_sources
    ]
    for tf in list(unmapped_targets):
        for sf in remaining_sources:
            if is_type_compatible(sf.type, tf.type):
                mappings.append(FieldMapping(
                    source_field=sf.name, target_field=tf.name
                ))
                unmapped_targets.remove(tf)
                remaining_sources.remove(sf)
                break

    return FieldMappingConfig(mappings=mappings, auto_mapped=True)
```

### 4.3 字段映射 API

```
GET    /api/v1/pipelines/{id}/edges/{edge_id}/mapping        # 获取映射配置
PUT    /api/v1/pipelines/{id}/edges/{edge_id}/mapping        # 更新映射配置
POST   /api/v1/pipelines/{id}/edges/{edge_id}/auto-mapping   # 触发自动映射
```

## 5. Pipeline 模板系统

### 5.1 模板数据模型

```python
class PipelineTemplate(BaseModel):
    __tablename__ = "pipeline_templates"

    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50))
    # 分类：document_processing, knowledge_base, data_cleaning, custom
    is_builtin: Mapped[bool] = mapped_column(default=False)
    graph_snapshot: Mapped[dict] = mapped_column(JSON)
    # 完整的图结构快照：{ nodes: [...], edges: [...], viewport: {...} }
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))
    use_count: Mapped[int] = mapped_column(default=0)
```

### 5.2 预定义模板

系统内置以下常见 Pipeline 模板：

| 模板名称 | 分类 | 节点组成 |
|----------|------|----------|
| 文档解析与向量化 | document_processing | 文档解析 -> 文本分块 -> 向量化 |
| 知识库构建 | knowledge_base | 文档解析 -> 文本分块 -> 向量化 -> 知识库写入 |
| 多源数据聚合 | data_cleaning | [数据源A, 数据源B] -> 数据合并 -> 清洗 -> 输出 |
| 问答增强 | knowledge_base | 查询改写 -> 向量检索 -> 重排序 -> 答案生成 |

### 5.3 模板 API

```
GET    /api/v1/templates                        # 获取模板列表（支持按分类过滤）
GET    /api/v1/templates/{id}                    # 获取模板详情
POST   /api/v1/templates                        # 创建模板（管理员）
POST   /api/v1/pipelines/{id}/save-as-template  # 将 Pipeline 保存为模板
POST   /api/v1/templates/{id}/instantiate       # 从模板创建 Pipeline
```

### 5.4 从模板实例化 Pipeline

```python
async def instantiate_template(
    template_id: str, pipeline_name: str, db: AsyncSession
) -> Pipeline:
    template = await db.get(PipelineTemplate, template_id)
    snapshot = template.graph_snapshot

    # 1. 创建新的 Pipeline
    pipeline = Pipeline(name=pipeline_name, status="draft")
    db.add(pipeline)
    await db.flush()

    # 2. 复制节点，生成新 ID，建立 ID 映射表
    id_map = {}
    for node_data in snapshot["nodes"]:
        new_node = PipelineNode(
            pipeline_id=pipeline.id,
            skill_id=node_data["skill_id"],
            node_key=node_data["node_key"],
            label=node_data.get("label"),
            position_x=node_data["position_x"],
            position_y=node_data["position_y"],
            config=node_data.get("config", {}),
        )
        db.add(new_node)
        await db.flush()
        id_map[node_data["id"]] = new_node.id

    # 3. 复制边，替换节点 ID 引用
    for edge_data in snapshot["edges"]:
        new_edge = PipelineEdge(
            pipeline_id=pipeline.id,
            source_node_id=id_map[edge_data["source_node_id"]],
            target_node_id=id_map[edge_data["target_node_id"]],
            source_handle=edge_data.get("source_handle"),
            target_handle=edge_data.get("target_handle"),
            field_mapping=edge_data.get("field_mapping"),
        )
        db.add(new_edge)

    # 4. 更新模板使用计数
    template.use_count += 1
    await db.commit()
    return pipeline
```

## 6. 画布 UI 设计（React Flow）

### 6.1 整体布局

```
+-----------------------------------------------------------+
|  顶部工具栏：Pipeline 名称 | 保存 | 验证 | 运行 | 版本历史  |
+--------+--------------------------------------+-----------+
|        |                                      |           |
|  Skill |         React Flow 画布              |  属性     |
|  面板   |                                      |  面板     |
| (左侧)  |    [Node] ---> [Node] ---> [Node]   | (右侧)    |
|        |      |                                |           |
|  可拖拽  |      +-------> [Node]               |  节点配置  |
|  Skill  |                                      |  字段映射  |
|  列表   |                                      |  验证信息  |
|        |                                      |           |
+--------+--------------------------------------+-----------+
|  底部状态栏：节点数量 | 边数量 | 验证状态 | 最后保存时间     |
+-----------------------------------------------------------+
```

### 6.2 自定义节点组件

```typescript
interface SkillNodeData {
  skillId: string;
  skillName: string;
  skillType: string;
  label: string;
  config: Record<string, unknown>;
  inputFields: FieldDef[];
  outputFields: FieldDef[];
  validationErrors: string[];
}

const SkillNode: React.FC<NodeProps<SkillNodeData>> = ({ data, selected }) => {
  return (
    <div className={`skill-node ${selected ? "selected" : ""}`}>
      <div className="node-header">
        <SkillIcon type={data.skillType} />
        <span>{data.label || data.skillName}</span>
      </div>

      {/* 输入端口 */}
      <div className="node-inputs">
        {data.inputFields.map((field) => (
          <Handle
            key={field.name}
            type="target"
            id={field.name}
            position={Position.Left}
          />
        ))}
      </div>

      {/* 输出端口 */}
      <div className="node-outputs">
        {data.outputFields.map((field) => (
          <Handle
            key={field.name}
            type="source"
            id={field.name}
            position={Position.Right}
          />
        ))}
      </div>

      {/* 验证错误指示 */}
      {data.validationErrors.length > 0 && (
        <Badge count={data.validationErrors.length} />
      )}
    </div>
  );
};
```

### 6.3 画布状态管理（Zustand Store）

```typescript
interface PipelineEditorStore {
  // 状态
  pipeline: Pipeline | null;
  nodes: Node<SkillNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  validationResult: ValidationResult | null;
  isDirty: boolean;

  // 操作
  loadPipeline: (id: string) => Promise<void>;
  savePipeline: () => Promise<void>;
  addNode: (skillId: string, position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  addEdge: (connection: Connection) => void;
  removeEdge: (edgeId: string) => void;
  validatePipeline: () => Promise<ValidationResult>;
  selectNode: (nodeId: string | null) => void;

  // React Flow 回调
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
}
```

### 6.4 拖拽交互流程

1. 用户从左侧 Skill 面板拖拽一个 Skill 到画布
2. 触发 `onDrop` 事件，获取鼠标位置并转换为画布坐标
3. 调用 `addNode(skillId, position)` 创建新节点
4. 用户从源节点的输出 Handle 拖拽连线到目标节点的输入 Handle
5. 触发 `onConnect` 回调，创建新 Edge
6. 系统自动执行字段自动映射（`auto_map_fields`）
7. 画布变更标记 `isDirty = true`
8. 用户点击 "保存" 时，调用 `PUT /api/v1/pipelines/{id}/graph` 整体保存图结构

### 6.5 画布保存与还原

**保存流程**：将 React Flow 的 nodes、edges、viewport 序列化后发送到后端。

```typescript
const savePipeline = async () => {
  const graphData: PipelineGraphUpdate = {
    nodes: nodes.map((n) => ({
      skill_id: n.data.skillId,
      node_key: n.id,
      label: n.data.label,
      position_x: n.position.x,
      position_y: n.position.y,
      config: n.data.config,
    })),
    edges: edges.map((e) => ({
      source_node_id: e.source,
      target_node_id: e.target,
      source_handle: e.sourceHandle,
      target_handle: e.targetHandle,
      field_mapping: e.data?.fieldMapping,
    })),
    viewport: reactFlowInstance.getViewport(),
  };
  await api.put(`/pipelines/${pipeline.id}/graph`, graphData);
  setIsDirty(false);
};
```

**还原流程**：从后端加载 Pipeline 详情，将节点和边转换为 React Flow 格式。

## 7. Pipeline 版本管理

### 7.1 版本策略

采用 **简单递增版本号 + 快照** 的方式管理 Pipeline 版本：

- 每次 Pipeline 状态从 `draft` 变为 `active` 时，自动递增 `version` 字段
- 同时在 `pipeline_versions` 表中保存当前图结构的完整快照

```python
class PipelineVersion(BaseModel):
    __tablename__ = "pipeline_versions"

    pipeline_id: Mapped[str] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int]
    graph_snapshot: Mapped[dict] = mapped_column(JSON)
    # 完整的图结构快照
    activated_at: Mapped[datetime] = mapped_column(server_default=func.now())
    description: Mapped[str | None] = mapped_column(Text)
    # 版本说明（可选）
```

### 7.2 版本 API

```
GET    /api/v1/pipelines/{id}/versions            # 获取版本历史列表
GET    /api/v1/pipelines/{id}/versions/{version}   # 获取指定版本详情
POST   /api/v1/pipelines/{id}/versions/{version}/rollback  # 回滚到指定版本
```

### 7.3 回滚机制

回滚操作将指定版本的快照还原到当前 Pipeline 的 nodes 和 edges 中，并将 Pipeline 状态重置为 `draft`：

```python
async def rollback_to_version(
    pipeline_id: str, version: int, db: AsyncSession
) -> Pipeline:
    # 1. 获取指定版本的快照
    version_record = await db.execute(
        select(PipelineVersion).where(
            PipelineVersion.pipeline_id == pipeline_id,
            PipelineVersion.version == version,
        )
    )
    snapshot = version_record.scalar_one().graph_snapshot

    # 2. 清除当前 Pipeline 的节点和边
    await db.execute(
        delete(PipelineNode).where(
            PipelineNode.pipeline_id == pipeline_id
        )
    )
    await db.execute(
        delete(PipelineEdge).where(
            PipelineEdge.pipeline_id == pipeline_id
        )
    )

    # 3. 从快照重建节点和边（逻辑同模板实例化）
    await _rebuild_graph_from_snapshot(pipeline_id, snapshot, db)

    # 4. 更新 Pipeline 状态
    pipeline = await db.get(Pipeline, pipeline_id)
    pipeline.status = "draft"
    await db.commit()
    return pipeline
```

## 8. API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/pipelines` | Pipeline 列表（分页、过滤、搜索） |
| POST | `/api/v1/pipelines` | 创建 Pipeline |
| GET | `/api/v1/pipelines/{id}` | 获取 Pipeline 详情（含 nodes 和 edges） |
| PUT | `/api/v1/pipelines/{id}` | 更新 Pipeline 元数据 |
| DELETE | `/api/v1/pipelines/{id}` | 删除 Pipeline |
| PUT | `/api/v1/pipelines/{id}/graph` | 整体更新 Pipeline 图结构 |
| POST | `/api/v1/pipelines/{id}/validate` | 验证 Pipeline DAG |
| POST | `/api/v1/pipelines/{id}/activate` | 激活 Pipeline（draft -> active） |
| POST | `/api/v1/pipelines/{id}/archive` | 归档 Pipeline |
| GET | `/api/v1/pipelines/{id}/versions` | 获取版本历史 |
| GET | `/api/v1/pipelines/{id}/versions/{ver}` | 获取指定版本 |
| POST | `/api/v1/pipelines/{id}/versions/{ver}/rollback` | 回滚版本 |
| GET | `/api/v1/pipelines/{id}/edges/{eid}/mapping` | 获取字段映射 |
| PUT | `/api/v1/pipelines/{id}/edges/{eid}/mapping` | 更新字段映射 |
| POST | `/api/v1/pipelines/{id}/edges/{eid}/auto-mapping` | 自动字段映射 |
| POST | `/api/v1/pipelines/{id}/save-as-template` | 保存为模板 |
| GET | `/api/v1/templates` | 模板列表 |
| GET | `/api/v1/templates/{id}` | 模板详情 |
| POST | `/api/v1/templates` | 创建模板 |
| POST | `/api/v1/templates/{id}/instantiate` | 从模板实例化 |

## 9. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 图存储方式 | 关系表（Node + Edge）而非单一 JSON 字段 | 支持对节点和边的独立查询、索引和过滤；避免大 JSON 更新的并发冲突 |
| 图保存策略 | 整体保存（PUT /graph）而非增量操作 | 画布编辑是高频操作，整体保存简化前端逻辑，减少 API 调用次数 |
| 验证时机 | 手动触发 + 状态变更时自动触发 | 编辑过程中不强制验证（避免打断用户流程），激活前强制验证 |
| 字段映射存储 | Edge 上的 JSON 字段 | 映射关系与连接强绑定，随边的增删自动管理生命周期 |
| 版本管理 | 简单递增版本号 + JSON 快照 | MVP 阶段够用，避免引入复杂的 diff/merge 机制 |
| 模板存储 | 独立表 + 图结构快照 | 模板独立于 Pipeline 存在，不受原 Pipeline 修改影响 |
