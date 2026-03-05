# Skill 管理与执行引擎 - 实施任务清单

## 阶段一：Skill 数据模型与 API

### 1.1 数据模型

- [ ] 定义 `SkillBase` Pydantic 模型及 `SkillType` 枚举（`built_in`, `web_api`, `config_template`, `python_code`）
- [ ] 实现 `BuiltInSkill` 模型，包含 `processor_class` 字段
- [ ] 实现 `WebApiSkill` 模型，包含 `endpoint_url`, `http_method`, `auth_type`, `auth_config`, `request_mapping`, `response_mapping`, `RetryConfig`
- [ ] 实现 `ConfigTemplateSkill` 模型，包含 `processor_type`, `template_config`, `parameter_overrides`
- [ ] 实现 `PythonCodeSkill` 模型，包含 `code_content`, `entry_function`, `requirements`, `SandboxConfig`
- [ ] 创建数据库 migration：`skills` 主表
- [ ] 创建数据库 migration：`skill_web_api_configs` 扩展表
- [ ] 创建数据库 migration：`skill_config_template_configs` 扩展表
- [ ] 创建数据库 migration：`skill_python_code_configs` 扩展表
- [ ] 实现 `SkillRepository`（数据访问层），支持多态查询和类型特定表的 JOIN 读写

### 1.2 CRUD API

- [ ] 实现 `GET /api/v1/skills` - 列出 Skill，支持分页、按 `skill_type` / `category` / `tags` 筛选
- [ ] 实现 `POST /api/v1/skills` - 创建自定义 Skill，根据 `skill_type` 写入对应扩展表
- [ ] 实现 `GET /api/v1/skills/{skill_id}` - 获取 Skill 详情（含扩展配置）
- [ ] 实现 `PUT /api/v1/skills/{skill_id}` - 更新 Skill，校验 `skill_type` 不可变
- [ ] 实现 `DELETE /api/v1/skills/{skill_id}` - 删除 Skill（检查是否被 Pipeline 引用）
- [ ] 实现 `POST /api/v1/skills/{skill_id}/clone` - 克隆 Skill
- [ ] 实现 `GET /api/v1/skills/built-in` - 列出所有内置 Skill
- [ ] 实现 `input_schema` / `output_schema` / `config_schema` 的 JSON Schema 校验逻辑
- [ ] 编写 API 单元测试：CRUD 各接口覆盖正常流程和异常流程

---

## 阶段二：Web API Skill Engine

### 2.1 核心引擎

- [ ] 实现 `WebApiSkillEngine` 类，封装 `httpx.AsyncClient`
- [ ] 实现 Request Mapping 逻辑：基于 JSONPath 的输入数据到请求体映射
- [ ] 实现 Response Mapping 逻辑：基于 JSONPath 的响应体到输出数据映射
- [ ] 实现指数退避重试逻辑（`RetryConfig`：`max_retries`, `retry_delay`, `backoff_multiplier`, `retry_on_status_codes`）
- [ ] 实现请求超时控制（`timeout_seconds` 配置）

### 2.2 认证支持

- [ ] 实现 `bearer` token 认证 Header 生成
- [ ] 实现 `api_key` 认证 Header 生成（自定义 key_name）
- [ ] 实现 `basic` 认证 Header 生成（Base64 编码）
- [ ] 实现 `auth_config` 的加密存储和解密读取（对接 credential 管理）

### 2.3 测试

- [ ] 单元测试：Request/Response Mapping 的 JSONPath 转换
- [ ] 单元测试：重试逻辑（mock 各种 HTTP 错误码）
- [ ] 单元测试：各认证方式的 Header 生成
- [ ] 集成测试：使用 mock HTTP server 验证完整执行流程

---

## 阶段三：Config Template Skill Engine

### 3.1 内置处理器

- [ ] 实现 `TextSplitProcessor` - 文本分块处理器（支持 `recursive`, `character`, `token` 等策略）
- [ ] 实现 `LanguageDetectProcessor` - 语言检测处理器
- [ ] 实现 `TextCleanProcessor` - 文本清洗处理器（HTML 去标签、空白规范化等）
- [ ] 实现 `RegexExtractProcessor` - 正则提取处理器
- [ ] 实现 `JsonTransformProcessor` - JSON 转换处理器
- [ ] 实现 `FieldMappingProcessor` - 字段映射处理器
- [ ] 实现 `FilterProcessor` - 条件过滤处理器
- [ ] 建立 `BUILT_IN_PROCESSORS` 注册字典

### 3.2 模板引擎

- [ ] 实现 `ConfigTemplateSkillEngine` 类
- [ ] 实现配置合并逻辑：`template_config` + `parameter_overrides` + 运行时 `config`
- [ ] 实现 `parameter_overrides` 允许列表校验（防止覆盖不可变参数）
- [ ] 支持 YAML / JSON 两种模板格式

### 3.3 测试

- [ ] 单元测试：每个内置 Processor 的核心功能
- [ ] 单元测试：配置合并优先级
- [ ] 集成测试：通过 Config Template 创建并执行自定义 Skill

---

## 阶段四：Python Code Skill Engine

### 4.1 沙箱执行

- [ ] 实现 `PythonCodeSkillEngine` 类
- [ ] 实现沙箱工作目录创建和清理逻辑（`/tmp/skill_sandbox/{skill_id}_{uuid}`）
- [ ] 实现 `_install_dependencies`：在沙箱 virtualenv 中 `pip install` 用户指定依赖
- [ ] 实现 `_write_code`：将用户代码写入沙箱文件
- [ ] 实现 `_write_runner`：生成执行入口脚本，序列化 `input_data` 和 `config`
- [ ] 实现 `_run_in_sandbox`：使用 `asyncio.create_subprocess_exec` 在子进程中执行

### 4.2 安全隔离

- [ ] 实现内存限制：`resource.setrlimit(RLIMIT_AS, ...)`
- [ ] 实现 CPU 时间限制：`resource.setrlimit(RLIMIT_CPU, ...)`
- [ ] 实现超时控制：`asyncio.wait_for` 硬超时
- [ ] 实现输出大小限制：截断超过 `max_output_size_mb` 的 stdout
- [ ] 实现 import 白名单校验（可选）：扫描用户代码中的 import 语句
- [ ] 实现网络隔离（可选）：当 `network_enabled=False` 时限制网络访问

### 4.3 代码校验

- [ ] 实现上传代码的语法检查（`ast.parse`）
- [ ] 实现入口函数签名校验：确保 `entry_function` 存在且接受 `(input_data, config)` 参数
- [ ] 实现 `requirements` 安全校验：检查是否有已知恶意包

### 4.4 测试

- [ ] 单元测试：正常代码执行和结果返回
- [ ] 单元测试：内存超限时的错误处理
- [ ] 单元测试：CPU 超时时的错误处理
- [ ] 单元测试：代码语法错误时的错误处理
- [ ] 单元测试：入口函数不存在时的错误处理
- [ ] 集成测试：完整的上传代码 → 安装依赖 → 执行 → 返回结果流程

---

## 阶段五：内置 Skills 实现

### 5.1 核心内置 Skill

- [ ] 实现 `DocumentCracker` BuiltInSkill - 文档解析（PDF, DOCX, HTML, Markdown, TXT）
- [ ] 实现 `TextSplitter` BuiltInSkill - 文本分块（recursive, character, token, sentence 策略）
- [ ] 实现 `TextEmbedder` BuiltInSkill - 文本向量化（对接 OpenAI, HuggingFace, 本地模型）
- [ ] 实现 `TextCleaner` BuiltInSkill - 文本清洗
- [ ] 实现 `LanguageDetector` BuiltInSkill - 语言检测
- [ ] 实现 `EntityExtractor` BuiltInSkill - 命名实体识别
- [ ] 实现 `KeywordExtractor` BuiltInSkill - 关键词提取
- [ ] 实现 `TextTranslator` BuiltInSkill - 文本翻译
- [ ] 实现 `VectorSearcher` BuiltInSkill - 向量检索
- [ ] 实现 `LLMInvoker` BuiltInSkill - LLM 调用

### 5.2 Skill Registry

- [ ] 实现 `SkillRegistry` 类，管理引擎注册和 Skill 发现
- [ ] 实现 `create_skill_registry()` 工厂函数，完成初始化注册
- [ ] 实现统一执行入口 `execute_skill()`，根据 `skill_type` 分发到对应引擎
- [ ] 在应用启动时自动注册所有内置 Skill

### 5.3 Skill 执行 API

- [ ] 实现 `POST /api/v1/skills/{skill_id}/execute` - 单独执行 Skill（测试模式）
- [ ] 实现 `POST /api/v1/skills/{skill_id}/validate` - 校验 Skill 配置有效性
- [ ] 返回执行结果包含 `output`, `execution_time_ms`, `metadata`（引擎类型、详细状态）

### 5.4 测试

- [ ] 每个内置 Skill 的单元测试（输入/输出/异常）
- [ ] SkillRegistry 的单元测试（注册、发现、分发）
- [ ] Skill 执行 API 的集成测试

---

## 阶段六：Skill Library / Marketplace

### 6.1 数据模型

- [ ] 创建数据库 migration：`skill_library` 表
- [ ] 创建数据库 migration：`skill_ratings` 表
- [ ] 实现 `SkillLibraryRepository` 数据访问层

### 6.2 发布与安装

- [ ] 实现 `POST /api/v1/skill-library/publish` - 发布 Skill 到库
  - 验证 Skill 完整性
  - 生成发布版本快照
  - 安全扫描（Python Code 类型）
- [ ] 实现 `POST /api/v1/skill-library/{library_id}/install` - 从库安装 Skill
  - 复制 Skill 定义到当前租户
  - 处理依赖冲突
- [ ] 实现 `GET /api/v1/skill-library` - 搜索 Skill 库
  - 支持关键词搜索
  - 支持按 category、tags、rating 筛选
  - 支持按下载量、评分排序

### 6.3 评分系统

- [ ] 实现 `POST /api/v1/skill-library/{library_id}/rate` - 评分（1-5 星 + 评论）
- [ ] 实现评分聚合计算（平均分、评分数更新）
- [ ] 实现每用户单次评分约束

### 6.4 前端 UI

- [ ] Skill Library 浏览页面 - 卡片式列表展示，搜索和筛选
- [ ] Skill 详情页面 - 展示 README、评分、版本、安装按钮
- [ ] Skill 发布页面 - 填写发布信息、预览
- [ ] 评分和评论组件

### 6.5 测试

- [ ] 发布/安装流程集成测试
- [ ] 搜索和筛选功能测试
- [ ] 评分系统测试
- [ ] 并发安装/评分的数据一致性测试

---

## 阶段七：Skill 管理前端 UI

### 7.1 Skill 管理页面

- [ ] Skill 列表页面 - 表格展示所有 Skill，支持搜索、筛选（类型/分类/标签）
- [ ] Skill 创建向导 - 分步表单，根据 `skill_type` 动态展示不同配置项
- [ ] Web API Skill 配置表单 - URL、认证、Mapping 编辑器
- [ ] Config Template Skill 配置表单 - 处理器类型选择、模板编辑器
- [ ] Python Code Skill 配置表单 - 代码编辑器（Monaco Editor）、依赖管理、沙箱配置
- [ ] Skill 详情/编辑页面 - 展示完整配置，支持内联编辑
- [ ] Skill 测试面板 - 输入测试数据、执行、查看输出结果和执行日志

### 7.2 Schema 编辑器

- [ ] JSON Schema 可视化编辑器组件 - 用于编辑 `input_schema` / `output_schema` / `config_schema`
- [ ] Schema 预览和校验功能

---

## 阶段八：端到端测试与文档

### 8.1 端到端测试

- [ ] E2E 测试：创建 Web API Skill → 配置 → 执行 → 验证输出
- [ ] E2E 测试：创建 Config Template Skill → 配置 → 执行 → 验证输出
- [ ] E2E 测试：创建 Python Code Skill → 上传代码 → 安装依赖 → 执行 → 验证输出
- [ ] E2E 测试：内置 Skill 在 Pipeline 中的完整执行
- [ ] E2E 测试：Skill Library 发布 → 搜索 → 安装 → 执行
- [ ] 性能测试：并发 Skill 执行的吞吐量和延迟
- [ ] 安全测试：Python Code Skill 沙箱逃逸测试

### 8.2 文档

- [ ] Skill 开发者指南：如何创建三种自定义 Skill
- [ ] 内置 Skill 参考文档：每个内置 Skill 的输入/输出/配置说明
- [ ] API 参考文档：Skill 相关 API 的 OpenAPI 规范
- [ ] Skill Library 使用指南：发布和安装流程
