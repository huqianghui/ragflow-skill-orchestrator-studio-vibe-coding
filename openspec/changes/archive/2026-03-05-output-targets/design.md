# 技术设计：输出目标管理与数据写入

## 1. 整体架构

### 1.1 Target 抽象层（Strategy Pattern）

采用策略模式设计 Target Writer 抽象层，使不同目标存储的写入逻辑可插拔替换：

```
                    ┌─────────────────┐
                    │  TargetService  │
                    │  (CRUD + 调度)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  WriterFactory   │
                    │  (工厂 + 注册)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──┐  ┌───────▼────┐  ┌──────▼──────┐
    │ AzureSearch │  │  MySQL     │  │ PostgreSQL  │
    │ Writer      │  │  Writer    │  │ Writer      │
    │ (Phase 1)   │  │ (Phase 2)  │  │ (Phase 2)   │
    └─────────────┘  └────────────┘  └─────────────┘
```

### 1.2 核心接口定义

```python
from abc import ABC, abstractmethod
from typing import Any
from dataclasses import dataclass


@dataclass
class WriteResult:
    """写入结果"""
    total: int              # 总文档数
    succeeded: int          # 成功数
    failed: int             # 失败数
    errors: list[dict]      # 失败详情 [{"key": "doc_id", "error": "..."}]


class BaseTargetWriter(ABC):
    """目标写入器基类"""

    @abstractmethod
    async def test_connection(self, config: dict) -> bool:
        """测试连接可达性和权限"""
        ...

    @abstractmethod
    async def get_schema(self, config: dict) -> dict:
        """获取目标存储的 Schema 信息（字段名、类型等）"""
        ...

    @abstractmethod
    async def write_batch(
        self,
        config: dict,
        documents: list[dict],
        field_mapping: dict[str, str],
    ) -> WriteResult:
        """批量写入文档"""
        ...

    @abstractmethod
    async def validate_field_mapping(
        self,
        config: dict,
        field_mapping: dict[str, str],
    ) -> list[str]:
        """验证字段映射合法性，返回错误列表（空列表表示通过）"""
        ...
```

### 1.3 Writer 工厂注册

```python
class WriterFactory:
    """Writer 工厂，支持动态注册新 Writer 类型"""

    _registry: dict[str, type[BaseTargetWriter]] = {}

    @classmethod
    def register(cls, target_type: str, writer_class: type[BaseTargetWriter]):
        cls._registry[target_type] = writer_class

    @classmethod
    def create(cls, target_type: str) -> BaseTargetWriter:
        writer_class = cls._registry.get(target_type)
        if not writer_class:
            raise ValueError(f"不支持的目标类型: {target_type}")
        return writer_class()


# 注册 Phase 1 Writer
WriterFactory.register("azure_ai_search", AzureSearchWriter)

# Phase 2 扩展时只需注册新 Writer
# WriterFactory.register("mysql", MySQLWriter)
# WriterFactory.register("postgresql", PostgreSQLWriter)
# WriterFactory.register("cosmosdb", CosmosDBWriter)
# WriterFactory.register("neo4j", Neo4jWriter)
```

---

## 2. Azure AI Search 集成

### 2.1 SDK 依赖

使用 Azure 官方 Python SDK：

```toml
# pyproject.toml
[project]
dependencies = [
    "azure-search-documents>=11.4.0",
    "azure-core>=1.30.0",
]
```

### 2.2 连接配置结构

```python
class AzureSearchConnectionConfig(BaseModel):
    """Azure AI Search 连接配置"""
    endpoint: str           # 如 "https://my-search.search.windows.net"
    api_key: str            # Admin Key（加密存储）
    index_name: str         # Index 名称
    api_version: str = "2024-07-01"  # API 版本
```

### 2.3 AzureSearchWriter 实现

```python
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import SearchIndex
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import HttpResponseError


class AzureSearchWriter(BaseTargetWriter):
    """Azure AI Search 写入器"""

    def _get_index_client(self, config: dict) -> SearchIndexClient:
        return SearchIndexClient(
            endpoint=config["endpoint"],
            credential=AzureKeyCredential(config["api_key"]),
        )

    def _get_search_client(self, config: dict) -> SearchClient:
        return SearchClient(
            endpoint=config["endpoint"],
            index_name=config["index_name"],
            credential=AzureKeyCredential(config["api_key"]),
        )

    async def test_connection(self, config: dict) -> bool:
        """测试连接：尝试获取 Index 信息"""
        try:
            client = self._get_index_client(config)
            client.get_index(config["index_name"])
            return True
        except HttpResponseError:
            return False

    async def get_schema(self, config: dict) -> dict:
        """读取 Index Schema，返回字段定义"""
        client = self._get_index_client(config)
        index: SearchIndex = client.get_index(config["index_name"])
        return {
            "index_name": index.name,
            "fields": [
                {
                    "name": field.name,
                    "type": str(field.type),
                    "searchable": field.searchable,
                    "filterable": field.filterable,
                    "sortable": field.sortable,
                    "facetable": field.facetable,
                    "key": field.key,
                    "retrievable": field.retrievable,
                }
                for field in index.fields
            ],
        }

    async def write_batch(
        self,
        config: dict,
        documents: list[dict],
        field_mapping: dict[str, str],
    ) -> WriteResult:
        """批量写入文档到 Azure AI Search Index"""
        client = self._get_search_client(config)

        # 应用字段映射：将 Pipeline 输出字段名转换为 Index 字段名
        mapped_docs = []
        for doc in documents:
            mapped = {}
            for src_field, tgt_field in field_mapping.items():
                if src_field in doc:
                    mapped[tgt_field] = doc[src_field]
            mapped_docs.append(mapped)

        # 分批上传（每批最大 1000 条）
        batch_size = 1000
        total_succeeded = 0
        total_failed = 0
        all_errors = []

        for i in range(0, len(mapped_docs), batch_size):
            batch = mapped_docs[i : i + batch_size]
            result = await self._upload_with_retry(client, batch)
            total_succeeded += result.succeeded
            total_failed += result.failed
            all_errors.extend(result.errors)

        return WriteResult(
            total=len(documents),
            succeeded=total_succeeded,
            failed=total_failed,
            errors=all_errors,
        )

    async def _upload_with_retry(
        self,
        client: SearchClient,
        batch: list[dict],
        max_retries: int = 3,
    ) -> WriteResult:
        """带 exponential backoff 重试的批量上传"""
        import asyncio

        for attempt in range(max_retries + 1):
            try:
                results = client.merge_or_upload_documents(documents=batch)
                succeeded = sum(1 for r in results if r.succeeded)
                failed = len(results) - succeeded
                errors = [
                    {"key": r.key, "error": r.error_message}
                    for r in results
                    if not r.succeeded
                ]
                return WriteResult(
                    total=len(batch),
                    succeeded=succeeded,
                    failed=failed,
                    errors=errors,
                )
            except HttpResponseError as e:
                if e.status_code in (429, 503) and attempt < max_retries:
                    # Exponential backoff: 1s, 2s, 4s
                    wait_time = 2 ** attempt
                    await asyncio.sleep(wait_time)
                    continue
                raise

        # 不应到达此处，但作为安全保障
        raise RuntimeError("重试次数耗尽")
```

### 2.4 Index 管理

支持通过 API 创建新的 Azure AI Search Index：

```python
from azure.search.documents.indexes.models import (
    SearchIndex,
    SearchField,
    SearchFieldDataType,
    SimpleField,
    SearchableField,
    VectorSearch,
    HnswAlgorithmConfiguration,
    VectorSearchProfile,
)


class AzureSearchIndexManager:
    """Azure AI Search Index 管理"""

    FIELD_TYPE_MAP = {
        "string": SearchFieldDataType.String,
        "int32": SearchFieldDataType.Int32,
        "int64": SearchFieldDataType.Int64,
        "double": SearchFieldDataType.Double,
        "boolean": SearchFieldDataType.Boolean,
        "datetime": SearchFieldDataType.DateTimeOffset,
        "collection": SearchFieldDataType.Collection(SearchFieldDataType.String),
    }

    @staticmethod
    async def create_index(
        config: dict,
        index_definition: dict,
    ) -> dict:
        """根据定义创建 Index"""
        client = SearchIndexClient(
            endpoint=config["endpoint"],
            credential=AzureKeyCredential(config["api_key"]),
        )

        fields = []
        for field_def in index_definition["fields"]:
            if field_def.get("searchable", False):
                fields.append(SearchableField(
                    name=field_def["name"],
                    type=field_def.get("type", "string"),
                    filterable=field_def.get("filterable", False),
                    sortable=field_def.get("sortable", False),
                    facetable=field_def.get("facetable", False),
                ))
            else:
                fields.append(SimpleField(
                    name=field_def["name"],
                    type=field_def.get("type", "string"),
                    key=field_def.get("key", False),
                    filterable=field_def.get("filterable", False),
                    sortable=field_def.get("sortable", False),
                ))

        index = SearchIndex(
            name=index_definition["index_name"],
            fields=fields,
        )
        result = client.create_or_update_index(index)
        return {"index_name": result.name, "fields_count": len(result.fields)}

    @staticmethod
    async def list_indexes(config: dict) -> list[str]:
        """列出所有可用的 Index 名称"""
        client = SearchIndexClient(
            endpoint=config["endpoint"],
            credential=AzureKeyCredential(config["api_key"]),
        )
        return [index.name for index in client.list_indexes()]
```

---

## 3. 字段映射引擎

### 3.1 映射数据结构

```python
class FieldMapping(BaseModel):
    """字段映射配置"""
    source_field: str       # Pipeline 输出字段名
    target_field: str       # 目标 Index 字段名
    transform: str | None = None  # 可选的转换函数（Phase 2）


class FieldMappingConfig(BaseModel):
    """完整字段映射配置"""
    mappings: list[FieldMapping]
    key_field: str          # 目标 Index 的 key 字段
    key_source: str         # Pipeline 输出中对应 key 的字段
```

### 3.2 自动建议算法

基于字段名称相似度自动推荐映射关系：

```python
from difflib import SequenceMatcher


class FieldMappingEngine:
    """字段映射引擎"""

    SIMILARITY_THRESHOLD = 0.6  # 相似度阈值

    @staticmethod
    def suggest_mappings(
        source_fields: list[str],
        target_fields: list[dict],
    ) -> list[dict]:
        """
        基于名称相似度自动建议字段映射。

        Args:
            source_fields: Pipeline 输出的字段名列表
            target_fields: 目标 Index 的字段定义列表

        Returns:
            建议的映射列表，包含相似度分数
        """
        target_names = [f["name"] for f in target_fields]
        suggestions = []

        for src in source_fields:
            best_match = None
            best_score = 0.0

            for tgt in target_names:
                # 计算相似度（综合多种策略）
                score = FieldMappingEngine._calculate_similarity(src, tgt)
                if score > best_score:
                    best_score = score
                    best_match = tgt

            if best_match and best_score >= FieldMappingEngine.SIMILARITY_THRESHOLD:
                suggestions.append({
                    "source_field": src,
                    "target_field": best_match,
                    "confidence": round(best_score, 3),
                    "auto_matched": True,
                })
            else:
                suggestions.append({
                    "source_field": src,
                    "target_field": None,
                    "confidence": 0.0,
                    "auto_matched": False,
                })

        return suggestions

    @staticmethod
    def _calculate_similarity(source: str, target: str) -> float:
        """
        综合多种策略计算字段名相似度：
        1. 精确匹配（归一化后）
        2. SequenceMatcher 相似度
        3. 包含关系检测
        """
        # 归一化：转小写，替换分隔符
        s = source.lower().replace("-", "_").replace(" ", "_")
        t = target.lower().replace("-", "_").replace(" ", "_")

        # 精确匹配
        if s == t:
            return 1.0

        # SequenceMatcher（Levenshtein 近似）
        seq_score = SequenceMatcher(None, s, t).ratio()

        # 包含关系（如 "content" 在 "document_content" 中）
        containment_score = 0.0
        if s in t or t in s:
            shorter = min(len(s), len(t))
            longer = max(len(s), len(t))
            containment_score = shorter / longer * 0.9

        return max(seq_score, containment_score)
```

---

## 4. 连接配置加密

### 4.1 加密方案

使用 `cryptography` 库的 Fernet 对称加密，保护存储在数据库中的敏感连接信息：

```python
from cryptography.fernet import Fernet
from app.config import settings


class ConfigEncryption:
    """连接配置加密工具"""

    def __init__(self):
        # 加密密钥从环境变量加载，首次运行时自动生成
        self._fernet = Fernet(settings.encryption_key.encode())

    def encrypt(self, plaintext: str) -> str:
        """加密字符串，返回 Base64 编码的密文"""
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """解密 Base64 编码的密文"""
        return self._fernet.decrypt(ciphertext.encode()).decode()


# 配置新增项
class Settings(BaseSettings):
    # ... 已有配置 ...
    encryption_key: str = ""  # Fernet key，首次运行自动生成

    @model_validator(mode="after")
    def ensure_encryption_key(self):
        if not self.encryption_key:
            self.encryption_key = Fernet.generate_key().decode()
        return self
```

### 4.2 敏感字段处理规则

| 字段 | 存储方式 | API 响应 |
|------|----------|----------|
| `endpoint` | 明文 | 原样返回 |
| `api_key` | AES 加密 | 返回掩码 `***...xxx`（仅显示后 4 位） |
| `index_name` | 明文 | 原样返回 |
| `password`（Phase 2） | AES 加密 | 返回掩码 `******` |
| `connection_string`（Phase 2） | AES 加密 | 返回掩码 |

---

## 5. 数据模型扩展

### 5.1 Target 模型更新

```python
class Target(BaseModel):
    __tablename__ = "targets"

    name: Mapped[str] = mapped_column(index=True)
    description: Mapped[str | None]
    target_type: Mapped[str]                   # "azure_ai_search", "mysql", ...
    connection_config: Mapped[dict]            # 加密后的连接配置（JSON）
    field_mappings: Mapped[dict | None]        # 字段映射配置（JSON）
    pipeline_id: Mapped[str | None] = mapped_column(
        ForeignKey("pipelines.id"), nullable=True
    )
    is_connected: Mapped[bool] = mapped_column(default=False)  # 最近一次连接测试是否成功
    last_write_at: Mapped[datetime | None]     # 最近一次写入时间
    last_write_status: Mapped[str | None]      # 最近一次写入状态
```

### 5.2 Pydantic Schema

```python
class TargetCreate(BaseModel):
    name: str
    description: str | None = None
    target_type: str  # "azure_ai_search"
    connection_config: dict
    pipeline_id: str | None = None


class TargetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    connection_config: dict | None = None
    field_mappings: dict | None = None
    pipeline_id: str | None = None


class TargetResponse(BaseModel):
    id: str
    name: str
    description: str | None
    target_type: str
    connection_config: dict       # 敏感字段已掩码处理
    field_mappings: dict | None
    pipeline_id: str | None
    is_connected: bool
    last_write_at: str | None
    last_write_status: str | None
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    latency_ms: float | None = None


class SchemaResponse(BaseModel):
    index_name: str
    fields: list[dict]


class FieldMappingSuggestion(BaseModel):
    source_field: str
    target_field: str | None
    confidence: float
    auto_matched: bool
```

---

## 6. API 端点设计

### 6.1 Target CRUD

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/v1/targets` | GET | 获取 Target 列表（分页，可按 target_type 过滤） |
| `/api/v1/targets` | POST | 创建 Target（连接配置自动加密存储） |
| `/api/v1/targets/{id}` | GET | 获取 Target 详情（敏感字段掩码） |
| `/api/v1/targets/{id}` | PUT | 更新 Target |
| `/api/v1/targets/{id}` | DELETE | 删除 Target |

### 6.2 连接与 Schema 操作

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/v1/targets/{id}/test-connection` | POST | 测试 Target 连接是否可达 |
| `/api/v1/targets/{id}/schema` | GET | 读取目标存储的 Schema（字段定义） |
| `/api/v1/targets/{id}/indexes` | GET | 列出可用的 Index 列表（Azure AI Search） |

### 6.3 字段映射

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/v1/targets/{id}/field-mappings` | GET | 获取当前字段映射配置 |
| `/api/v1/targets/{id}/field-mappings` | PUT | 更新字段映射配置 |
| `/api/v1/targets/{id}/field-mappings/suggest` | POST | 自动建议字段映射（传入 Pipeline 输出字段列表） |

### 6.4 数据写入

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/v1/targets/{id}/write` | POST | 触发批量写入（通常由 Pipeline 执行引擎调用） |
| `/api/v1/targets/{id}/write-status` | GET | 查询最近一次写入的状态和结果 |

---

## 7. 写入流程时序

```
Pipeline 执行完成
        │
        ▼
TargetService.trigger_write(target_id, documents)
        │
        ├── 1. 从数据库加载 Target 配置
        ├── 2. 解密连接配置
        ├── 3. 通过 WriterFactory 获取对应 Writer
        ├── 4. 加载字段映射配置
        ├── 5. 调用 writer.write_batch()
        │       ├── 应用字段映射
        │       ├── 分批上传（每批 <= 1000 条）
        │       └── 失败自动重试（exponential backoff）
        ├── 6. 更新 Target 的 last_write_at 和 last_write_status
        └── 7. 返回 WriteResult（成功/失败计数 + 错误详情）
```

---

## 8. 错误处理策略

### 8.1 重试策略

| 错误类型 | HTTP 状态码 | 处理方式 |
|----------|-------------|----------|
| Rate Limit | 429 | Exponential backoff 重试，最多 3 次 |
| Service Unavailable | 503 | Exponential backoff 重试，最多 3 次 |
| Bad Request | 400 | 不重试，直接报错（通常是字段类型不匹配） |
| Unauthorized | 401/403 | 不重试，直接报错（API Key 无效或权限不足） |
| Partial Failure | 207 | 记录失败文档，成功文档不回滚 |

### 8.2 Exponential Backoff 参数

```python
RETRY_CONFIG = {
    "max_retries": 3,
    "base_delay_seconds": 1,       # 第 1 次重试等待 1s
    "max_delay_seconds": 8,        # 最大等待 8s
    "backoff_multiplier": 2,       # 每次翻倍：1s -> 2s -> 4s
    "retryable_status_codes": [429, 503],
}
```

---

## 9. Phase 2 扩展性设计

### 9.1 新增 Writer 的步骤

为新的目标类型（如 MySQL）添加支持只需：

1. 实现 `BaseTargetWriter` 接口的子类 `MySQLWriter`
2. 定义对应的 `ConnectionConfig` Pydantic 模型
3. 在 `WriterFactory` 中注册：`WriterFactory.register("mysql", MySQLWriter)`
4. 前端增加对应的连接配置表单

无需修改核心写入流程和 Target CRUD API。

### 9.2 预留扩展点

| 扩展点 | 说明 |
|--------|------|
| `BaseTargetWriter.write_batch()` | 各目标类型实现自己的批量写入逻辑 |
| `BaseTargetWriter.get_schema()` | 各目标类型返回自己的 Schema 格式 |
| `FieldMappingEngine` | 可扩展转换函数（类型转换、格式化等） |
| `ConfigEncryption` | 可替换为 Azure Key Vault 等外部密钥管理方案 |
| `WriterFactory` | 支持动态加载插件（Phase 3） |

---

## 10. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 写入语义 | merge-or-upload | 支持增量更新，幂等操作，可安全重试 |
| 批量大小 | 1000 条/批 | Azure AI Search API 单次上传上限，减少请求次数 |
| 加密方案 | Fernet 对称加密 | 简单可靠，适合 MVP 阶段；Phase 2 可升级为 Key Vault |
| 字段映射存储 | JSON 字段 | 灵活适配不同目标类型的映射结构 |
| 相似度算法 | SequenceMatcher + 包含检测 | 无需额外依赖，准确度满足自动建议需求 |
| Writer 模式 | Strategy + Factory | 新增目标类型时遵循开闭原则，不修改已有代码 |
| 重试机制 | Exponential backoff | 行业标准做法，避免雪崩效应 |
