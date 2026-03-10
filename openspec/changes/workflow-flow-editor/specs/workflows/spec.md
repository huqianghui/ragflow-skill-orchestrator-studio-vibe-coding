## MODIFIED Requirements

### Requirement: Workflow Data Model

系统 SHALL 提供 Workflow 实体，作为 DataSource → Pipeline → Target 的编排层。

#### Scenario: Workflow 字段结构

- **GIVEN** 数据库中存在一个 Workflow 记录
- **THEN** 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符)
  - description (描述, 可选)
  - status (draft | active | archived, 默认 draft)
  - graph_data (JSON 对象, 画布节点和边数据, 可选, 默认 null)
  - data_source_ids (JSON 数组, 关联的 DataSource ID 列表)
  - routes (JSON 数组, 路由规则列表)
  - default_route (JSON 对象, 兜底路由规则, 可选)
  - created_at / updated_at (时间戳)

#### Scenario: graph_data 结构

- **GIVEN** Workflow 的 graph_data 不为 null
- **THEN** 包含以下结构:
  - nodes (数组): 画布节点列表，每个节点包含:
    - id (str): 节点唯一 ID
    - type (str): 节点类型，值为 data_source | router | pipeline | target
    - x (number): 画布 X 坐标
    - y (number): 画布 Y 坐标
    - data_source_id (str, 可选): type=data_source 时关联的 DataSource ID
    - name (str, 可选): type=router 时的路由名称
    - priority (int, 可选): type=router 时的优先级
    - file_filter (object, 可选): type=router 时的文件过滤条件
    - is_default (bool, 可选): type=router 时标记为兜底路由
    - pipeline_id (str, 可选): type=pipeline 时关联的 Pipeline ID
    - target_id (str, 可选): type=target 时关联的 Target ID
  - edges (数组): 画布边列表，每条边包含:
    - id (str): 边唯一 ID
    - source (str): 源节点 ID
    - target (str): 目标节点 ID

#### Scenario: Route 规则结构

- **GIVEN** Workflow 的 routes 数组中存在一条路由规则
- **THEN** 该规则包含以下字段:
  - name (str): 路由名称
  - priority (int): 优先级，值越小优先级越高
  - file_filter (object): 文件过滤条件
    - extensions (list[str], 可选): 文件扩展名列表 (如 ["pdf", "docx"])
    - mime_types (list[str], 可选): MIME 类型列表
    - size_range (object, 可选): { min_bytes: int, max_bytes: int }
    - path_pattern (str, 可选): 路径匹配模式 (如 "training/*")
  - pipeline_id (str): 关联的 Pipeline ID
  - target_ids (list[str]): 关联的 Target ID 列表

#### Scenario: Default Route 结构

- **GIVEN** Workflow 设置了 default_route
- **THEN** 结构与 Route 相同，但不包含 file_filter 和 priority 字段
- **AND** 未被任何路由匹配的文件将由 default_route 处理

### Requirement: Workflow 前端管理

系统 SHALL 提供 Workflows 管理页面，与现有模块保持一致的交互体验。

#### Scenario: Workflows 列表页

- **WHEN** 用户访问 Workflows 页面
- **THEN** 显示 Workflow 列表（表格形式）
- **AND** 包含列: Name, Status, Data Sources 数量, Routes 数量, Description, Created At
- **AND** 支持分页
- **AND** 提供搜索过滤功能

#### Scenario: 创建 Workflow

- **WHEN** 用户点击 "New Workflow" 按钮
- **THEN** 弹出 Modal 表单，只包含 Name 和 Description 字段
- **AND** 创建成功后跳转到 `/workflows/:id/edit` 编辑器页面

#### Scenario: 编辑 Workflow

- **WHEN** 用户点击列表中的 Workflow 名称或 Edit 操作
- **THEN** 跳转到 `/workflows/:id/edit` 编辑器页面
- **AND** 在画布中显示该 Workflow 的路由拓扑
