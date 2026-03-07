# Pipelines Module Specification

## Purpose

Pipeline 是 Skill 的编排容器，定义了数据从输入到输出的完整处理流程。用户可以创建 Pipeline、配置有序 Skill 节点列表，并通过 Debug 模式可视化执行和检查结果。

### Requirement: Pipeline Data Model

#### Scenario: Pipeline 字段结构

- **GIVEN** 数据库中存在一个 Pipeline 记录
- **THEN** 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符)
  - description (描述, 可选)
  - status (draft | validated | active | archived, 默认 draft)
  - graph_data (JSON 对象, 默认 {"nodes": []})
  - created_at / updated_at (时间戳)

- **AND** graph_data 中 Node 结构:
  - `id` (str): 节点唯一 ID (UUID)
  - `skill_id` (str): 关联的 Skill ID
  - `label` (str): 用户可见的节点名称
  - `position` (int): 执行顺序 (0, 1, 2, ...)
  - `context` (str): Enrichment Tree 执行上下文路径，如 "/document" 或 "/document/chunks/*"
  - `inputs` (list): `[{name: str, source: str}]` — 输入字段名到 tree 路径的映射
  - `outputs` (list): `[{name: str, targetName: str}]` — 输出字段名到 tree 目标名的映射
  - `config_overrides` (dict): 覆盖 skill 默认 config_values 的参数
  - `bound_connection_id` (str|null): 节点级 Connection 绑定（覆盖 skill 级绑定）

### Requirement: 节点管理与编排

系统 SHALL 支持通过有序 Skill 列表方式编排 Pipeline 节点（替代原 Phase 2 的 DAG 画布方案）。

#### Scenario: 添加 Skill 节点

- **WHEN** 用户在 Pipeline 编辑器中点击 "添加 Skill"
- **THEN** 从可用 Skill 列表中选择
- **AND** 新节点以 pipeline_io 默认值（context, inputs, outputs）添加到列表末尾
- **AND** position 设为当前最大 position + 1

#### Scenario: 排序 Skill 节点

- **WHEN** 用户拖拽节点到新位置
- **THEN** 更新所有节点的 position 值
- **AND** 执行顺序按 position 排列

#### Scenario: 配置节点输入映射

- **WHEN** 用户编辑节点的 input source 路径
- **THEN** 下拉框显示所有前序节点产出的可用路径
- **AND** 初始可用路径: `/document/file_content`, `/document/file_name`

#### Scenario: 配置节点 Context

- **WHEN** 用户编辑节点的 context
- **THEN** 可选值包含:
  - `/document`（默认，整个文档级别执行一次）
  - 前序节点输出的数组路径 + `/*`（如 `/document/chunks/*`，表示扇出执行）

#### Scenario: 删除 Skill 节点

- **WHEN** 用户删除一个节点
- **THEN** 从 graph_data.nodes 中移除
- **AND** 后续节点 position 重新编号

### Requirement: Pipeline CRUD [Phase 1 - 已实现]

#### Scenario: 创建 Pipeline

- **WHEN** POST /api/v1/pipelines，body 包含:
  - name (必填)
  - description (可选)
  - graph_data (可选, 默认 {"nodes": []})
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

### Requirement: Pipeline 模板库

系统 SHALL 提供预配置的 Pipeline 模板，帮助用户快速创建常见处理流程。

#### Scenario: 预置模板

- **THEN** 提供模板:
  - PDF 文档索引: DocumentCracker → TextSplitter → TextEmbedder(/document/chunks/*)
  - 多语言文档处理: DocumentCracker → LanguageDetector → TextTranslator → TextSplitter → TextEmbedder(/document/chunks/*)
  - 实体提取与索引: DocumentCracker → TextSplitter → EntityRecognizer(/document/chunks/*) → KeyPhraseExtractor(/document/chunks/*)
  - 图片分析索引: ImageAnalyzer → TextEmbedder
  - PII 脱敏处理: DocumentCracker → PIIDetector → TextSplitter → TextEmbedder(/document/chunks/*)

#### Scenario: 模板包含完整节点定义

- **GIVEN** 用户选择 "PDF 文档索引" 模板
- **THEN** graph_data.nodes 预填充 3 个节点:
  - 节点 1: DocumentCracker, context="/document", inputs=[{name:"file_content", source:"/document/file_content"}, ...], outputs=[{name:"content", targetName:"content"}, ...]
  - 节点 2: TextSplitter, context="/document", inputs=[{name:"text", source:"/document/content"}], outputs=[{name:"chunks", targetName:"chunks"}]
  - 节点 3: TextEmbedder, context="/document/chunks/*", inputs=[{name:"text", source:"/document/chunks/*/text"}], outputs=[{name:"embedding", targetName:"embedding"}]

### Requirement: Pipeline 验证

#### Scenario: 验证通过

- **GIVEN** Pipeline 含至少一个节点，所有 source 路径可从前序节点解析
- **WHEN** 用户点击 "验证" 或保存时自动验证
- **THEN** 标记 status=validated

#### Scenario: 验证失败——Source 路径不可用

- **GIVEN** 节点 N 的某个 input source 引用的路径无法从前序节点的输出中获得
- **WHEN** 验证
- **THEN** 报告错误: "Node N: source path '/document/xxx' not available from preceding nodes"
