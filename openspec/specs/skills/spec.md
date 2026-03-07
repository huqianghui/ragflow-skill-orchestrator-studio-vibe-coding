# Skills Module Specification

## Purpose

Skill 是 Pipeline 中的最小处理单元，对标 Azure AI Skillset 中的 Skill 概念。每个 Skill 接收输入、执行处理逻辑、产出输出。系统支持内置 Skill 和三种自定义 Skill（Web API、配置模板、Python 代码）。

### Requirement: Skill Data Model

#### Scenario: Skill 字段结构

- **GIVEN** 数据库中存在一个 Skill 记录
- **THEN** 该 Skill 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符, **唯一约束**)
  - skill_type (builtin | web_api | config_template | python_code)
  - description (功能描述, 可选)
  - config_schema (JSON 对象, 类型相关的配置参数 JSON Schema)
  - is_builtin (布尔值, 是否为内置 Skill)
  - source_code (文本, python_code 类型的用户代码, 可选)
  - additional_requirements (文本, python_code 额外 pip 依赖, 可选)
  - test_input (JSON 对象, python_code 测试输入数据, 可选)
  - connection_mappings (JSON 对象, python_code 连接名→Connection ID 映射, 可选)
  - required_resource_types (JSON 数组, builtin skill 所需连接类型, 可选)
  - bound_connection_id (字符串, 用户绑定的 Connection ID, 可选)
  - config_values (JSON 对象, 用户配置的参数值, 可选)
  - **pipeline_io** (JSON 对象, Pipeline I/O 默认值, 可选) — **新增字段**
  - created_at / updated_at (时间戳, 自动生成)

- **AND** pipeline_io 结构为:
  ```json
  {
    "default_context": "/document",
    "inputs": [
      {"name": "text", "source": "/document/content", "description": "Input text"}
    ],
    "outputs": [
      {"name": "chunks", "targetName": "chunks", "description": "Text chunks array"}
    ]
  }
  ```
- **AND** pipeline_io 为 null 时表示该 Skill 暂不支持在 Pipeline 中使用
- **AND** 所有 16 个内置 Skill 的 pipeline_io 在播种时设置

### Requirement: Skill CRUD 操作 [Phase 1 - 已实现]

用户可以创建、读取、更新、删除 Skill。内置 Skill 不可更新。Skill name 创建后不可修改。

#### Scenario: 创建自定义 Skill

- **WHEN** POST /api/v1/skills，body 包含:
  - name (必填)
  - skill_type (必填, web_api | config_template | python_code)
  - description (可选)
  - config_schema (可选, 默认 {})
  - source_code (可选, python_code 类型使用)
  - additional_requirements (可选)
  - test_input (可选)
  - connection_mappings (可选)
- **THEN** 系统创建 Skill 并返回 201 + 完整 Skill 对象

#### Scenario: 创建重名 Skill 被拒绝

- **GIVEN** 数据库中已存在 name 为 "my-skill" 的 Skill
- **WHEN** POST /api/v1/skills，body 中 name 为 "my-skill"
- **THEN** 返回 409 CONFLICT，message 为 "Skill with name 'my-skill' already exists"
- **AND** 数据库层 IntegrityError 作为并发写入的兜底保护

#### Scenario: 列出所有 Skill（分页）

- **WHEN** GET /api/v1/skills?page=1&page_size=10
- **THEN** 返回分页响应，含 items / total / page / page_size / total_pages
- **AND** 按 created_at 倒序排列

#### Scenario: 获取 Skill 详情

- **WHEN** GET /api/v1/skills/{id}
- **THEN** 返回完整 Skill 对象
- **AND** 若不存在返回 404 NOT_FOUND

#### Scenario: 更新自定义 Skill（name 不可修改）

- **GIVEN** 一个 is_builtin=false 的 Skill
- **WHEN** PUT /api/v1/skills/{id}，body 含需更新的字段
- **THEN** 系统更新并返回更新后的 Skill 对象
- **AND** SkillUpdate schema 不包含 name 字段，name 不可修改

#### Scenario: 更新内置 Skill 被拒绝

- **GIVEN** 一个 is_builtin=true 的 Skill
- **WHEN** PUT /api/v1/skills/{id}
- **THEN** 返回 403 FORBIDDEN "Built-in skills cannot be modified"

#### Scenario: 删除 Skill

- **WHEN** DELETE /api/v1/skills/{id}
- **THEN** 系统删除该 Skill 并返回 204
- **AND** 若不存在返回 404 NOT_FOUND

#### Scenario: 删除内置 Skill

- **GIVEN** 一个 is_builtin=true 的 Skill
- **WHEN** DELETE /api/v1/skills/{id}
- **THEN** 系统删除该 Skill 并返回 204
- **AND** skill_seeder 会在应用重启时重新创建缺失的内置 Skill

### Requirement: 内置 Skill 自动播种 [Phase 1 - 已实现]

系统启动时自动补齐缺失的内置 Skill，幂等操作。

#### Scenario: 系统启动时播种内置 Skill

- **GIVEN** 系统启动
- **WHEN** lifespan 初始化执行 seed_builtin_skills
- **THEN** 比对数据库中已有的 builtin Skill name 集合
- **AND** 仅插入缺失的内置 Skill，不更新已存在的
- **AND** 记录日志: "Seeded N built-in skills"

#### Scenario: 播种数据包含 pipeline_io

- **GIVEN** BUILTIN_SKILLS 定义列表
- **THEN** 每个 Skill 定义包含 `pipeline_io` 字段
- **AND** pipeline_io 包含该 Skill 在 Pipeline 中的默认 context、inputs、outputs 映射

### Requirement: 内置 Skill 列表 [Phase 1 - 已实现]

系统提供 16 个内置 Skill 覆盖常见数据处理场景，每个 Skill 有完整的 Python 执行实现。

#### Scenario: 内置 Skill 清单

- **GIVEN** 系统初始化完成
- **THEN** 以下 16 个内置 Skill 可用:

| # | 名称 | 资源类型 | 说明 |
|---|------|---------|------|
| 1 | DocumentCracker | azure_content_understanding / azure_doc_intelligence | 解析文档，提取纯文本和元数据 |
| 2 | TextSplitter | 无 (本地执行) | 按策略分割文本 (固定大小/句子/段落/递归) |
| 3 | TextMerger | 无 (本地执行) | 合并多个文本片段为连续文档 |
| 4 | LanguageDetector | azure_ai_foundry | 检测文本语言，返回 ISO 639-1 代码和置信度 |
| 5 | EntityRecognizer | azure_ai_foundry | 提取命名实体 (人名/地名/组织/日期/数字) |
| 6 | EntityLinker | azure_ai_foundry | 将实体链接到知识库条目 (Wikipedia 等) |
| 7 | KeyPhraseExtractor | azure_ai_foundry | 提取关键短语和核心概念 |
| 8 | SentimentAnalyzer | azure_ai_foundry | 情感分析 (正面/负面/中立) |
| 9 | PIIDetector | azure_ai_foundry | 个人信息检测与脱敏 |
| 10 | TextTranslator | azure_ai_foundry | 文本翻译，支持自动检测源语言 |
| 11 | OCR | azure_ai_foundry | 图片/扫描文档光学字符识别 |
| 12 | ImageAnalyzer | azure_ai_foundry | 图片内容分析、描述生成、标签提取 |
| 13 | TextEmbedder | azure_openai | 文本向量化 |
| 14 | GenAIPrompt | azure_openai | Azure OpenAI chat completion AI 处理 |
| 15 | Shaper | 无 (本地执行) | 数据整形，字段重映射和格式转换 |
| 16 | Conditional | 无 (本地执行) | 条件路由，根据表达式决定数据流向 |

- **AND** 每个内置 Skill 包含详细的 config_schema (JSON Schema 格式)
- **AND** 每个 Skill 声明 required_resource_types 用于自动绑定 Connection

### Requirement: Python Code Skill 执行 [Phase 1 - 已实现]

python_code 类型的 Skill 可以在隔离 venv 中执行，采用 Azure AI Search Custom Skill 请求/响应格式。

#### Scenario: 测试已保存的 Skill

- **WHEN** POST /api/v1/skills/{id}/test，body 为 Azure Custom Skill 格式的 test_input
- **THEN** 在隔离 venv 中执行 `process(data, context)`，返回包含 values / logs / execution_time_ms 的结果
- **AND** 超时 (PYTHON_SKILL_TIMEOUT_S, 默认 30s) 后强制终止

#### Scenario: 测试未保存的代码

- **WHEN** POST /api/v1/skills/test-code，body 包含 source_code / test_input / connection_mappings
- **THEN** 直接编译并执行，无需先保存 Skill

#### Scenario: 预加载导入列表

- **WHEN** GET /api/v1/skills/preloaded-imports
- **THEN** 返回 standard_library 和 third_party 两个数组，列出 venv 中预装的包

#### Scenario: Venv 管理

- **GIVEN** 基础 venv (VENV_BASE_DIR) 预装 requests / httpx / pydantic / openai / azure-* SDK 等常用包
- **WHEN** Skill 指定 additional_requirements
- **THEN** 为该 Skill 创建独立 venv，安装额外依赖

#### Scenario: SkillContext 注入

- **GIVEN** Skill 配置了 connection_mappings
- **WHEN** 执行时 process(data, context) 中的 context
- **THEN** 提供 config / logger / get_client(name) 方法
- **AND** get_client(name) 根据 Connection 类型创建对应 SDK 客户端

### Requirement: Pipeline 内 Skill 执行 [Phase 2]

#### Scenario: 执行 Web API Skill

- **GIVEN** 一个 Web API 类型的 Skill 配置了 endpoint
- **WHEN** Pipeline 执行到该 Skill 节点
- **THEN** 发送 HTTP 请求到 endpoint_url，解析响应
- **AND** 请求失败时记录错误并标记步骤失败

#### Scenario: 执行配置模板 Skill

- **GIVEN** 一个配置模板类型的 Skill
- **WHEN** Pipeline 执行到该 Skill 节点
- **THEN** 加载对应模板引擎，使用配置参数执行内置处理逻辑
