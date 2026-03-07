"""Default pipeline I/O declarations for all built-in skills."""

PIPELINE_DEFAULTS: dict[str, dict] = {
    "DocumentCracker": {
        "default_context": "/document",
        "inputs": [
            {
                "name": "file_content",
                "source": "/document/file_content",
                "description": "Raw file bytes",
            },
            {
                "name": "file_name",
                "source": "/document/file_name",
                "description": "Original filename",
            },
        ],
        "outputs": [
            {"name": "content", "targetName": "content", "description": "Extracted text"},
            {"name": "markdown", "targetName": "markdown", "description": "Markdown content"},
            {"name": "text", "targetName": "text", "description": "Plain text"},
            {"name": "tables", "targetName": "tables", "description": "Extracted tables"},
            {"name": "figures", "targetName": "figures", "description": "Extracted figures"},
            {"name": "pages", "targetName": "pages", "description": "Page metadata"},
            {"name": "metadata", "targetName": "metadata", "description": "Document metadata"},
        ],
    },
    "TextSplitter": {
        "default_context": "/document",
        "inputs": [
            {"name": "text", "source": "/document/content", "description": "Text to split"},
        ],
        "outputs": [
            {"name": "chunks", "targetName": "chunks", "description": "Text chunks array"},
            {"name": "totalChunks", "targetName": "totalChunks", "description": "Chunk count"},
        ],
    },
    "TextMerger": {
        "default_context": "/document",
        "inputs": [
            {
                "name": "texts",
                "source": "/document/chunks",
                "description": "Array of texts to merge",
            },
        ],
        "outputs": [
            {"name": "text", "targetName": "mergedText", "description": "Merged text"},
            {
                "name": "sourceCount",
                "targetName": "mergeSourceCount",
                "description": "Source count",
            },
        ],
    },
    "LanguageDetector": {
        "default_context": "/document",
        "inputs": [
            {"name": "text", "source": "/document/content", "description": "Text to detect"},
        ],
        "outputs": [
            {
                "name": "languageCode",
                "targetName": "language",
                "description": "ISO 639-1 code",
            },
            {
                "name": "languageName",
                "targetName": "languageName",
                "description": "Language name",
            },
            {
                "name": "confidence",
                "targetName": "languageConfidence",
                "description": "Detection confidence",
            },
        ],
    },
    "EntityRecognizer": {
        "default_context": "/document",
        "inputs": [
            {"name": "text", "source": "/document/content", "description": "Text to analyze"},
        ],
        "outputs": [
            {
                "name": "entities",
                "targetName": "entities",
                "description": "Recognized entities",
            },
        ],
    },
    "EntityLinker": {
        "default_context": "/document",
        "inputs": [
            {"name": "text", "source": "/document/content", "description": "Text to analyze"},
        ],
        "outputs": [
            {
                "name": "entities",
                "targetName": "linkedEntities",
                "description": "Linked entities",
            },
        ],
    },
    "KeyPhraseExtractor": {
        "default_context": "/document",
        "inputs": [
            {"name": "text", "source": "/document/content", "description": "Text to analyze"},
        ],
        "outputs": [
            {
                "name": "keyPhrases",
                "targetName": "keyPhrases",
                "description": "Extracted key phrases",
            },
        ],
    },
    "SentimentAnalyzer": {
        "default_context": "/document",
        "inputs": [
            {"name": "text", "source": "/document/content", "description": "Text to analyze"},
        ],
        "outputs": [
            {"name": "sentiment", "targetName": "sentiment", "description": "Sentiment label"},
            {
                "name": "confidenceScores",
                "targetName": "sentimentScores",
                "description": "Confidence scores",
            },
        ],
    },
    "PIIDetector": {
        "default_context": "/document",
        "inputs": [
            {"name": "text", "source": "/document/content", "description": "Text to scan"},
        ],
        "outputs": [
            {
                "name": "entities",
                "targetName": "piiEntities",
                "description": "Detected PII entities",
            },
            {
                "name": "redactedText",
                "targetName": "redactedText",
                "description": "Redacted text",
            },
        ],
    },
    "TextTranslator": {
        "default_context": "/document",
        "inputs": [
            {
                "name": "text",
                "source": "/document/content",
                "description": "Text to translate",
            },
        ],
        "outputs": [
            {
                "name": "translatedText",
                "targetName": "translatedText",
                "description": "Translated text",
            },
            {
                "name": "sourceLanguage",
                "targetName": "sourceLanguage",
                "description": "Detected source language",
            },
        ],
    },
    "OCR": {
        "default_context": "/document",
        "inputs": [
            {
                "name": "file_content",
                "source": "/document/file_content",
                "description": "Image bytes",
            },
            {
                "name": "file_name",
                "source": "/document/file_name",
                "description": "Image filename",
            },
        ],
        "outputs": [
            {"name": "text", "targetName": "ocrText", "description": "Recognized text"},
            {"name": "pages", "targetName": "ocrPages", "description": "OCR page results"},
        ],
    },
    "ImageAnalyzer": {
        "default_context": "/document",
        "inputs": [
            {
                "name": "file_content",
                "source": "/document/file_content",
                "description": "Image bytes",
            },
            {
                "name": "file_name",
                "source": "/document/file_name",
                "description": "Image filename",
            },
        ],
        "outputs": [
            {
                "name": "description",
                "targetName": "imageDescription",
                "description": "Image description",
            },
            {"name": "tags", "targetName": "imageTags", "description": "Image tags"},
            {
                "name": "objects",
                "targetName": "imageObjects",
                "description": "Detected objects",
            },
        ],
    },
    "TextEmbedder": {
        "default_context": "/document",
        "inputs": [
            {"name": "text", "source": "/document/content", "description": "Text to embed"},
        ],
        "outputs": [
            {
                "name": "embedding",
                "targetName": "embedding",
                "description": "Embedding vector",
            },
        ],
    },
    "GenAIPrompt": {
        "default_context": "/document",
        "inputs": [
            {"name": "text", "source": "/document/content", "description": "Text to process"},
        ],
        "outputs": [
            {"name": "output", "targetName": "aiOutput", "description": "AI output text"},
        ],
    },
    "Shaper": {
        "default_context": "/document",
        "inputs": [],
        "outputs": [],
    },
    "Conditional": {
        "default_context": "/document",
        "inputs": [],
        "outputs": [
            {
                "name": "matches",
                "targetName": "conditionResult",
                "description": "Condition result",
            },
        ],
    },
}
