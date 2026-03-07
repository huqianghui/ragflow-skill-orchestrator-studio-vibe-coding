"""Pre-configured pipeline templates.

Each template provides a complete ``graph_data.nodes`` definition that
can be used to bootstrap a new pipeline.  ``skill_name`` references are
used instead of ``skill_id`` — the frontend resolves them at creation time.
"""

PIPELINE_TEMPLATES: list[dict] = [
    {
        "name": "PDF 文档索引",
        "description": "最常见的文档处理流程：解析 PDF → 分块 → 向量化",
        "nodes": [
            {
                "id": "t1-n1",
                "skill_name": "DocumentCracker",
                "label": "文档解析",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {
                        "name": "file_content",
                        "source": "/document/file_content",
                    },
                    {"name": "file_name", "source": "/document/file_name"},
                ],
                "outputs": [
                    {"name": "content", "targetName": "content"},
                    {"name": "markdown", "targetName": "markdown"},
                    {"name": "text", "targetName": "text"},
                    {"name": "tables", "targetName": "tables"},
                    {"name": "figures", "targetName": "figures"},
                    {"name": "pages", "targetName": "pages"},
                    {"name": "metadata", "targetName": "metadata"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t1-n2",
                "skill_name": "TextSplitter",
                "label": "文本分块",
                "position": 1,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/content"},
                ],
                "outputs": [
                    {"name": "chunks", "targetName": "chunks"},
                    {"name": "totalChunks", "targetName": "totalChunks"},
                ],
                "config_overrides": {
                    "chunk_size": 1000,
                    "chunk_overlap": 200,
                },
            },
            {
                "id": "t1-n3",
                "skill_name": "TextEmbedder",
                "label": "向量化",
                "position": 2,
                "context": "/document/chunks/*",
                "inputs": [
                    {"name": "text", "source": "/document/chunks/*/text"},
                ],
                "outputs": [
                    {"name": "embedding", "targetName": "embedding"},
                ],
                "config_overrides": {},
            },
        ],
    },
    {
        "name": "多语言文档处理",
        "description": "先检测语言再翻译，然后分块和向量化",
        "nodes": [
            {
                "id": "t2-n1",
                "skill_name": "DocumentCracker",
                "label": "文档解析",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {
                        "name": "file_content",
                        "source": "/document/file_content",
                    },
                    {"name": "file_name", "source": "/document/file_name"},
                ],
                "outputs": [
                    {"name": "content", "targetName": "content"},
                    {"name": "text", "targetName": "text"},
                    {"name": "metadata", "targetName": "metadata"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t2-n2",
                "skill_name": "LanguageDetector",
                "label": "语言检测",
                "position": 1,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/content"},
                ],
                "outputs": [
                    {"name": "languageCode", "targetName": "language"},
                    {"name": "languageName", "targetName": "languageName"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t2-n3",
                "skill_name": "TextTranslator",
                "label": "文本翻译",
                "position": 2,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/content"},
                ],
                "outputs": [
                    {
                        "name": "translatedText",
                        "targetName": "translatedText",
                    },
                ],
                "config_overrides": {"target_language": "en"},
            },
            {
                "id": "t2-n4",
                "skill_name": "TextSplitter",
                "label": "文本分块",
                "position": 3,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/translatedText"},
                ],
                "outputs": [
                    {"name": "chunks", "targetName": "chunks"},
                    {"name": "totalChunks", "targetName": "totalChunks"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t2-n5",
                "skill_name": "TextEmbedder",
                "label": "向量化",
                "position": 4,
                "context": "/document/chunks/*",
                "inputs": [
                    {"name": "text", "source": "/document/chunks/*/text"},
                ],
                "outputs": [
                    {"name": "embedding", "targetName": "embedding"},
                ],
                "config_overrides": {},
            },
        ],
    },
    {
        "name": "实体提取与索引",
        "description": "从分块中提取实体和关键词",
        "nodes": [
            {
                "id": "t3-n1",
                "skill_name": "DocumentCracker",
                "label": "文档解析",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {
                        "name": "file_content",
                        "source": "/document/file_content",
                    },
                    {"name": "file_name", "source": "/document/file_name"},
                ],
                "outputs": [
                    {"name": "content", "targetName": "content"},
                    {"name": "text", "targetName": "text"},
                    {"name": "metadata", "targetName": "metadata"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t3-n2",
                "skill_name": "TextSplitter",
                "label": "文本分块",
                "position": 1,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/content"},
                ],
                "outputs": [
                    {"name": "chunks", "targetName": "chunks"},
                    {"name": "totalChunks", "targetName": "totalChunks"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t3-n3",
                "skill_name": "EntityRecognizer",
                "label": "实体识别",
                "position": 2,
                "context": "/document/chunks/*",
                "inputs": [
                    {"name": "text", "source": "/document/chunks/*/text"},
                ],
                "outputs": [
                    {"name": "entities", "targetName": "entities"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t3-n4",
                "skill_name": "KeyPhraseExtractor",
                "label": "关键词提取",
                "position": 3,
                "context": "/document/chunks/*",
                "inputs": [
                    {"name": "text", "source": "/document/chunks/*/text"},
                ],
                "outputs": [
                    {"name": "keyPhrases", "targetName": "keyPhrases"},
                ],
                "config_overrides": {},
            },
        ],
    },
    {
        "name": "PII 脱敏处理",
        "description": "先脱敏再分块和向量化",
        "nodes": [
            {
                "id": "t4-n1",
                "skill_name": "DocumentCracker",
                "label": "文档解析",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {
                        "name": "file_content",
                        "source": "/document/file_content",
                    },
                    {"name": "file_name", "source": "/document/file_name"},
                ],
                "outputs": [
                    {"name": "content", "targetName": "content"},
                    {"name": "text", "targetName": "text"},
                    {"name": "metadata", "targetName": "metadata"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t4-n2",
                "skill_name": "PIIDetector",
                "label": "PII 检测与脱敏",
                "position": 1,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/content"},
                ],
                "outputs": [
                    {"name": "entities", "targetName": "piiEntities"},
                    {"name": "redactedText", "targetName": "redactedText"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t4-n3",
                "skill_name": "TextSplitter",
                "label": "文本分块",
                "position": 2,
                "context": "/document",
                "inputs": [
                    {"name": "text", "source": "/document/redactedText"},
                ],
                "outputs": [
                    {"name": "chunks", "targetName": "chunks"},
                    {"name": "totalChunks", "targetName": "totalChunks"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t4-n4",
                "skill_name": "TextEmbedder",
                "label": "向量化",
                "position": 3,
                "context": "/document/chunks/*",
                "inputs": [
                    {"name": "text", "source": "/document/chunks/*/text"},
                ],
                "outputs": [
                    {"name": "embedding", "targetName": "embedding"},
                ],
                "config_overrides": {},
            },
        ],
    },
    {
        "name": "图片分析索引",
        "description": "分析图片生成描述后向量化",
        "nodes": [
            {
                "id": "t5-n1",
                "skill_name": "ImageAnalyzer",
                "label": "图片分析",
                "position": 0,
                "context": "/document",
                "inputs": [
                    {
                        "name": "file_content",
                        "source": "/document/file_content",
                    },
                    {"name": "file_name", "source": "/document/file_name"},
                ],
                "outputs": [
                    {
                        "name": "description",
                        "targetName": "imageDescription",
                    },
                    {"name": "tags", "targetName": "imageTags"},
                    {"name": "objects", "targetName": "imageObjects"},
                ],
                "config_overrides": {},
            },
            {
                "id": "t5-n2",
                "skill_name": "TextEmbedder",
                "label": "向量化",
                "position": 1,
                "context": "/document",
                "inputs": [
                    {
                        "name": "text",
                        "source": "/document/imageDescription",
                    },
                ],
                "outputs": [
                    {"name": "embedding", "targetName": "embedding"},
                ],
                "config_overrides": {},
            },
        ],
    },
]
