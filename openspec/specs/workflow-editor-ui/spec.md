## ADDED Requirements

### Requirement: WorkflowEditor 页面路由

系统 SHALL 提供 WorkflowEditor 页面，通过 `/workflows/:id/edit` 路由访问。

#### Scenario: 访问 WorkflowEditor

- **WHEN** 用户访问 `/workflows/:id/edit`
- **THEN** 显示该 Workflow 的 React Flow 画布编辑器
- **AND** 加载 Workflow 的 graph_data 渲染节点和边

#### Scenario: Workflow 不存在

- **WHEN** 用户访问 `/workflows/:id/edit` 但 ID 不存在
- **THEN** 显示 404 提示并提供返回列表的链接

### Requirement: 四种节点类型

WorkflowEditor SHALL 支持 4 种自定义节点类型，从左到右布局。

#### Scenario: DataSource 节点

- **WHEN** 画布上存在 DataSource 节点
- **THEN** 显示蓝色风格节点，包含数据源图标、名称和类型
- **AND** 右侧有 source Handle（只出不入）

#### Scenario: Router 节点

- **WHEN** 画布上存在 Router 节点
- **THEN** 显示绿色风格节点，包含路由名称和 file_filter 摘要（如 "*.pdf, *.docx"）
- **AND** 左侧有 target Handle，右侧有 source Handle

#### Scenario: Default Router 节点

- **WHEN** 画布上存在 is_default=true 的 Router 节点
- **THEN** 显示虚线边框的绿色风格节点，标记 "Default"
- **AND** 无 file_filter 配置（匹配所有未被其他 Router 匹配的文件）

#### Scenario: Pipeline 节点

- **WHEN** 画布上存在 Pipeline 节点
- **THEN** 显示紫色风格节点，包含 Pipeline 名称
- **AND** 左侧有 target Handle，右侧有 source Handle
- **AND** 提供 "Open in Editor" 链接跳转到 PipelineEditor

#### Scenario: Target 节点

- **WHEN** 画布上存在 Target 节点
- **THEN** 显示橙色风格节点，包含 Target 名称和类型
- **AND** 左侧有 target Handle（只入不出）

### Requirement: 连线规则

WorkflowEditor SHALL 强制执行严格的连线类型约束。

#### Scenario: 允许的连线方向

- **WHEN** 用户从 DataSource 节点拖线到 Router 节点
- **THEN** 连线成功建立
- **AND** 同样允许 Router → Pipeline 和 Pipeline → Target 的连线

#### Scenario: Router 到 Pipeline 1:1 约束

- **WHEN** 用户尝试将一个 Router 连接到第二个 Pipeline
- **THEN** 连线被拒绝，显示提示 "一个 Router 只能连接一个 Pipeline"

#### Scenario: 禁止的连线方向

- **WHEN** 用户尝试从 DataSource 直接连线到 Pipeline、Target，或反向连线，或同类型互连
- **THEN** 连线被拒绝

### Requirement: 拖放添加节点

WorkflowEditor SHALL 支持从右侧栏拖放节点到画布。

#### Scenario: 拖放 DataSource/Pipeline/Target

- **WHEN** 用户从右侧 Add Node 面板拖放 DataSource、Pipeline 或 Target 图标到画布
- **THEN** 在落点位置创建节点
- **AND** 弹出 Select 下拉框让用户选择具体的已有资源

#### Scenario: 拖放 Router

- **WHEN** 用户从右侧 Add Node 面板拖放 Router 图标到画布
- **THEN** 在落点位置创建空白 Router 节点
- **AND** 右侧栏自动切换到 Node Config 标签，显示 Router 配置表单

### Requirement: 点击添加节点

WorkflowEditor SHALL 支持通过点击按钮添加节点。

#### Scenario: 点击添加

- **WHEN** 用户在右侧 Add Node 面板点击某种节点类型的 "+" 按钮
- **THEN** 弹出资源选择器（DataSource/Pipeline/Target）或创建空 Router
- **AND** 节点出现在画布空白区域的默认位置

### Requirement: 右侧栏三态切换

WorkflowEditor 右侧栏 SHALL 支持三种互斥显示状态，与 PipelineEditor 保持一致。

#### Scenario: Add Node 状态

- **WHEN** 用户点击画布空白处或首次打开编辑器
- **THEN** 右侧栏显示 Add Node 面板，列出 DataSource、Router、Pipeline、Target 四种可添加的节点类型
- **AND** 每种类型支持拖放和点击添加

#### Scenario: Node Config 状态

- **WHEN** 用户点击画布中的节点
- **THEN** 右侧栏切换到 Node Config 面板
- **AND** 根据节点类型显示不同配置表单：
  - DataSource: 只读展示，可更换资源
  - Router: 编辑 name、priority、file_filter（extensions、mime_types、size_range、path_pattern）
  - Pipeline: 只读展示，提供 "Open in Editor" 跳转
  - Target: 只读展示，可更换资源
- **AND** 提供删除节点按钮

#### Scenario: Agent Assistant 状态

- **WHEN** 用户点击顶部 Agent 按钮
- **THEN** 右侧栏切换到 Agent Assistant 面板
- **AND** 显示 AgentSelector 下拉框和 AgentChatWidget

### Requirement: 保存与 graph → routes 同步

WorkflowEditor SHALL 在保存时将画布数据同步为后端可执行的路由结构。

#### Scenario: 保存 Workflow

- **WHEN** 用户点击 Save 按钮
- **THEN** 从 graph_data 的节点和边推导出 `data_source_ids`、`routes`、`default_route`
- **AND** 将 graph_data 和推导结果一起发送到 PUT /api/v1/workflows/{id}

#### Scenario: graph → routes 推导逻辑

- **GIVEN** 画布上有 Router 节点 R，连接到 Pipeline 节点 P，P 连接到 Target 节点 T1 和 T2
- **AND** DataSource 节点 DS1 和 DS2 连接到 R
- **WHEN** 保存时执行推导
- **THEN** 生成一条 RouteRule：name=R.name, priority=R.priority, file_filter=R.file_filter, pipeline_id=P.pipeline_id, target_ids=[T1.target_id, T2.target_id]
- **AND** data_source_ids 包含 DS1 和 DS2 的 ID（去重合并所有 DataSource 节点）

#### Scenario: Default Router 推导

- **GIVEN** 画布上有 is_default=true 的 Router 节点连接到 Pipeline 和 Target
- **WHEN** 保存时执行推导
- **THEN** 生成 default_route：pipeline_id=连接的 Pipeline ID, target_ids=连接的 Target ID 列表

### Requirement: 旧 Workflow 反推 graph

WorkflowEditor SHALL 支持从已有 routes 数据反推生成初始 graph_data。

#### Scenario: 首次打开无 graph_data 的 Workflow

- **WHEN** 用户打开一个没有 graph_data 的已有 Workflow
- **THEN** 自动从 routes、data_source_ids、default_route 反推生成 graph 节点和边
- **AND** 使用自动布局算法将节点按四列（DataSource / Router / Pipeline / Target）从左到右放置

### Requirement: 侧边栏折叠

WorkflowEditor 右侧栏 SHALL 支持折叠/展开，与 PipelineEditor 保持一致。

#### Scenario: 折叠侧边栏

- **WHEN** 用户点击折叠按钮
- **THEN** 右侧栏收缩到 40px 宽度，只显示折叠图标
- **AND** 画布区域自动扩展

#### Scenario: 展开侧边栏

- **WHEN** 用户点击展开按钮
- **THEN** 右侧栏恢复到完整宽度（380px）
