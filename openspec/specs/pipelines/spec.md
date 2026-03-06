# Pipelines Module Specification

## Purpose

Pipeline 是 Skill 的编排容器，定义了数据从输入到输出的完整处理流程。用户可以创建 Pipeline、配置 DAG 图结构，并最终可视化地构建和执行。

### Requirement: Pipeline Data Model

#### Scenario: Pipeline 字段结构

- **GIVEN** 数据库中存在一个 Pipeline 记录
- **THEN** 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符)
  - description (描述, 可选)
  - status (draft | validated | active | archived, 默认 draft)
  - graph_data (JSON 对象, 默认 {"nodes": [], "edges": []})
  - created_at / updated_at (时间戳)
  - [Phase 2]: last_run_at (最后执行时间)

- **AND** graph_data 中 Node 结构 [Phase 2]:
  - id, skill_id, skill_version, position {x, y}
  - config_overrides, input_mappings, output_mappings
- **AND** graph_data 中 Edge 结构 [Phase 2]:
  - source_node_id, source_output_field, target_node_id, target_input_field

### Requirement: Pipeline CRUD [Phase 1 - 已实现]

#### Scenario: 创建 Pipeline

- **WHEN** POST /api/v1/pipelines，body 包含:
  - name (必填)
  - description (可选)
  - graph_data (可选, 默认 {"nodes": [], "edges": []})
- **THEN** 创建 Pipeline (status=draft) 并返回 201

#### Scenario: 列出 Pipeline（分页）

- **WHEN** GET /api/v1/pipelines?page=1&page_size=20
- **THEN** 返回分页响应，按 created_at 倒序排列

#### Scenario: 获取 Pipeline 详情

- **WHEN** GET /api/v1/pipelines/{id}
- **THEN** 返回完整 Pipeline 对象
- **AND** 若不存在返回 404 NOT_FOUND

#### Scenario: 更新 Pipeline

- **WHEN** PUT /api/v1/pipelines/{id}，body 含需更新的字段
- **THEN** 支持更新 name / description / status / graph_data

#### Scenario: 删除 Pipeline

- **WHEN** DELETE /api/v1/pipelines/{id}
- **THEN** 删除并返回 204

### Requirement: 前端 Pipeline 列表页 [Phase 1 - 已实现]

#### Scenario: Pipeline 列表展示

- **WHEN** 用户访问 /pipelines
- **THEN** 显示表格: Name / Status (Tag) / Description / Created / Actions
- **AND** 支持 "New Pipeline" 按钮
- **AND** Actions: Edit / Run / Delete (占位, 待实现交互)

### Requirement: Pipeline 编辑器 [Phase 1 - 占位]

#### Scenario: Pipeline 编辑页

- **WHEN** 用户访问 /pipelines/{id}/edit
- **THEN** 显示 Pipeline ID 和画布占位区域
- **AND** React Flow 画布将在 Phase 2 实现

### Requirement: 节点管理与画布 [Phase 2]

#### Scenario: 添加 Skill 节点

- **WHEN** 从 Skill 面板拖拽 Skill 到画布
- **THEN** 创建新节点，显示 Skill 名称/图标/输入输出端口

#### Scenario: 连接节点

- **WHEN** 从节点 A 输出端口拖线到节点 B 输入端口
- **THEN** 创建 Edge，类型不兼容时显示警告

#### Scenario: 配置节点参数

- **WHEN** 点击画布上的节点
- **THEN** 显示配置面板: Skill 信息、可覆盖配置、字段映射

### Requirement: Pipeline 模板库 [Phase 2]

#### Scenario: 预置模板

- **THEN** 提供模板:
  - PDF 文档索引: DocumentCracker → TextSplitter → TextEmbedder
  - 多语言文档处理: DocumentCracker → LanguageDetector → TextTranslator → TextSplitter → TextEmbedder
  - 实体提取与索引: DocumentCracker → TextSplitter → EntityRecognizer → KeyPhraseExtractor
  - 图片分析索引: ImageAnalyzer → TextEmbedder
  - PII 脱敏处理: DocumentCracker → PIIDetector → TextSplitter → TextEmbedder

### Requirement: Pipeline 验证 [Phase 2]

#### Scenario: 验证通过

- **GIVEN** Pipeline 含至少一个节点，所有输入已连接，无循环
- **WHEN** 用户点击 "验证"
- **THEN** 标记 status=validated

#### Scenario: 验证失败

- **THEN** 检测: 孤立节点（必需输入未连接）、循环依赖、类型不匹配
- **AND** 高亮失败节点/路径，显示错误信息
