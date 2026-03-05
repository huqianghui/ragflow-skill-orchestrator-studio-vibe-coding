# Skill 管理与执行引擎 - 详细设计

## 1. Skill 类型层次与多态设计

### 1.1 抽象基类

所有 Skill 共享统一的基类接口，通过多态实现不同执行策略：

```python
class SkillType(str, Enum):
    BUILT_IN = "built_in"
    WEB_API = "web_api"
    CONFIG_TEMPLATE = "config_template"
    PYTHON_CODE = "python_code"

class SkillBase(BaseModel):
    """Skill 抽象基类"""
    id: str                          # UUID
    name: str                        # Skill 名称（唯一标识）
    display_name: str                # 显示名称
    description: str                 # 描述
    skill_type: SkillType            # 类型鉴别器
    version: str                     # 语义版本号 (semver)
    category: str                    # 分类标签（e.g. "text_processing", "embedding"）
    input_schema: dict               # JSON Schema - 输入数据结构定义
    output_schema: dict              # JSON Schema - 输出数据结构定义
    config_schema: dict              # JSON Schema - 配置参数结构定义
    default_config: dict             # 默认配置值
    is_system: bool = False          # 是否为系统内置
    author: str                      # 作者
    tags: list[str] = []             # 标签
    created_at: datetime
    updated_at: datetime
```

### 1.2 具体 Skill 类型

```python
class BuiltInSkill(SkillBase):
    """内置 Skill - 系统预置，不可修改"""
    skill_type: Literal[SkillType.BUILT_IN]
    processor_class: str             # 内置处理器类路径 e.g. "ragflow.processors.TextSplitter"
    is_system: bool = True

class WebApiSkill(SkillBase):
    """Web API Skill - 调用外部 HTTP 服务"""
    skill_type: Literal[SkillType.WEB_API]
    endpoint_url: str                # API endpoint URL
    http_method: str = "POST"        # HTTP method
    headers: dict = {}               # 自定义请求头
    auth_type: str | None = None     # 认证方式: "bearer", "api_key", "basic", "none"
    auth_config: dict = {}           # 认证配置（加密存储）
    request_mapping: dict = {}       # 输入到请求体的映射规则
    response_mapping: dict = {}      # 响应到输出的映射规则
    timeout_seconds: int = 30        # 请求超时（秒）
    retry_config: RetryConfig        # 重试配置

class ConfigTemplateSkill(SkillBase):
    """Config Template Skill - 通过配置模板组合内置处理器"""
    skill_type: Literal[SkillType.CONFIG_TEMPLATE]
    processor_type: str              # 内置处理器类型
    template_config: dict            # 处理器配置模板
    parameter_overrides: dict = {}   # 允许用户覆盖的参数

class PythonCodeSkill(SkillBase):
    """Python Code Upload Skill - 上传自定义 Python 代码"""
    skill_type: Literal[SkillType.PYTHON_CODE]
    code_content: str                # Python 代码内容
    entry_function: str = "execute"  # 入口函数名
    requirements: list[str] = []     # pip 依赖列表
    sandbox_config: SandboxConfig    # 沙箱配置
```

### 1.3 辅助配置模型

```python
class RetryConfig(BaseModel):
    """重试配置"""
    max_retries: int = 3
    retry_delay_seconds: float = 1.0
    backoff_multiplier: float = 2.0
    retry_on_status_codes: list[int] = [429, 500, 502, 503, 504]

class SandboxConfig(BaseModel):
    """沙箱配置"""
    max_memory_mb: int = 512         # 最大内存限制
    max_cpu_seconds: int = 60        # 最大 CPU 时间
    max_output_size_mb: int = 10     # 最大输出大小
    network_enabled: bool = False    # 是否允许网络访问
    allowed_imports: list[str] = []  # 允许的 import 白名单
```

---

## 2. Web API Skill Engine

### 2.1 架构设计

WebApiSkillEngine 封装完整的 HTTP 客户端逻辑，处理外部 API 调用的全生命周期：

```
输入数据 → Request Mapping → HTTP Request → Retry/Timeout → Response Parsing → Response Mapping → 输出数据
```

### 2.2 核心实现

```python
class WebApiSkillEngine:
    """Web API Skill 执行引擎"""

    def __init__(self):
        self.http_client = httpx.AsyncClient(
            follow_redirects=True,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
        )

    async def execute(self, skill: WebApiSkill, input_data: dict, config: dict) -> dict:
        """执行 Web API Skill"""
        # 1. 构建请求
        request_body = self._apply_request_mapping(skill.request_mapping, input_data)
        headers = self._build_headers(skill.headers, skill.auth_type, skill.auth_config)

        # 2. 带重试的 HTTP 调用
        response = await self._execute_with_retry(
            method=skill.http_method,
            url=skill.endpoint_url,
            headers=headers,
            body=request_body,
            timeout=skill.timeout_seconds,
            retry_config=skill.retry_config,
        )

        # 3. 解析响应并映射输出
        output = self._apply_response_mapping(skill.response_mapping, response.json())
        return output

    async def _execute_with_retry(self, method, url, headers, body, timeout, retry_config):
        """带指数退避的重试逻辑"""
        last_error = None
        delay = retry_config.retry_delay_seconds

        for attempt in range(retry_config.max_retries + 1):
            try:
                response = await self.http_client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=body,
                    timeout=timeout,
                )
                if response.status_code not in retry_config.retry_on_status_codes:
                    response.raise_for_status()
                    return response
            except (httpx.TimeoutException, httpx.HTTPStatusError) as e:
                last_error = e
                if attempt < retry_config.max_retries:
                    await asyncio.sleep(delay)
                    delay *= retry_config.backoff_multiplier

        raise SkillExecutionError(f"Web API 调用失败，已重试 {retry_config.max_retries} 次: {last_error}")
```

### 2.3 认证支持

| 认证方式 | 配置字段 | Header 生成 |
|---------|---------|------------|
| `bearer` | `{"token": "xxx"}` | `Authorization: Bearer xxx` |
| `api_key` | `{"key_name": "X-API-Key", "key_value": "xxx"}` | `X-API-Key: xxx` |
| `basic` | `{"username": "u", "password": "p"}` | `Authorization: Basic base64(u:p)` |
| `none` | `{}` | 无 |

### 2.4 Request/Response Mapping

使用 JSONPath 表达式进行输入输出字段映射：

```json
{
  "request_mapping": {
    "text": "$.input.content",
    "language": "$.input.metadata.language"
  },
  "response_mapping": {
    "$.output.result": "$.data.translated_text",
    "$.output.confidence": "$.data.score"
  }
}
```

---

## 3. Config Template Skill Engine

### 3.1 设计理念

Config Template Skill 允许用户通过配置模板复用和组合内置处理器，无需编写代码。本质上是对内置处理器的"参数化包装"。

### 3.2 内置处理器类型

```python
BUILT_IN_PROCESSORS = {
    "text_split": TextSplitProcessor,          # 文本分块
    "language_detect": LanguageDetectProcessor, # 语言检测
    "text_clean": TextCleanProcessor,          # 文本清洗
    "regex_extract": RegexExtractProcessor,    # 正则提取
    "json_transform": JsonTransformProcessor,  # JSON 转换
    "text_merge": TextMergeProcessor,          # 文本合并
    "field_mapping": FieldMappingProcessor,    # 字段映射
    "filter": FilterProcessor,                 # 条件过滤
}
```

### 3.3 核心实现

```python
class ConfigTemplateSkillEngine:
    """Config Template Skill 执行引擎"""

    def __init__(self, processor_registry: dict):
        self.processor_registry = processor_registry

    async def execute(self, skill: ConfigTemplateSkill, input_data: dict, config: dict) -> dict:
        """执行 Config Template Skill"""
        # 1. 获取处理器类
        processor_cls = self.processor_registry.get(skill.processor_type)
        if not processor_cls:
            raise SkillExecutionError(f"未知的处理器类型: {skill.processor_type}")

        # 2. 合并配置（模板默认值 + 用户覆盖 + 运行时配置）
        merged_config = {
            **skill.template_config,
            **skill.parameter_overrides,
            **config,
        }

        # 3. 实例化并执行处理器
        processor = processor_cls(**merged_config)
        result = await processor.process(input_data)
        return result
```

### 3.4 配置模板示例

```yaml
# 自定义"中文长文本分块" Skill
name: "chinese_long_text_splitter"
skill_type: "config_template"
processor_type: "text_split"
template_config:
  method: "recursive"
  chunk_size: 1000
  chunk_overlap: 200
  separators: ["\n\n", "\n", "。", "！", "？", "；"]
  language: "chinese"
parameter_overrides:
  chunk_size: null   # 允许用户覆盖
  chunk_overlap: null
```

---

## 4. Python Code Skill Engine

### 4.1 沙箱执行架构

Python Code Skill 使用 subprocess 隔离执行用户代码，确保安全性：

```
主进程 → subprocess.Popen → 沙箱子进程（资源限制）
                                ├── 安装依赖 (pip install)
                                ├── 加载用户代码
                                ├── 调用入口函数
                                └── 返回结果 (JSON stdout)
```

### 4.2 核心实现

```python
class PythonCodeSkillEngine:
    """Python Code Skill 执行引擎 - 沙箱化执行"""

    def __init__(self, workspace_dir: str = "/tmp/skill_sandbox"):
        self.workspace_dir = workspace_dir

    async def execute(self, skill: PythonCodeSkill, input_data: dict, config: dict) -> dict:
        """在沙箱中执行 Python Code Skill"""
        # 1. 创建隔离工作目录
        sandbox_dir = self._create_sandbox(skill.id)

        try:
            # 2. 安装依赖
            if skill.requirements:
                await self._install_dependencies(sandbox_dir, skill.requirements)

            # 3. 写入用户代码
            code_path = self._write_code(sandbox_dir, skill.code_content)

            # 4. 生成执行入口脚本
            runner_path = self._write_runner(
                sandbox_dir, code_path, skill.entry_function, input_data, config
            )

            # 5. 在受限子进程中执行
            result = await self._run_in_sandbox(
                runner_path, skill.sandbox_config
            )
            return result

        finally:
            # 6. 清理沙箱
            self._cleanup_sandbox(sandbox_dir)

    async def _run_in_sandbox(self, runner_path: str, sandbox_config: SandboxConfig) -> dict:
        """在资源受限的子进程中执行代码"""
        import resource

        def set_limits():
            # 内存限制
            mem_bytes = sandbox_config.max_memory_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
            # CPU 时间限制
            resource.setrlimit(
                resource.RLIMIT_CPU,
                (sandbox_config.max_cpu_seconds, sandbox_config.max_cpu_seconds)
            )

        process = await asyncio.create_subprocess_exec(
            sys.executable, runner_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            preexec_fn=set_limits,
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=sandbox_config.max_cpu_seconds + 10
        )

        if process.returncode != 0:
            raise SkillExecutionError(f"Python 代码执行失败: {stderr.decode()}")

        return json.loads(stdout.decode())

    def _write_runner(self, sandbox_dir, code_path, entry_function, input_data, config):
        """生成沙箱执行入口脚本"""
        runner_code = f"""
import sys, json
sys.path.insert(0, "{sandbox_dir}")

from user_code import {entry_function}

input_data = json.loads('''{json.dumps(input_data)}''')
config = json.loads('''{json.dumps(config)}''')

result = {entry_function}(input_data, config)
print(json.dumps(result))
"""
        runner_path = os.path.join(sandbox_dir, "_runner.py")
        with open(runner_path, "w") as f:
            f.write(runner_code)
        return runner_path
```

### 4.3 用户代码规范

用户上传的 Python 代码必须遵循以下规范：

```python
# 用户代码示例：自定义文本摘要 Skill
def execute(input_data: dict, config: dict) -> dict:
    """
    入口函数签名固定：
    - input_data: 输入数据字典，结构由 input_schema 定义
    - config: 运行时配置字典
    - 返回值: 输出数据字典，结构需符合 output_schema
    """
    text = input_data["content"]
    max_length = config.get("max_length", 200)

    # 自定义处理逻辑
    summary = text[:max_length] + "..." if len(text) > max_length else text

    return {
        "summary": summary,
        "original_length": len(text),
    }
```

### 4.4 安全措施

| 安全层 | 措施 | 说明 |
|-------|------|------|
| 进程隔离 | `subprocess` | 独立进程执行，崩溃不影响主进程 |
| 内存限制 | `RLIMIT_AS` | 防止内存耗尽 |
| CPU 限制 | `RLIMIT_CPU` | 防止无限循环 |
| 超时控制 | `asyncio.wait_for` | 硬超时兜底 |
| 网络隔离 | 可选 network_enabled | 默认禁止网络访问 |
| Import 白名单 | `allowed_imports` | 限制可导入的模块 |
| 文件系统 | 临时沙箱目录 | 执行完毕即清理 |

---

## 5. Skill Registry Pattern

### 5.1 统一注册中心

```python
class SkillRegistry:
    """Skill 注册中心 - 管理所有 Skill 类型的注册和发现"""

    def __init__(self):
        self._engines: dict[SkillType, SkillEngine] = {}
        self._built_in_skills: dict[str, BuiltInSkill] = {}

    def register_engine(self, skill_type: SkillType, engine: SkillEngine):
        """注册 Skill 执行引擎"""
        self._engines[skill_type] = engine

    def register_built_in_skill(self, skill: BuiltInSkill):
        """注册内置 Skill"""
        self._built_in_skills[skill.name] = skill

    async def execute_skill(self, skill: SkillBase, input_data: dict, config: dict) -> dict:
        """统一执行入口 - 根据 skill_type 分发到对应引擎"""
        engine = self._engines.get(skill.skill_type)
        if not engine:
            raise SkillExecutionError(f"未注册的 Skill 类型引擎: {skill.skill_type}")
        return await engine.execute(skill, input_data, config)

    def get_skill_by_name(self, name: str) -> SkillBase | None:
        """按名称获取 Skill（优先查找内置）"""
        return self._built_in_skills.get(name)

    def list_built_in_skills(self) -> list[BuiltInSkill]:
        """列出所有内置 Skill"""
        return list(self._built_in_skills.values())
```

### 5.2 引擎初始化

```python
def create_skill_registry() -> SkillRegistry:
    registry = SkillRegistry()

    # 注册三种执行引擎
    registry.register_engine(SkillType.BUILT_IN, BuiltInSkillEngine())
    registry.register_engine(SkillType.WEB_API, WebApiSkillEngine())
    registry.register_engine(SkillType.CONFIG_TEMPLATE, ConfigTemplateSkillEngine(BUILT_IN_PROCESSORS))
    registry.register_engine(SkillType.PYTHON_CODE, PythonCodeSkillEngine())

    # 注册内置 Skill
    for skill in BUILT_IN_SKILL_DEFINITIONS:
        registry.register_built_in_skill(skill)

    return registry
```

---

## 6. Skill Library / Marketplace 数据模型

### 6.1 数据库模型

```sql
-- Skill 主表
CREATE TABLE skills (
    id              VARCHAR(36) PRIMARY KEY,
    name            VARCHAR(128) UNIQUE NOT NULL,
    display_name    VARCHAR(256) NOT NULL,
    description     TEXT,
    skill_type      VARCHAR(32) NOT NULL,  -- built_in | web_api | config_template | python_code
    version         VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    category        VARCHAR(64),
    input_schema    JSON NOT NULL,
    output_schema   JSON NOT NULL,
    config_schema   JSON,
    default_config  JSON,
    is_system       BOOLEAN DEFAULT FALSE,
    author          VARCHAR(128),
    tags            JSON,                  -- ["text", "nlp", "embedding"]
    status          VARCHAR(16) DEFAULT 'active',  -- active | deprecated | disabled
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Web API Skill 扩展表
CREATE TABLE skill_web_api_configs (
    skill_id            VARCHAR(36) PRIMARY KEY REFERENCES skills(id),
    endpoint_url        VARCHAR(1024) NOT NULL,
    http_method         VARCHAR(8) DEFAULT 'POST',
    headers             JSON,
    auth_type           VARCHAR(16),
    auth_config_encrypted TEXT,        -- 加密存储的认证信息
    request_mapping     JSON,
    response_mapping    JSON,
    timeout_seconds     INT DEFAULT 30,
    retry_max           INT DEFAULT 3,
    retry_delay         FLOAT DEFAULT 1.0,
    retry_backoff       FLOAT DEFAULT 2.0,
    retry_status_codes  JSON DEFAULT '[429,500,502,503,504]'
);

-- Config Template Skill 扩展表
CREATE TABLE skill_config_template_configs (
    skill_id            VARCHAR(36) PRIMARY KEY REFERENCES skills(id),
    processor_type      VARCHAR(64) NOT NULL,
    template_config     JSON NOT NULL,
    parameter_overrides JSON
);

-- Python Code Skill 扩展表
CREATE TABLE skill_python_code_configs (
    skill_id            VARCHAR(36) PRIMARY KEY REFERENCES skills(id),
    code_content        TEXT NOT NULL,
    entry_function      VARCHAR(64) DEFAULT 'execute',
    requirements        JSON,          -- ["numpy>=1.21", "pandas"]
    max_memory_mb       INT DEFAULT 512,
    max_cpu_seconds     INT DEFAULT 60,
    max_output_size_mb  INT DEFAULT 10,
    network_enabled     BOOLEAN DEFAULT FALSE,
    allowed_imports     JSON
);

-- Skill Library（Marketplace 发布信息）
CREATE TABLE skill_library (
    id              VARCHAR(36) PRIMARY KEY,
    skill_id        VARCHAR(36) REFERENCES skills(id),
    publisher       VARCHAR(128) NOT NULL,
    publish_version VARCHAR(32) NOT NULL,
    description     TEXT,
    readme          TEXT,              -- Markdown 格式的使用说明
    icon_url        VARCHAR(512),
    download_count  INT DEFAULT 0,
    rating_avg      FLOAT DEFAULT 0.0,
    rating_count    INT DEFAULT 0,
    is_verified     BOOLEAN DEFAULT FALSE,
    published_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skill_id, publish_version)
);

-- Skill 评分表
CREATE TABLE skill_ratings (
    id              VARCHAR(36) PRIMARY KEY,
    library_id      VARCHAR(36) REFERENCES skill_library(id),
    user_id         VARCHAR(36) NOT NULL,
    rating          INT CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(library_id, user_id)
);
```

---

## 7. 内置 Skills 实现计划

### 7.1 内置 Skill 清单

| Skill 名称 | 类别 | 输入 | 输出 | 说明 |
|------------|------|------|------|------|
| `DocumentCracker` | ingestion | 文件 binary | 文本 + metadata | 文档解析（PDF, DOCX, HTML 等） |
| `TextSplitter` | text_processing | 长文本 | 文本块列表 | 文本分块，支持多种策略 |
| `TextEmbedder` | embedding | 文本/文本列表 | 向量列表 | 文本向量化，对接多种 Embedding 模型 |
| `TextCleaner` | text_processing | 原始文本 | 清洗后文本 | HTML 去标签、特殊字符处理等 |
| `LanguageDetector` | text_processing | 文本 | 语言代码 | 语言检测 |
| `EntityExtractor` | nlp | 文本 | 实体列表 | 命名实体识别 |
| `KeywordExtractor` | nlp | 文本 | 关键词列表 | 关键词/短语提取 |
| `TextTranslator` | nlp | 文本 + 目标语言 | 翻译文本 | 文本翻译 |
| `VectorSearcher` | retrieval | 查询向量 | 检索结果列表 | 向量相似度检索 |
| `LLMInvoker` | llm | prompt + context | LLM 响应 | 调用大语言模型 |

### 7.2 内置 Skill 注册

```python
BUILT_IN_SKILL_DEFINITIONS = [
    BuiltInSkill(
        name="document_cracker",
        display_name="Document Cracker",
        description="解析多种格式文档（PDF, DOCX, HTML, Markdown 等），提取文本内容和元数据",
        category="ingestion",
        processor_class="ragflow.processors.DocumentCracker",
        input_schema={
            "type": "object",
            "properties": {
                "file_content": {"type": "string", "format": "binary"},
                "file_name": {"type": "string"},
                "file_type": {"type": "string"},
            },
            "required": ["file_content", "file_name"],
        },
        output_schema={
            "type": "object",
            "properties": {
                "text": {"type": "string"},
                "metadata": {"type": "object"},
                "pages": {"type": "array", "items": {"type": "object"}},
            },
        },
        config_schema={
            "type": "object",
            "properties": {
                "extract_images": {"type": "boolean", "default": False},
                "ocr_enabled": {"type": "boolean", "default": True},
            },
        },
    ),
    # ... 其他内置 Skill 定义类似
]
```

---

## 8. API Endpoints

### 8.1 Skill CRUD

```
# Skill 管理
GET    /api/v1/skills                    # 列出所有 Skill（支持分页、筛选）
POST   /api/v1/skills                    # 创建自定义 Skill
GET    /api/v1/skills/{skill_id}         # 获取 Skill 详情
PUT    /api/v1/skills/{skill_id}         # 更新 Skill
DELETE /api/v1/skills/{skill_id}         # 删除 Skill
POST   /api/v1/skills/{skill_id}/clone   # 克隆 Skill

# Skill 执行（独立测试）
POST   /api/v1/skills/{skill_id}/execute # 执行 Skill（用于测试）
POST   /api/v1/skills/{skill_id}/validate # 校验 Skill 配置

# Skill 版本管理
GET    /api/v1/skills/{skill_id}/versions          # 列出版本历史
POST   /api/v1/skills/{skill_id}/versions          # 发布新版本
GET    /api/v1/skills/{skill_id}/versions/{version} # 获取特定版本
```

### 8.2 Skill Library / Marketplace

```
# Skill 库
GET    /api/v1/skill-library                       # 搜索 Skill 库
GET    /api/v1/skill-library/{library_id}           # 获取 Skill 库条目详情
POST   /api/v1/skill-library/publish                # 发布 Skill 到库
POST   /api/v1/skill-library/{library_id}/install   # 从库安装 Skill
POST   /api/v1/skill-library/{library_id}/rate      # 评分

# 内置 Skill（只读）
GET    /api/v1/skills/built-in                      # 列出所有内置 Skill
GET    /api/v1/skills/built-in/{name}               # 获取内置 Skill 详情
```

### 8.3 请求/响应示例

**创建 Web API Skill：**

```json
POST /api/v1/skills
{
  "name": "deepl_translator",
  "display_name": "DeepL 翻译",
  "description": "使用 DeepL API 进行高质量文本翻译",
  "skill_type": "web_api",
  "category": "nlp",
  "input_schema": {
    "type": "object",
    "properties": {
      "text": {"type": "string"},
      "target_lang": {"type": "string"}
    },
    "required": ["text", "target_lang"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "translated_text": {"type": "string"}
    }
  },
  "web_api_config": {
    "endpoint_url": "https://api-free.deepl.com/v2/translate",
    "http_method": "POST",
    "auth_type": "api_key",
    "auth_config": {
      "key_name": "Authorization",
      "key_value": "DeepL-Auth-Key YOUR_KEY"
    },
    "request_mapping": {
      "text": "$.input.text",
      "target_lang": "$.input.target_lang"
    },
    "response_mapping": {
      "$.output.translated_text": "$.translations[0].text"
    },
    "timeout_seconds": 15
  },
  "tags": ["translation", "deepl", "nlp"]
}
```

**执行 Skill（测试模式）：**

```json
POST /api/v1/skills/{skill_id}/execute
{
  "input_data": {
    "text": "Hello, world!",
    "target_lang": "ZH"
  },
  "config": {}
}

// Response
{
  "status": "success",
  "output": {
    "translated_text": "你好，世界！"
  },
  "execution_time_ms": 342,
  "metadata": {
    "engine": "web_api",
    "http_status": 200
  }
}
```
