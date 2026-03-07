"""Built-in skill definitions seeded on application startup."""

from app.data.pipeline_defaults import PIPELINE_DEFAULTS


def _pio(name: str) -> dict | None:
    """Get pipeline_io defaults for a skill by name."""
    return PIPELINE_DEFAULTS.get(name)


BUILTIN_SKILLS: list[dict] = [
    {
        "name": "DocumentCracker",
        "description": (
            "解析多种格式文档（PDF, DOCX, HTML, TXT, Markdown），提取纯文本内容和元数据。"
        ),
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": [
            "azure_content_understanding",
            "azure_doc_intelligence",
        ],
        "config_schema": {
            "type": "object",
            "properties": {
                "extract_images": {
                    "type": "boolean",
                    "default": False,
                    "description": "是否同时提取文档中的图片",
                },
                "ocr_enabled": {
                    "type": "boolean",
                    "default": True,
                    "description": "是否对扫描页面启用 OCR",
                },
                "encoding": {
                    "type": "string",
                    "default": "utf-8",
                    "description": "文本文件编码",
                },
            },
        },
        "pipeline_io": _pio("DocumentCracker"),
    },
    {
        "name": "TextSplitter",
        "description": (
            "按策略分割长文本为较小的文本块，支持固定大小、按句子、按段落等多种分块方式。"
        ),
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": None,
        "config_schema": {
            "type": "object",
            "properties": {
                "chunk_size": {
                    "type": "integer",
                    "default": 1000,
                    "description": "每个文本块的最大字符数",
                },
                "chunk_overlap": {
                    "type": "integer",
                    "default": 200,
                    "description": "相邻文本块之间的重叠字符数",
                },
                "split_method": {
                    "type": "string",
                    "enum": ["fixed_size", "sentence", "paragraph", "recursive"],
                    "default": "recursive",
                    "description": "分块策略",
                },
                "separators": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["\n\n", "\n", "。", ".", " "],
                    "description": "递归分割使用的分隔符列表",
                },
            },
        },
        "pipeline_io": _pio("TextSplitter"),
    },
    {
        "name": "TextMerger",
        "description": "将多个文本片段合并为一个连续的文本文档，支持自定义分隔符。",
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": None,
        "config_schema": {
            "type": "object",
            "properties": {
                "separator": {
                    "type": "string",
                    "default": "\n\n",
                    "description": "合并文本时使用的分隔符",
                },
                "max_length": {
                    "type": "integer",
                    "default": 0,
                    "description": "合并后文本的最大长度（0 表示无限制）",
                },
            },
        },
        "pipeline_io": _pio("TextMerger"),
    },
    {
        "name": "LanguageDetector",
        "description": "检测输入文本的语言，返回 ISO 639-1 语言代码和置信度分数。",
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_ai_foundry"],
        "config_schema": {
            "type": "object",
            "properties": {
                "default_language": {
                    "type": "string",
                    "default": "en",
                    "description": "无法检测时使用的默认语言代码",
                },
                "min_confidence": {
                    "type": "number",
                    "default": 0.5,
                    "description": "最低置信度阈值，低于此值返回默认语言",
                },
            },
        },
        "pipeline_io": _pio("LanguageDetector"),
    },
    {
        "name": "EntityRecognizer",
        "description": "从文本中识别命名实体，包括人名、地名、组织名、日期、数字等。",
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_ai_foundry"],
        "config_schema": {
            "type": "object",
            "properties": {
                "entity_categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["Person", "Location", "Organization", "DateTime", "Quantity"],
                    "description": "要识别的实体类别",
                },
                "model_version": {
                    "type": "string",
                    "default": "latest",
                    "description": "NER 模型版本",
                },
                "min_confidence": {
                    "type": "number",
                    "default": 0.6,
                    "description": "实体识别最低置信度",
                },
            },
        },
        "pipeline_io": _pio("EntityRecognizer"),
    },
    {
        "name": "EntityLinker",
        "description": "将识别到的实体链接到知识库条目（如 Wikipedia），提供消歧义和上下文关联。",
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_ai_foundry"],
        "config_schema": {
            "type": "object",
            "properties": {
                "knowledge_base": {
                    "type": "string",
                    "default": "wikipedia",
                    "description": "链接目标知识库",
                },
                "min_confidence": {
                    "type": "number",
                    "default": 0.5,
                    "description": "实体链接最低置信度",
                },
            },
        },
        "pipeline_io": _pio("EntityLinker"),
    },
    {
        "name": "KeyPhraseExtractor",
        "description": "从文本中提取关键短语和核心概念，用于摘要和索引。",
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_ai_foundry"],
        "config_schema": {
            "type": "object",
            "properties": {
                "max_phrases": {
                    "type": "integer",
                    "default": 10,
                    "description": "最多提取的关键短语数量",
                },
                "language": {
                    "type": "string",
                    "default": "auto",
                    "description": "文本语言（auto 为自动检测）",
                },
            },
        },
        "pipeline_io": _pio("KeyPhraseExtractor"),
    },
    {
        "name": "SentimentAnalyzer",
        "description": "分析文本的情感倾向，返回正面/负面/中立分类和置信度分数。",
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_ai_foundry"],
        "config_schema": {
            "type": "object",
            "properties": {
                "granularity": {
                    "type": "string",
                    "enum": ["document", "sentence"],
                    "default": "document",
                    "description": "情感分析粒度（文档级或句子级）",
                },
                "include_opinion_mining": {
                    "type": "boolean",
                    "default": False,
                    "description": "是否启用观点挖掘（抽取方面级情感）",
                },
            },
        },
        "pipeline_io": _pio("SentimentAnalyzer"),
    },
    {
        "name": "PIIDetector",
        "description": (
            "检测文本中的个人身份信息（PII），支持脱敏处理，包括姓名、身份证号、电话、邮箱等。"
        ),
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_ai_foundry"],
        "config_schema": {
            "type": "object",
            "properties": {
                "pii_categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": [
                        "Name",
                        "IDNumber",
                        "PhoneNumber",
                        "Email",
                        "Address",
                        "CreditCard",
                        "BankAccount",
                    ],
                    "description": "要检测的 PII 类型",
                },
                "redaction_mode": {
                    "type": "string",
                    "enum": ["mask", "replace", "remove"],
                    "default": "mask",
                    "description": (
                        "脱敏方式：mask（用 *** 替换）、replace（用标签替换）、remove（删除）"
                    ),
                },
                "mask_char": {
                    "type": "string",
                    "default": "*",
                    "description": "mask 模式下的替换字符",
                },
            },
        },
        "pipeline_io": _pio("PIIDetector"),
    },
    {
        "name": "TextTranslator",
        "description": "将文本从一种语言翻译为另一种语言，支持自动检测源语言。",
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_ai_foundry"],
        "config_schema": {
            "type": "object",
            "properties": {
                "target_language": {
                    "type": "string",
                    "default": "en",
                    "description": "目标翻译语言代码（ISO 639-1）",
                },
                "source_language": {
                    "type": "string",
                    "default": "auto",
                    "description": "源语言代码（auto 为自动检测）",
                },
            },
        },
        "pipeline_io": _pio("TextTranslator"),
    },
    {
        "name": "OCR",
        "description": "对图片或扫描文档进行光学字符识别，提取文本内容及位置信息。",
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_ai_foundry"],
        "config_schema": {
            "type": "object",
            "properties": {
                "languages": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["en", "zh"],
                    "description": "OCR 识别语言列表",
                },
                "detect_orientation": {
                    "type": "boolean",
                    "default": True,
                    "description": "是否自动检测文本方向",
                },
                "output_format": {
                    "type": "string",
                    "enum": ["text", "structured"],
                    "default": "text",
                    "description": "输出格式：纯文本或带位置的结构化数据",
                },
            },
        },
        "pipeline_io": _pio("OCR"),
    },
    {
        "name": "ImageAnalyzer",
        "description": "分析图片内容，生成描述、提取标签，支持物体检测和场景识别。",
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_ai_foundry"],
        "config_schema": {
            "type": "object",
            "properties": {
                "features": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["description", "tags", "objects"],
                    "description": "要提取的图片特征",
                },
                "language": {
                    "type": "string",
                    "default": "en",
                    "description": "描述文本的语言",
                },
                "max_tags": {
                    "type": "integer",
                    "default": 20,
                    "description": "最多返回的标签数量",
                },
            },
        },
        "pipeline_io": _pio("ImageAnalyzer"),
    },
    {
        "name": "TextEmbedder",
        "description": (
            "将文本转化为向量表示（embedding），支持多种模型（OpenAI, Azure OpenAI, 本地模型等）。"
        ),
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_openai"],
        "config_schema": {
            "type": "object",
            "properties": {
                "model_name": {
                    "type": "string",
                    "default": "text-embedding-ada-002",
                    "description": "Embedding 模型名称",
                },
                "dimensions": {
                    "type": "integer",
                    "default": 1536,
                    "description": "向量维度",
                },
                "batch_size": {
                    "type": "integer",
                    "default": 16,
                    "description": "批量处理大小",
                },
            },
        },
        "pipeline_io": _pio("TextEmbedder"),
    },
    {
        "name": "Shaper",
        "description": (
            "数据整形工具，用于重新组织、映射和转换字段结构，将数据适配为下游节点期望的格式。"
        ),
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": None,
        "config_schema": {
            "type": "object",
            "properties": {
                "field_mappings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "source": {"type": "string"},
                            "target": {"type": "string"},
                            "default_value": {},
                        },
                        "required": ["source", "target"],
                    },
                    "default": [],
                    "description": "字段映射规则列表",
                },
            },
        },
        "pipeline_io": _pio("Shaper"),
    },
    {
        "name": "Conditional",
        "description": "条件路由节点，根据输入数据的条件表达式决定数据流向不同的下游分支。",
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": None,
        "config_schema": {
            "type": "object",
            "properties": {
                "condition_field": {
                    "type": "string",
                    "description": "用于条件判断的输入字段路径",
                },
                "operator": {
                    "type": "string",
                    "enum": [
                        "equals",
                        "not_equals",
                        "contains",
                        "greater_than",
                        "less_than",
                        "regex_match",
                    ],
                    "default": "equals",
                    "description": "比较运算符",
                },
                "condition_value": {
                    "description": "比较目标值",
                },
            },
            "required": ["condition_field"],
        },
        "pipeline_io": _pio("Conditional"),
    },
    {
        "name": "GenAIPrompt",
        "description": (
            "使用 Azure OpenAI chat completion 模型对文本进行 AI 处理，支持摘要、分类、信息提取等。"
        ),
        "skill_type": "builtin",
        "is_builtin": True,
        "required_resource_types": ["azure_openai"],
        "config_schema": {
            "type": "object",
            "properties": {
                "system_prompt": {
                    "type": "string",
                    "default": "You are a helpful assistant.",
                    "description": "系统提示词",
                },
                "user_prompt_template": {
                    "type": "string",
                    "default": "Process the following text:\n\n{text}",
                    "description": ("用户提示词模板，{text} 会被替换为输入文本"),
                },
                "model_deployment": {
                    "type": "string",
                    "default": "gpt-4o",
                    "description": "Azure OpenAI 模型部署名称",
                },
                "temperature": {
                    "type": "number",
                    "default": 0.7,
                    "description": "生成温度 (0-2)",
                },
                "max_tokens": {
                    "type": "integer",
                    "default": 1024,
                    "description": "最大生成 token 数",
                },
            },
        },
        "pipeline_io": _pio("GenAIPrompt"),
    },
]
