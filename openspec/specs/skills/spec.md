# Skills Module Specification

## Overview

Skill 是 Pipeline 中的最小处理单元，对标 Azure AI Skillset 中的 Skill 概念。每个 Skill 接收输入、执行处理逻辑、产出输出。系统支持内置 Skill 和三种自定义 Skill（Web API、配置模板、Python 代码上传）。

---

## REQ-SKL-001: Skill Data Model

**Requirement:** 系统应维护一个完整的 Skill 数据模型，包含名称、类型、输入/输出 schema、配置参数。

### Scenario: 创建一个内置 Skill

```
GIVEN 用户访问 Skill 管理页面
WHEN 系统加载内置 Skill 列表
THEN 每个 Skill 应包含以下字段:
  - id (唯一标识)
  - name (显示名称)
  - type (builtin | web_api | config_template | python_code)
  - description (功能描述)
  - input_schema (JSON Schema 定义输入)
  - output_schema (JSON Schema 定义输出)
  - config (类型相关的配置参数)
  - version (版本号)
  - created_at / updated_at (时间戳)
```

---

## REQ-SKL-002: Skill CRUD 操作

**Requirement:** 用户可以创建、读取、更新、删除自定义 Skill。

### Scenario: 创建 Web API 类型 Skill

```
GIVEN 用户在 Skill 管理页面点击 "新建 Skill"
WHEN 用户选择类型为 "Web API" 并填写:
  - name: "Custom Entity Extractor"
  - endpoint_url: "https://my-api.example.com/extract"
  - http_method: POST
  - headers: {"Authorization": "Bearer xxx"}
  - input_schema: {"text": "string"}
  - output_schema: {"entities": "array"}
THEN 系统保存 Skill 并返回新建的 Skill 详情
AND Skill 出现在 Skill 库列表中
```

### Scenario: 创建配置模板类型 Skill

```
GIVEN 用户在 Skill 管理页面点击 "新建 Skill"
WHEN 用户选择类型为 "配置模板" 并填写:
  - name: "Text Splitter"
  - template_type: "text_split"
  - config: {"chunk_size": 1000, "overlap": 200, "separator": "\n\n"}
THEN 系统根据模板类型验证配置参数
AND 保存 Skill 并返回详情
```

### Scenario: 创建 Python 代码上传类型 Skill

```
GIVEN 用户在 Skill 管理页面点击 "新建 Skill"
WHEN 用户选择类型为 "Python 代码" 并上传:
  - name: "Custom Transformer"
  - code_file: transform.py (包含 def execute(input_data) -> output_data)
  - requirements: ["numpy==1.24.0"]
THEN 系统验证代码文件包含 execute 函数签名
AND 安装依赖并保存 Skill
```

### Scenario: 列出所有 Skill

```
GIVEN 用户访问 Skill 库
WHEN 页面加载
THEN 系统返回所有 Skill 列表（含内置和自定义）
AND 支持按类型、名称筛选
AND 支持分页
```

### Scenario: 更新 Skill

```
GIVEN 一个已存在的自定义 Skill
WHEN 用户修改其配置参数并保存
THEN 系统更新 Skill 并递增版本号
AND 已使用该 Skill 的 Pipeline 不受影响（引用旧版本）
```

### Scenario: 删除 Skill

```
GIVEN 一个自定义 Skill 未被任何 Pipeline 引用
WHEN 用户点击删除
THEN 系统删除该 Skill

GIVEN 一个自定义 Skill 被 Pipeline 引用
WHEN 用户点击删除
THEN 系统提示 "该 Skill 正在被以下 Pipeline 使用: [列表]"
AND 阻止删除
```

---

## REQ-SKL-003: Skill 库 / 市场

**Requirement:** 系统提供一个 Skill 库，用户可以浏览、搜索、使用内置和社区 Skill。

### Scenario: 浏览 Skill 库

```
GIVEN 用户打开 Skill 库
WHEN 页面加载
THEN 显示 Skill 分类列表:
  - 文本处理 (Text Processing)
  - 实体识别 (Entity Recognition)
  - 文档解析 (Document Parsing)
  - 向量化 (Embedding)
  - 自定义 (Custom)
AND 每个 Skill 卡片显示名称、描述、类型、使用次数
```

### Scenario: 搜索 Skill

```
GIVEN 用户在 Skill 库搜索框输入关键词
WHEN 输入 "text split"
THEN 系统返回名称或描述匹配的 Skill 列表
```

---

## REQ-SKL-004: Skill 执行引擎

**Requirement:** 系统可以执行不同类型的 Skill，处理输入数据并产出输出数据。

### Scenario: 执行 Web API Skill

```
GIVEN 一个 Web API 类型的 Skill 配置了 endpoint
WHEN Pipeline 执行到该 Skill 节点
THEN 系统将输入数据按 input_schema 格式化
AND 发送 HTTP 请求到 endpoint_url
AND 解析响应为 output_schema 格式
AND 如果请求失败，记录错误并标记步骤失败
```

### Scenario: 执行配置模板 Skill

```
GIVEN 一个配置模板类型的 Skill
WHEN Pipeline 执行到该 Skill 节点
THEN 系统加载对应模板引擎
AND 使用配置参数执行内置处理逻辑
AND 返回处理结果
```

### Scenario: 执行 Python 代码 Skill

```
GIVEN 一个 Python 代码类型的 Skill
WHEN Pipeline 执行到该 Skill 节点
THEN 系统在隔离环境中加载代码
AND 调用 execute(input_data) 函数
AND 捕获返回值作为输出
AND 捕获异常并记录到日志
AND 执行超时 (默认 60s) 后强制终止
```

---

## REQ-SKL-005: 内置 Skill 列表

**Requirement:** 系统应提供一组内置 Skill 覆盖常见数据处理场景。

### Scenario: 系统初始化时加载内置 Skill

```
GIVEN 系统首次启动
WHEN 初始化完成
THEN 以下内置 Skill 可用:
  - DocumentCracker: 解析 PDF/DOCX/TXT/HTML 提取纯文本
  - TextSplitter: 按策略分割文本 (固定大小/句子/段落)
  - LanguageDetector: 检测文本语言
  - EntityRecognizer: 提取命名实体
  - KeyPhraseExtractor: 提取关键短语
  - TextEmbedder: 生成文本向量 (支持多种模型)
  - ImageAnalyzer: 图片 OCR + 描述
  - TextTranslator: 文本翻译
  - SentimentAnalyzer: 情感分析
  - PII Redactor: 个人信息脱敏
```
