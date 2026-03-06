# Python Code Skill 执行框架与 Connection 管理 — 技术设计

## 1. Connection 管理模块

### 1.1 数据模型

```python
class Connection(BaseModel):
    __tablename__ = "connections"

    name: Mapped[str] = mapped_column(String(255), index=True, unique=True)
    connection_type: Mapped[str] = mapped_column(String(50))
        # azure_openai | openai | azure_doc_intelligence |
        # azure_content_understanding | azure_ai_foundry | http_api
    description: Mapped[str | None] = mapped_column(Text, default=None)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
        # 加密存储，包含 endpoint, api_key, api_version 等
```

### 1.2 Connection 类型与配置结构

```
┌────────────────────────┬──────────────────────────────────────────┐
│ connection_type         │ config 字段                               │
├────────────────────────┼──────────────────────────────────────────┤
│ azure_openai           │ endpoint, api_key, api_version,          │
│                        │ deployment_name                           │
├────────────────────────┼──────────────────────────────────────────┤
│ openai                 │ api_key, organization (可选)              │
├────────────────────────┼──────────────────────────────────────────┤
│ azure_doc_intelligence │ endpoint, api_key                        │
├────────────────────────┼──────────────────────────────────────────┤
│ azure_content_understanding │ endpoint, api_key                   │
├────────────────────────┼──────────────────────────────────────────┤
│ azure_ai_foundry       │ endpoint, api_key, project_name          │
├────────────────────────┼──────────────────────────────────────────┤
│ http_api               │ base_url, headers (dict),                │
│                        │ auth_type (none|bearer|api_key),         │
│                        │ auth_value                                │
└────────────────────────┴──────────────────────────────────────────┘
```

### 1.3 Secret 加密

- 使用 Fernet 对称加密（`cryptography` 库）
- 加密密钥通过环境变量 `SECRET_ENCRYPTION_KEY` 配置
- API 响应中 secret 字段（api_key, auth_value 等）返回掩码值（如 `sk-****abcd`）
- 仅在后端 SkillContext 构建客户端时解密

```python
# 加密存储
def encrypt_config(config: dict, secret_fields: list[str]) -> dict:
    """加密 config 中的敏感字段"""
    encrypted = config.copy()
    for field in secret_fields:
        if field in encrypted and encrypted[field]:
            encrypted[field] = fernet.encrypt(encrypted[field].encode()).decode()
    return encrypted

# 响应掩码
def mask_config(config: dict, secret_fields: list[str]) -> dict:
    """将 secret 字段替换为掩码"""
    masked = config.copy()
    for field in secret_fields:
        if field in masked and masked[field]:
            value = masked[field]
            masked[field] = f"{value[:4]}****{value[-4:]}" if len(value) > 8 else "****"
    return masked
```

### 1.4 Connection API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/connections` | 创建连接 |
| GET | `/api/v1/connections` | 列出连接（分页） |
| GET | `/api/v1/connections/{id}` | 获取连接详情（secret 掩码） |
| PUT | `/api/v1/connections/{id}` | 更新连接 |
| DELETE | `/api/v1/connections/{id}` | 删除连接 |
| POST | `/api/v1/connections/{id}/test` | 测试连接 |

### 1.5 连接测试

每种连接类型有对应的测试逻辑：

```python
async def test_connection(connection: Connection) -> TestResult:
    match connection.connection_type:
        case "azure_openai":
            # 调用 models.list() 验证 endpoint + key
            client = AzureOpenAI(...)
            client.models.list()
        case "openai":
            client = OpenAI(...)
            client.models.list()
        case "azure_doc_intelligence":
            # 调用 info endpoint 验证
            client = DocumentIntelligenceClient(...)
            client.get_resource_info()
        case "http_api":
            # 发送 HEAD/GET 请求到 base_url
            httpx.get(config["base_url"], headers=...)
    return TestResult(success=True)
```

## 2. Skill 模型扩展

### 2.1 新增字段

```python
class Skill(BaseModel):
    __tablename__ = "skills"

    # 现有字段
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    skill_type: Mapped[str] = mapped_column(String(50))
    config_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)

    # 新增字段 (python_code 类型专用)
    source_code: Mapped[str | None] = mapped_column(Text, default=None)
    additional_requirements: Mapped[str | None] = mapped_column(Text, default=None)
        # 每行一个 pip 包，如 "beautifulsoup4==4.12.0\nlxml"
    test_input: Mapped[dict | None] = mapped_column(JSON, default=None)
        # 用户保存的测试 JSON 数据
    connection_mappings: Mapped[dict | None] = mapped_column(JSON, default=None)
        # { "llm": "<connection_id>", "doc_intel": "<connection_id>" }
```

### 2.2 Schema 更新

```python
class SkillCreate(BaseModel):
    name: str
    skill_type: str  # builtin | web_api | config_template | python_code
    description: str | None = None
    config_schema: dict = Field(default_factory=dict)
    # python_code 类型新增
    source_code: str | None = None
    additional_requirements: str | None = None
    test_input: dict | None = None
    connection_mappings: dict | None = None

class SkillResponse(BaseModel):
    # ... 现有字段 ...
    source_code: str | None
    additional_requirements: str | None
    test_input: dict | None
    connection_mappings: dict | None
```

## 3. SkillContext 运行时上下文

### 3.1 架构

```
┌─────────────────────────────────────────────────────────────┐
│                       SkillContext                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐                                              │
│  │ config      │ → Skill 的 config_schema 中的参数值           │
│  └─────────────┘                                              │
│                                                               │
│  ┌─────────────┐     ┌──────────────────────────────┐        │
│  │ get_client  │────▶│  ClientFactory                │        │
│  │ (name)      │     │                              │        │
│  └─────────────┘     │  "llm" → AzureOpenAI(...)    │        │
│                       │  "doc" → DocIntelClient(...) │        │
│                       └──────────────────────────────┘        │
│                                                               │
│  ┌─────────────┐                                              │
│  │ logger      │ → ContextLogger (收集日志，执行结束后返回)     │
│  └─────────────┘                                              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 实现

```python
class SkillContext:
    """用户代码可访问的运行时上下文"""

    def __init__(self, config: dict, connections: dict[str, Connection]):
        self.config = config
        self._connections = connections
        self._clients: dict[str, Any] = {}
        self.logger = ContextLogger()

    def get_client(self, name: str):
        """获取已认证的 SDK 客户端实例"""
        if name not in self._clients:
            if name not in self._connections:
                raise ValueError(
                    f"Connection '{name}' not found. "
                    f"Available: {list(self._connections.keys())}"
                )
            conn = self._connections[name]
            self._clients[name] = ClientFactory.create(conn)
        return self._clients[name]


class ClientFactory:
    """根据 Connection 类型创建对应的 SDK 客户端"""

    @staticmethod
    def create(connection: Connection):
        config = decrypt_config(connection.config)
        match connection.connection_type:
            case "azure_openai":
                from openai import AzureOpenAI
                return AzureOpenAI(
                    azure_endpoint=config["endpoint"],
                    api_key=config["api_key"],
                    api_version=config.get("api_version", "2024-02-01"),
                )
            case "openai":
                from openai import OpenAI
                return OpenAI(api_key=config["api_key"])
            case "azure_doc_intelligence":
                from azure.ai.documentintelligence import DocumentIntelligenceClient
                from azure.core.credentials import AzureKeyCredential
                return DocumentIntelligenceClient(
                    endpoint=config["endpoint"],
                    credential=AzureKeyCredential(config["api_key"]),
                )
            # ... 其他类型
```

### 3.3 ContextLogger

```python
class ContextLogger:
    """收集用户代码中的日志，执行结束后返回给框架"""

    def __init__(self):
        self.entries: list[dict] = []

    def info(self, message: str, **kwargs):
        self._log("INFO", message, kwargs)

    def warning(self, message: str, **kwargs):
        self._log("WARNING", message, kwargs)

    def error(self, message: str, **kwargs):
        self._log("ERROR", message, kwargs)

    def _log(self, level: str, message: str, details: dict):
        self.entries.append({
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "message": message,
            "details": details or None,
        })
```

## 4. 执行引擎 (SkillRunner)

### 4.1 执行流程

```
    POST /api/v1/skills/{id}/test
    { "test_input": { "values": [...] } }
                    │
                    ▼
    ┌───────────────────────────────┐
    │  1. 加载 Skill + Connections   │
    │  2. 构建 SkillContext          │
    │  3. 组装完整代码模块            │
    │     ┌───────────────────┐     │
    │     │ # preloaded imports│     │
    │     │ import re, json...│     │
    │     │                   │     │
    │     │ # user code       │     │
    │     │ def process(...): │     │
    │     │   ...             │     │
    │     └───────────────────┘     │
    │  4. 循环执行每条 record        │
    │     for record in values:     │
    │       result = process(       │
    │         record["data"],       │
    │         context                │
    │       )                        │
    │  5. 包装结果 + 日志返回         │
    └───────────────────────────────┘
                    │
                    ▼
    {
      "values": [
        { "recordId": "1", "data": {...}, "errors": [], "warnings": [] }
      ],
      "logs": [...]
    }
```

### 4.2 SkillRunner 实现

```python
class SkillRunner:
    """执行 python_code 类型的 Skill"""

    PRELOADED_IMPORTS = '''
import re
import json
import math
import csv
import io
import base64
import hashlib
import urllib.parse
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List, Tuple
from collections import Counter, defaultdict, OrderedDict
from pydantic import BaseModel as PydanticBaseModel
'''

    async def execute(
        self,
        skill: Skill,
        test_input: dict,
        context: SkillContext,
    ) -> dict:
        """执行 Skill 并返回标准格式结果"""
        values = test_input.get("values", [])
        results = []

        # 编译用户代码
        full_code = self.PRELOADED_IMPORTS + "\n" + skill.source_code
        module = self._compile_module(full_code)
        process_fn = module.process

        for index, record in enumerate(values):
            record_id = record.get("recordId", f"record_{index}")
            data = record.get("data", {})
            try:
                output = process_fn(data, context)
                results.append({
                    "recordId": record_id,
                    "data": output if isinstance(output, dict) else {"result": output},
                    "errors": [],
                    "warnings": [],
                })
            except Exception as e:
                results.append({
                    "recordId": record_id,
                    "data": {},
                    "errors": [{"message": str(e), "traceback": traceback.format_exc()}],
                    "warnings": [],
                })

        return {
            "values": results,
            "logs": context.logger.entries,
        }

    def _compile_module(self, code: str):
        """编译用户代码为可调用模块"""
        module = types.ModuleType("user_skill")
        exec(compile(code, "<skill>", "exec"), module.__dict__)
        if not hasattr(module, "process"):
            raise ValueError("Skill code must define a 'process(data, context)' function")
        return module
```

### 4.3 隔离执行（Phase 2 增强）

Phase 1 直接在主进程中通过 `exec` + `types.ModuleType` 执行（内部员工，信任度高）。

Phase 2 可升级为 subprocess 隔离：

```
┌─────────────────────────────────────────────────────────┐
│  Phase 1: In-Process (当前)                               │
│  exec(code, module.__dict__)                              │
│  优点: 简单、快速、context 对象直接传递                      │
│  缺点: 用户代码崩溃影响主进程                               │
├─────────────────────────────────────────────────────────┤
│  Phase 2: Subprocess (未来)                                │
│  subprocess.run([venv_python, runner_script.py], ...)     │
│  优点: 进程隔离、超时 kill、资源限制                         │
│  缺点: context 需序列化传递，SDK 客户端无法直接传递           │
│       → 需要设计 IPC 方案 (stdin/stdout JSON 协议)          │
└─────────────────────────────────────────────────────────┘
```

### 4.4 超时控制

```python
import signal
import asyncio

async def execute_with_timeout(runner, skill, test_input, context, timeout=60):
    try:
        return await asyncio.wait_for(
            runner.execute(skill, test_input, context),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        return {
            "values": [],
            "errors": [{"message": f"Execution timed out after {timeout}s"}],
            "logs": context.logger.entries,
        }
```

## 5. 虚拟环境管理 (VenvManager)

### 5.1 目录结构

```
{SKILL_VENVS_ROOT}/
├── _base/                    # 基础环境，包含所有预置包
│   └── lib/python3.11/
│       └── site-packages/
│           ├── openai/
│           ├── azure/
│           ├── requests/
│           └── ...
│
├── skill_{id_1}/             # 有 additional requirements
│   └── ... (继承 _base + 额外包)
│
└── skill_{id_2}/             # 无 additional requirements
    → 直接使用 _base
```

### 5.2 基础环境初始化

应用首次启动时创建基础环境：

```python
class VenvManager:
    PRELOADED_PACKAGES = [
        "requests",
        "httpx",
        "pydantic",
        "azure-identity",
        "openai",
        "azure-ai-documentintelligence",
        "azure-ai-contentsafety",
        "azure-ai-projects",
        "azure-ai-inference",
    ]

    async def ensure_base_env(self):
        """确保基础虚拟环境存在且包含预置包"""
        base_path = self.root / "_base"
        if not base_path.exists():
            subprocess.run([sys.executable, "-m", "venv", str(base_path)])
            pip = str(base_path / "bin" / "pip")
            subprocess.run([pip, "install"] + self.PRELOADED_PACKAGES)

    async def ensure_skill_env(self, skill: Skill) -> Path:
        """为有 additional requirements 的 Skill 创建独立环境"""
        if not skill.additional_requirements:
            return self.root / "_base"

        env_path = self.root / f"skill_{skill.id}"
        reqs = skill.additional_requirements.strip().split("\n")
        # 基于 _base 创建 (使用 --system-site-packages 继承)
        if not env_path.exists():
            subprocess.run([
                sys.executable, "-m", "venv",
                "--system-site-packages", str(env_path)
            ])
        pip = str(env_path / "bin" / "pip")
        subprocess.run([pip, "install"] + reqs)
        return env_path
```

### 5.3 环境生命周期

```
创建 Skill (有 additional_requirements)
    → ensure_skill_env() → 创建 venv + pip install

更新 Skill (requirements 变化)
    → 删除旧 venv → 重新 ensure_skill_env()

删除 Skill
    → 删除对应 venv 目录

更新预置包列表 (运维操作)
    → 重建 _base → 所有 skill_{id} 自动继承
```

## 6. Skill Editor UI

### 6.1 页面结构

```
┌─────────────────────────────────────────────────────────────────┐
│  Python Skill Editor: {skill_name}                    [Save]    │
├────────────────────────────────────────┬────────────────────────┤
│                                        │ Connection Mappings     │
│  ┌─ Preloaded Imports (只读/灰底) ──┐ │ ┌────────────────────┐ │
│  │ import re                        │ │ │ llm: [Azure OpenAI▼]│ │
│  │ import json                      │ │ │ doc: [Doc Intel  ▼] │ │
│  │ from openai import AzureOpenAI   │ │ │ [+ Add Connection]  │ │
│  │ ...                              │ │ └────────────────────┘ │
│  └──────────────────────────────────┘ │                          │
│                                        │ Additional Requirements │
│  ┌─ Your Code (可编辑/Monaco) ──────┐ │ ┌────────────────────┐ │
│  │ def process(data, context):      │ │ │ beautifulsoup4      │ │
│  │     client = context.get_client( │ │ │ lxml                │ │
│  │         "llm"                    │ │ │                     │ │
│  │     )                            │ │ └────────────────────┘ │
│  │     resp = client.chat...        │ │                          │
│  │     return {"result": ...}       │ │                          │
│  │                                  │ ├────────────────────────┤
│  │                                  │ │ Test Input (JSON)       │
│  │                                  │ │ ┌────────────────────┐ │
│  │                                  │ │ │ {                  │ │
│  │                                  │ │ │   "values": [{     │ │
│  │                                  │ │ │     "recordId":"1",│ │
│  │                                  │ │ │     "data": {      │ │
│  │                                  │ │ │       "text":"..." │ │
│  │                                  │ │ │     }              │ │
│  │                                  │ │ │   }]               │ │
│  │                                  │ │ │ }                  │ │
│  │                                  │ │ └────────────────────┘ │
│  │                                  │ │    [Import from Pipeline│
│  │                                  │ │     Test Run ▼]        │
│  └──────────────────────────────────┘ │       [▶ Run Test]      │
│                                        ├────────────────────────┤
│                                        │ Output                  │
│                                        │ ┌────────────────────┐ │
│                                        │ │ Status: Success ✓  │ │
│                                        │ │                    │ │
│                                        │ │ { "values": [...] }│ │
│                                        │ │                    │ │
│                                        │ │ Logs:              │ │
│                                        │ │ [INFO] Processed   │ │
│                                        │ │ record 1           │ │
│                                        │ └────────────────────┘ │
│                                        │                          │
└────────────────────────────────────────┴────────────────────────┘
```

### 6.2 前端组件拆解

```
SkillEditorPage
├── SkillEditorHeader          # 名称、描述、保存按钮
├── CodeEditorPanel            # 左侧
│   ├── PreloadedImportsBlock  # 只读 imports 展示 (灰底/折叠)
│   └── MonacoEditor           # 用户代码编辑
├── SidePanel                  # 右侧
│   ├── ConnectionMappings     # 选择连接
│   │   └── ConnectionSelect   # 下拉选择已有 Connection
│   ├── RequirementsEditor     # additional requirements 文本框
│   ├── TestInputEditor        # JSON 编辑器 + Import 按钮
│   ├── RunTestButton          # 调用 POST /skills/{id}/test
│   └── TestOutputViewer       # 结果展示 (JSON + Logs + Errors)
```

### 6.3 测试 API

```
POST /api/v1/skills/{id}/test
Content-Type: application/json

{
    "test_input": {
        "values": [
            { "recordId": "1", "data": { "text": "Hello world" } }
        ]
    }
}

Response 200:
{
    "values": [
        {
            "recordId": "1",
            "data": { "summary": "A greeting" },
            "errors": [],
            "warnings": []
        }
    ],
    "logs": [
        { "timestamp": "...", "level": "INFO", "message": "..." }
    ],
    "execution_time_ms": 1523
}
```

也支持未保存代码的临时测试：

```
POST /api/v1/skills/test-code
Content-Type: application/json

{
    "source_code": "def process(data, context):\n    return {'echo': data}",
    "connection_mappings": { "llm": "<connection_id>" },
    "test_input": { "values": [...] }
}
```

## 7. 预置 Imports 展示

预置 imports 列表维护在后端配置中，前端通过 API 获取：

```
GET /api/v1/skills/preloaded-imports

Response 200:
{
    "standard_library": [
        "import re",
        "import json",
        "import math",
        "import csv",
        "import io",
        "import base64",
        "import hashlib",
        "import urllib.parse",
        "import logging",
        "from datetime import datetime, timedelta, timezone",
        "from typing import Dict, Any, Optional, List, Tuple",
        "from collections import Counter, defaultdict, OrderedDict"
    ],
    "third_party": [
        "import requests",
        "import httpx",
        "from pydantic import BaseModel",
        "from openai import OpenAI, AzureOpenAI",
        "from azure.identity import DefaultAzureCredential",
        "from azure.ai.documentintelligence import DocumentIntelligenceClient",
        "from azure.ai.contentsafety import ContentSafetyClient",
        "from azure.ai.projects import AIProjectClient",
        "from azure.ai.inference import ChatCompletionsClient"
    ]
}
```
