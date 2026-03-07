## ADDED Requirements

### Requirement: Enrichment Tree 数据结构

系统 SHALL 提供 EnrichmentTree 作为 Pipeline 执行期间的共享路径寻址数据存储。所有 Skill 从树上读取输入、向树上写入输出。

#### Scenario: 初始化 Enrichment Tree

- **WHEN** Pipeline debug 执行开始
- **THEN** 创建 EnrichmentTree，初始数据为:
  - `/document/file_content`: 上传文件的原始 bytes
  - `/document/file_name`: 上传文件的文件名

#### Scenario: 路径读取

- **WHEN** 调用 `tree.get(path)` 且 path 为 `/document/chunks/0/text`
- **THEN** 解析路径为 `root["document"]["chunks"][0]["text"]` 并返回值
- **AND** 路径不存在时抛出 KeyError

#### Scenario: 路径写入

- **WHEN** 调用 `tree.set(path, value)` 且 path 为 `/document/chunks`
- **THEN** 创建所有中间层级（dict 或 list）并设置值
- **AND** 若下一级 path 是数字或 `*`，则创建 list；否则创建 dict

#### Scenario: Context 展开

- **WHEN** 调用 `tree.expand_context("/document/chunks/*")`
- **AND** `/document/chunks` 是一个长度为 3 的数组
- **THEN** 返回 `["/document/chunks/0", "/document/chunks/1", "/document/chunks/2"]`

#### Scenario: Context 无通配符

- **WHEN** 调用 `tree.expand_context("/document")`
- **THEN** 返回 `["/document"]`（单个实例，不扇出）

#### Scenario: Source 路径解析（带通配符）

- **WHEN** source 为 `/document/chunks/*/text`，context 为 `/document/chunks/*`，当前实例为 `/document/chunks/2`
- **THEN** 解析为 `/document/chunks/2/text`（`*` 替换为实例索引）

#### Scenario: Source 路径解析（无通配符，跨 context 读取）

- **WHEN** source 为 `/document/content`，context 为 `/document/chunks/*`，当前实例为 `/document/chunks/2`
- **THEN** 解析为 `/document/content`（从根读取，不受 context 影响）

#### Scenario: 序列化排除二进制字段

- **WHEN** 调用 `tree.to_dict(exclude_binary=True)`
- **THEN** bytes 类型的值替换为 `"(binary, X bytes)"` 占位字符串
- **AND** 长度超过 1536 的 list（如 embedding 向量）截断为前 5 个元素 + `"...(N dims)"`

---

### Requirement: Pipeline Runner 执行引擎

系统 SHALL 提供 PipelineRunner，按节点顺序执行 Pipeline，通过 Enrichment Tree 串联 Skill 输入输出。

#### Scenario: 正常执行完整 Pipeline

- **WHEN** 调用 `PipelineRunner.execute(pipeline, file_content, file_name)`
- **THEN** 初始化 EnrichmentTree
- **AND** 按 `position` 顺序遍历 `graph_data.nodes`
- **AND** 对每个节点：展开 context、解析 inputs、调用 skill.execute()、写入 outputs
- **AND** 返回 `{status, total_execution_time_ms, enrichment_tree, node_results}`

#### Scenario: Context 扇出执行

- **GIVEN** 节点 context 为 `/document/chunks/*`，tree 中 `/document/chunks` 有 3 个元素
- **WHEN** 执行该节点
- **THEN** 对每个 chunk (index 0, 1, 2) 分别执行一次 skill
- **AND** 每次执行中，source 路径的 `*` 替换为当前索引
- **AND** output targetName 写入到 context 实例路径下（如 `/document/chunks/0/embedding`）

#### Scenario: Connection 解析优先级

- **WHEN** 节点需要 Connection
- **THEN** 按以下优先级解析:
  1. 节点级 `bound_connection_id`（graph_data 中该节点的配置）
  2. Skill 级 `bound_connection_id`（Skill 表中的配置）
  3. 该 `required_resource_type` 的 default connection
- **AND** 若三级都无法找到，返回错误 "No connection available for type 'X'"

#### Scenario: 节点执行失败时停止

- **GIVEN** Pipeline 有 3 个节点
- **WHEN** 第 2 个节点执行失败
- **THEN** 停止执行，不执行第 3 个节点
- **AND** 返回 `status: "partial"`
- **AND** node_results 包含: 节点 1 (success)、节点 2 (error)、节点 3 不在结果中

#### Scenario: 节点执行结果记录

- **WHEN** 每个节点执行完成
- **THEN** 记录 NodeResult:
  - `node_id`: 节点 ID
  - `skill_name`: Skill 名称
  - `status`: "success" | "error"
  - `execution_time_ms`: 执行耗时
  - `records_processed`: 处理的记录数（扇出时为数组长度）
  - `input_snapshots`: 每次执行的输入数据快照（list）
  - `output_snapshots`: 每次执行的输出数据快照（list）
  - `errors`: 错误信息列表
  - `warnings`: 警告信息列表

#### Scenario: 本地 Skill 无需 Connection

- **GIVEN** Skill.required_resource_types 为 null（TextSplitter, TextMerger, Shaper, Conditional）
- **WHEN** PipelineRunner 执行该节点
- **THEN** 传入 client=None，直接执行本地逻辑

---

### Requirement: Pipeline Debug API

系统 SHALL 提供 Debug 端点，允许用户上传文件并执行整个 Pipeline 以查看逐节点结果。

#### Scenario: 执行 Pipeline Debug

- **WHEN** POST /api/v1/pipelines/{id}/debug (multipart/form-data)，包含 file 字段
- **THEN** 读取 Pipeline 的 graph_data
- **AND** 调用 PipelineRunner 执行
- **AND** 返回 200，body 包含:
  - `status`: "success" | "partial" | "error"
  - `total_execution_time_ms`: 总执行时间
  - `enrichment_tree`: 序列化后的 Enrichment Tree（排除 binary）
  - `node_results`: 每个节点的执行结果数组

#### Scenario: Pipeline 无节点时 Debug

- **GIVEN** Pipeline 的 graph_data.nodes 为空数组
- **WHEN** POST /api/v1/pipelines/{id}/debug
- **THEN** 返回 400 "Pipeline has no nodes to execute"

#### Scenario: Pipeline 不存在时 Debug

- **WHEN** POST /api/v1/pipelines/{nonexistent-id}/debug
- **THEN** 返回 404 NOT_FOUND

#### Scenario: Debug 执行超时

- **WHEN** Pipeline 执行总耗时超过 sync_execution_timeout_s (默认 120s)
- **THEN** 中止执行
- **AND** 返回已完成节点的结果 + `status: "partial"` + `error: "Execution timed out after Ns"`

---

### Requirement: Pipeline I/O 默认值

每个内置 Skill SHALL 声明 Pipeline I/O 默认值，用于在添加到 Pipeline 时自动填充。

#### Scenario: 获取可用 Skills 及其 Pipeline I/O

- **WHEN** GET /api/v1/pipelines/available-skills
- **THEN** 返回所有 Skill 列表，每个 Skill 包含:
  - 基本信息 (id, name, description, skill_type, required_resource_types)
  - `pipeline_io`: `{default_context, inputs, outputs}` 或 null

#### Scenario: pipeline_io 结构

- **GIVEN** 内置 Skill 的 pipeline_io 不为 null
- **THEN** 包含:
  - `default_context` (str): 默认 context 路径，如 "/document"
  - `inputs` (list): `[{name, source, description}]` — 默认输入映射
  - `outputs` (list): `[{name, targetName, description}]` — 默认输出映射

#### Scenario: 所有 16 个内置 Skill 的默认 I/O

- **THEN** 以下 Skill 具有 pipeline_io 默认值:

| Skill | default_context | 主要 inputs (name←source) | 主要 outputs (name→targetName) |
|-------|----------------|--------------------------|-------------------------------|
| DocumentCracker | /document | file_content←/document/file_content, file_name←/document/file_name | content→content, markdown→markdown, tables→tables, pages→pages, metadata→metadata |
| TextSplitter | /document | text←/document/content | chunks→chunks, totalChunks→totalChunks |
| TextMerger | /document | texts←/document/chunks | text→mergedText |
| LanguageDetector | /document | text←/document/content | languageCode→language, languageName→languageName |
| EntityRecognizer | /document | text←/document/content | entities→entities |
| EntityLinker | /document | text←/document/content | entities→linkedEntities |
| KeyPhraseExtractor | /document | text←/document/content | keyPhrases→keyPhrases |
| SentimentAnalyzer | /document | text←/document/content | sentiment→sentiment, confidenceScores→sentimentScores |
| PIIDetector | /document | text←/document/content | entities→piiEntities, redactedText→redactedText |
| TextTranslator | /document | text←/document/content | translatedText→translatedText |
| OCR | /document | file_content←/document/file_content | text→ocrText |
| ImageAnalyzer | /document | file_content←/document/file_content | description→imageDescription, tags→imageTags |
| TextEmbedder | /document | text←/document/content | embedding→embedding |
| GenAIPrompt | /document | text←/document/content | output→aiOutput |
| Shaper | /document | (dynamic) | (dynamic) |
| Conditional | /document | (dynamic) | matches→conditionResult |

---

### Requirement: Pipeline 模板

系统 SHALL 提供预配置的 Pipeline 模板，包含完整的节点定义（context, inputs, outputs, config_overrides）。

#### Scenario: 从模板创建 Pipeline

- **WHEN** 用户在"新建 Pipeline"对话框中选择模板
- **THEN** 创建 Pipeline，graph_data.nodes 预填充模板中的节点定义
- **AND** 每个节点的 skill_id 根据 Skill name 从数据库中查找

#### Scenario: 预置模板列表

- **THEN** 提供以下模板:

| 模板名称 | 节点序列 | 说明 |
|---------|---------|------|
| PDF 文档索引 | DocumentCracker → TextSplitter → TextEmbedder(/document/chunks/*) | 最常见的文档处理流程 |
| 多语言文档处理 | DocumentCracker → LanguageDetector → TextTranslator → TextSplitter → TextEmbedder(/document/chunks/*) | 先检测语言再翻译后分块 |
| 实体提取与索引 | DocumentCracker → TextSplitter → EntityRecognizer(/document/chunks/*) → KeyPhraseExtractor(/document/chunks/*) | 从分块中提取实体和关键词 |
| PII 脱敏处理 | DocumentCracker → PIIDetector → TextSplitter → TextEmbedder(/document/chunks/*) | 先脱敏再分块和向量化 |
| 图片分析索引 | ImageAnalyzer → TextEmbedder | 分析图片生成描述后向量化 |
