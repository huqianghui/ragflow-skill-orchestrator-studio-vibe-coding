# Skills Module Specification

## Purpose

Skill 是 Pipeline 中的最小处理单元，对标 Azure AI Skillset 中的 Skill 概念。每个 Skill 接收输入、执行处理逻辑、产出输出。系统支持内置 Skill 和三种自定义 Skill（Web API、配置模板、Python 代码上传）。

### Requirement: Skill Data Model

#### Scenario: Skill 字段结构

- **GIVEN** 数据库中存在一个 Skill 记录
- **THEN** 该 Skill 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符)
  - skill_type (builtin | web_api | config_template | python_code)
  - description (功能描述, 可选)
  - config_schema (JSON 对象, 类型相关的配置参数 JSON Schema)
  - is_builtin (布尔值, 是否为内置 Skill)
  - created_at / updated_at (时间戳, 自动生成)
  - [Phase 2 计划字段]:
    - input_schema (JSON Schema 定义输入)
    - output_schema (JSON Schema 定义输出)
    - version (版本号)

### Requirement: Skill CRUD 操作

用户可以创建、读取、更新、删除 Skill。内置 Skill 不可更新。

#### Scenario: 创建自定义 Skill

- **WHEN** POST /api/v1/skills，body 包含:
  - name (必填)
  - skill_type (必填, web_api | config_template | python_code)
  - description (可选)
  - config_schema (可选, 默认 {})
- **THEN** 系统创建 Skill 并返回 201 + 完整 Skill 对象

#### Scenario: 列出所有 Skill（分页）

- **WHEN** GET /api/v1/skills?page=1&page_size=10
- **THEN** 返回分页响应，含 items / total / page / page_size / total_pages
- **AND** 按 created_at 倒序排列

#### Scenario: 获取 Skill 详情

- **WHEN** GET /api/v1/skills/{id}
- **THEN** 返回完整 Skill 对象
- **AND** 若不存在返回 404 NOT_FOUND

#### Scenario: 更新自定义 Skill

- **GIVEN** 一个 is_builtin=false 的 Skill
- **WHEN** PUT /api/v1/skills/{id}，body 含需更新的字段
- **THEN** 系统更新并返回更新后的 Skill 对象

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

### Requirement: 内置 Skill 自动播种

系统启动时自动补齐缺失的内置 Skill，幂等操作。

#### Scenario: 系统启动时播种内置 Skill

- **GIVEN** 系统启动
- **WHEN** lifespan 初始化执行 seed_builtin_skills
- **THEN** 比对数据库中已有的 builtin Skill name 集合
- **AND** 仅插入缺失的内置 Skill，不更新已存在的
- **AND** 记录日志: "Seeded N built-in skills"

### Requirement: 内置 Skill 列表

系统提供 15 个内置 Skill 覆盖常见数据处理场景。

#### Scenario: 内置 Skill 清单

- **GIVEN** 系统初始化完成
- **THEN** 以下 15 个内置 Skill 可用:

| # | 名称 | 说明 |
|---|------|------|
| 1 | DocumentCracker | 解析 PDF/DOCX/HTML/TXT/Markdown，提取纯文本和元数据 |
| 2 | TextSplitter | 按策略分割文本 (固定大小/句子/段落/递归) |
| 3 | TextMerger | 合并多个文本片段为连续文档 |
| 4 | LanguageDetector | 检测文本语言，返回 ISO 639-1 代码和置信度 |
| 5 | EntityRecognizer | 提取命名实体 (人名/地名/组织/日期/数字) |
| 6 | EntityLinker | 将实体链接到知识库条目 (Wikipedia 等) |
| 7 | KeyPhraseExtractor | 提取关键短语和核心概念 |
| 8 | SentimentAnalyzer | 情感分析 (正面/负面/中立) |
| 9 | PIIDetector | 个人信息检测与脱敏 (姓名/身份证/电话/邮箱等) |
| 10 | TextTranslator | 文本翻译，支持自动检测源语言 |
| 11 | OCR | 图片/扫描文档光学字符识别 |
| 12 | ImageAnalyzer | 图片内容分析、描述生成、标签提取 |
| 13 | TextEmbedder | 文本向量化 (支持 OpenAI/Azure OpenAI/本地模型) |
| 14 | Shaper | 数据整形，字段重映射和格式转换 |
| 15 | Conditional | 条件路由，根据表达式决定数据流向 |

- **AND** 每个内置 Skill 包含详细的 config_schema (JSON Schema 格式)

### Requirement: Skill 执行引擎 [Phase 2]

系统可以执行不同类型的 Skill，处理输入数据并产出输出数据。

#### Scenario: 执行 Web API Skill

- **GIVEN** 一个 Web API 类型的 Skill 配置了 endpoint
- **WHEN** Pipeline 执行到该 Skill 节点
- **THEN** 发送 HTTP 请求到 endpoint_url，解析响应
- **AND** 请求失败时记录错误并标记步骤失败

#### Scenario: 执行配置模板 Skill

- **GIVEN** 一个配置模板类型的 Skill
- **WHEN** Pipeline 执行到该 Skill 节点
- **THEN** 加载对应模板引擎，使用配置参数执行内置处理逻辑

#### Scenario: 执行 Python 代码 Skill

- **GIVEN** 一个 Python 代码类型的 Skill
- **WHEN** Pipeline 执行到该 Skill 节点
- **THEN** 在隔离环境中调用 execute(input_data)
- **AND** 执行超时 (默认 60s) 后强制终止

### Requirement: Skill 库浏览与搜索 [Phase 2]

#### Scenario: Skill 分类浏览

- **GIVEN** 用户打开 Skill 库
- **THEN** 显示分类: 文本处理、实体识别、文档解析、向量化、自定义
- **AND** 每个 Skill 显示名称、描述、类型

#### Scenario: Skill 搜索

- **WHEN** 用户搜索关键词
- **THEN** 返回名称或描述匹配的 Skill 列表
