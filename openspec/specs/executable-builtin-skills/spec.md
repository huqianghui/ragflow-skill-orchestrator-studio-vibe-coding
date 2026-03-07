# Executable Built-in Skills Specification

## Purpose

Make all built-in skills fully executable with Azure resource binding, configuration, on-page testing, and pipeline-ready execution. Aligned with Azure AI Search's built-in skill architecture.

---

### Requirement: Connection Default Support

#### Scenario: Connection 新增 is_default 字段

- **GIVEN** Connection model
- **THEN** 新增 `is_default` (Boolean, default=False) 字段
- **AND** 每种 connection_type 最多有一个 is_default=true 的 Connection

#### Scenario: 设置默认连接

- **WHEN** PUT /api/v1/connections/{id}/set-default
- **THEN** 将该 Connection 的 is_default 设为 true
- **AND** 同类型其他 Connection 的 is_default 设为 false
- **AND** 返回更新后的 ConnectionResponse

#### Scenario: 获取各类型默认连接

- **WHEN** GET /api/v1/connections/defaults
- **THEN** 返回每种 connection_type 的默认 Connection（或 null）
- **AND** 格式为 `{ "azure_ai_foundry": ConnectionResponse | null, ... }`

---

### Requirement: Skill Model 扩展

#### Scenario: Skill 新增字段

- **GIVEN** Skill model
- **THEN** 新增以下字段:
  - `required_resource_types` (JSON, 可选) — 声明需要的连接类型列表，如 `["azure_ai_foundry"]`
  - `bound_connection_id` (String, 可选) — 用户选择的 Connection ID
  - `config_values` (JSON, 可选) — 用户配置的参数值

#### Scenario: Built-in Skill 播种数据更新

- **GIVEN** BUILTIN_SKILLS 定义列表
- **THEN** 每个 skill 新增 `required_resource_types` 字段:

| Skill | required_resource_types |
|-------|------------------------|
| DocumentCracker | `["azure_content_understanding", "azure_doc_intelligence"]` |
| TextSplitter | `null` (本地执行) |
| TextMerger | `null` |
| LanguageDetector | `["azure_ai_foundry"]` |
| EntityRecognizer | `["azure_ai_foundry"]` |
| EntityLinker | `["azure_ai_foundry"]` |
| KeyPhraseExtractor | `["azure_ai_foundry"]` |
| SentimentAnalyzer | `["azure_ai_foundry"]` |
| PIIDetector | `["azure_ai_foundry"]` |
| TextTranslator | `["azure_ai_foundry"]` |
| OCR | `["azure_ai_foundry"]` |
| ImageAnalyzer | `["azure_ai_foundry"]` |
| TextEmbedder | `["azure_openai"]` |
| GenAIPrompt | `["azure_openai"]` |
| Shaper | `null` |
| Conditional | `null` |

#### Scenario: 新增 GenAIPrompt 内置 Skill

- **GIVEN** BUILTIN_SKILLS 定义列表
- **THEN** 新增第 16 个 skill:
  - name: "GenAIPrompt"
  - description: "使用 Azure OpenAI chat completion 模型对文本进行 AI 处理，支持摘要、分类、信息提取等"
  - required_resource_types: `["azure_openai"]`
  - config_schema 包含: system_prompt, user_prompt_template, model_deployment, temperature, max_tokens

---

### Requirement: Built-in Skill 配置 API

#### Scenario: 配置 Built-in Skill 参数和连接

- **WHEN** PUT /api/v1/skills/{id}/configure，body 包含:
  - config_values (可选, 用户的参数选择)
  - bound_connection_id (可选, 选择的连接 ID)
- **THEN** 更新 skill 的 config_values 和 bound_connection_id
- **AND** 返回完整 SkillResponse

#### Scenario: 非 Built-in Skill 不可使用 configure

- **GIVEN** is_builtin=false 的 Skill
- **WHEN** PUT /api/v1/skills/{id}/configure
- **THEN** 返回 403 "Only built-in skills can be configured via this endpoint"

#### Scenario: bound_connection_id 类型校验

- **WHEN** configure 时传入 bound_connection_id
- **THEN** 校验该 Connection 的 connection_type 在 skill 的 required_resource_types 中
- **AND** 类型不匹配时返回 400 "Connection type 'X' not compatible with skill requirement Y"

---

### Requirement: Built-in Skill 执行引擎

#### Scenario: 测试 Built-in Skill

- **WHEN** POST /api/v1/skills/{id}/test，body 包含 test_input
- **AND** skill.skill_type == "builtin"
- **THEN** 根据 skill.name 查找对应的 BuiltinSkillRunner 实现
- **AND** 使用 bound_connection_id 解密获取 SDK 客户端
- **AND** 使用 config_values (或 config_override) 作为配置参数
- **AND** 返回与 python_code 相同格式的结果 (values / logs / execution_time_ms)

#### Scenario: 测试时支持 config_override

- **WHEN** POST /api/v1/skills/{id}/test，body 包含 config_override
- **THEN** config_override 的值临时覆盖 config_values（不持久化）
- **AND** 方便用户在保存前调试参数

#### Scenario: 本地 Skill 无需连接

- **GIVEN** skill.required_resource_types 为 null (TextSplitter, TextMerger, Shaper, Conditional)
- **WHEN** 测试该 Skill
- **THEN** 直接执行本地逻辑，不需要 bound_connection_id

#### Scenario: 需要连接但未绑定

- **GIVEN** skill.required_resource_types 不为 null
- **AND** skill.bound_connection_id 为 null
- **WHEN** 测试该 Skill
- **THEN** 尝试使用 required_resource_types 中第一个类型的 default connection
- **AND** 如果无 default connection，返回 400 "No connection bound and no default connection for type 'X'"

---

### Requirement: 文件上传测试

#### Scenario: 上传测试文件

- **WHEN** POST /api/v1/skills/upload-test-file (multipart/form-data)
- **THEN** 保存文件到临时目录
- **AND** 返回 `{ file_id, filename, content_type, size, expires_at }`
- **AND** 文件 1 小时后自动清理

#### Scenario: 在测试输入中引用上传文件

- **WHEN** test_input 中 data 包含 `file_id` 字段
- **THEN** 执行引擎自动解析 file_id 为实际文件路径/内容
- **AND** 传递给 skill 实现的 data 中包含 file_content (bytes) 和 file_name

---

### Requirement: Built-in Skill 实现 (16 个)

#### Scenario: Foundry Language Skills (6 个)

每个 skill 调用 Azure AI Language REST API (`/language/:analyze-text`):

| Skill | API kind | 特殊参数 |
|-------|----------|---------|
| EntityRecognizer | EntityRecognition | entity_categories, min_confidence |
| EntityLinker | EntityLinking | min_confidence |
| KeyPhraseExtractor | KeyPhraseExtraction | max_phrases |
| SentimentAnalyzer | SentimentAnalysis | granularity, include_opinion_mining |
| PIIDetector | PiiEntityRecognition | pii_categories, redaction_mode |
| LanguageDetector | LanguageDetection | default_language |

#### Scenario: Foundry Translator Skill (1 个)

- TextTranslator 调用 Azure Translator REST API
- 参数: target_language, source_language

#### Scenario: Foundry Vision Skills (2 个)

- OCR 调用 Azure AI Vision OCR API
- ImageAnalyzer 调用 Azure AI Vision Image Analysis API
- 两者都支持 file_id 输入（二进制图片数据）

#### Scenario: Azure OpenAI Skills (2 个)

- TextEmbedder 使用 AzureOpenAI SDK `client.embeddings.create()`
- GenAIPrompt 使用 AzureOpenAI SDK `client.chat.completions.create()`
- 需要额外配置: model_deployment (从 config_values 读取)

#### Scenario: Document Processing Skill (1 个)

- DocumentCracker 默认使用 Azure Content Understanding
- 可切换为 Azure Document Intelligence
- 支持 file_id 输入 (PDF/DOCX/HTML 等)
- Azure Document Intelligence 模式使用 `prebuilt-layout` model + `outputContentFormat=markdown`
- 返回结构化结果: `markdown`, `text`, `tables` (HTML), `figures`, `selectionMarks`, `pages`, `metadata`

#### Scenario: Utility Skills (4 个, 本地执行)

- TextSplitter: 纯 Python 文本分块 (支持 fixed_size/sentence/paragraph/recursive)
- TextMerger: 纯 Python 文本合并
- Shaper: 字段重映射和转换
- Conditional: 条件判断和路由

---

### Requirement: Frontend - BuiltinSkillEditor 页面

#### Scenario: 页面布局 (标准 2 栏)

- **WHEN** 用户访问 /skills/{id}/configure (非 DocumentCracker)
- **THEN** 显示两栏布局:
  - 左栏: Skill 描述 (只读) + Resource Binding + Configuration Form
  - 右栏: Test Input (文本/文件上传) + Test Output
- **AND** 顶部显示 Back 按钮、Skill 名称 + "(Built-in)" 标签、Save 按钮

#### Scenario: Document Intelligence Studio 布局 (3 栏)

- **WHEN** 用户访问 /skills/{id}/configure (DocumentCracker)
- **THEN** 显示 3 栏 Document Intelligence Studio 布局:
  - 左栏 (~160px): 文件上传拖放区 + 已上传文件缩略图 (图片 img、PDF 缩放 iframe、其他文件 icon)
  - 中栏 (flex): 文档预览 (PDF iframe / 图片 img)
  - 右栏 (~480px): 分页输出面板
    - 一级 Tab: Content | Result JSON
    - Content 下二级 Tab: Markdown | Text | Tables | Figures | Selection marks
    - Markdown Tab: 使用 react-markdown + rehype-raw 渲染 (支持 HTML table/figure 标签)
    - Text Tab: 带行号的纯文本
    - Tables Tab: 渲染 HTML 表格
    - Figures Tab: figure caption + bounding region 列表
    - Selection marks Tab: checkbox + 状态 + 置信度
- **AND** 顶部显示 Back 按钮、Skill 名称 + Built-in 标签、齿轮 (配置) 按钮、Save 按钮
- **AND** 配置面板 (Resource Binding + Configuration Form) 通过齿轮按钮折叠/展开
- **AND** 文件上传支持拖放 (drag & drop)

#### Scenario: 文件预览端点

- **WHEN** GET /api/v1/skills/test-file/{file_id}
- **THEN** 返回已上传文件的原始内容，Content-Type 与上传时一致
- **AND** 使用 RFC 5987 `filename*=UTF-8''` 编码支持非 ASCII 文件名
- **AND** 用于 iframe (PDF) 或 img (图片) 预览

#### Scenario: Resource Binding 卡片

- **GIVEN** skill.required_resource_types 不为 null
- **THEN** 显示 "Required: {resource_type_label}" 文字
- **AND** Connection 下拉框，筛选匹配 required_resource_types 的 Connection
- **AND** 自动选中 default connection (如果有)
- **AND** 下拉旁显示连接状态指示器 (✅ / ❌)

#### Scenario: 本地 Skill 无 Resource Binding

- **GIVEN** skill.required_resource_types 为 null
- **THEN** 显示 "✅ No external resource needed (local execution)"

#### Scenario: Configuration Form 自动生成

- **GIVEN** skill.config_schema 是 JSON Schema
- **THEN** 自动生成表单:
  - `string` + `enum` → Select 下拉
  - `string` (plain) → Input 文本框
  - `boolean` → Switch 开关
  - `integer`/`number` → InputNumber 或 Slider (如有 min/max)
  - `array` of `string` (有预定义选项) → Checkbox.Group
  - `array` (自由输入) → Select mode="tags"
- **AND** 使用 config_schema 中的 `default` 值预填

#### Scenario: Test Input

- **THEN** 提供文本输入框 (TextArea)
- **AND** "Upload File" 按钮 (调用 upload-test-file API)
- **AND** "Run Test" 按钮
- **AND** 文本输入模式: 直接输入文本，包装为 `{"values": [{"recordId":"1","data":{"text": "<input>"}}]}`
- **AND** 文件上传模式: 上传后自动填入 file_id

#### Scenario: Test Output

- **THEN** 复用 SkillEditor 中已有的 test result 显示组件
- **AND** 显示状态 Tag + 执行耗时 + record 数据/错误 + logs

---

### Requirement: Frontend - Connection Default 功能

#### Scenario: Connection 列表显示默认标记

- **WHEN** 用户查看 Connections 页面
- **THEN** 每行显示星标图标
- **AND** is_default=true 的行显示实心星标 (金色)
- **AND** 其他行显示空心星标

#### Scenario: 切换默认连接

- **WHEN** 用户点击某行的星标
- **THEN** 调用 PUT /api/v1/connections/{id}/set-default
- **AND** 刷新列表，同类型旧 default 的星标变空心

---

### Requirement: SkillLibrary 导航更新

#### Scenario: Built-in Skill 点击跳转

- **WHEN** 用户在 SkillLibrary 点击 built-in skill 名称
- **THEN** 导航到 /skills/{id}/configure (BuiltinSkillEditor)
- **AND** 不再打开详情 Modal

#### Scenario: Actions 列按钮

- **GIVEN** 一个 built-in skill
- **THEN** 显示 "Configure" 按钮 (替代 disabled 的 "Edit")
- **AND** "Configure" 点击导航到 /skills/{id}/configure
