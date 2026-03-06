# Design: Executable Built-in Skills

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend                                     │
│                                                                      │
│  SkillLibrary ──click builtin──▶ BuiltinSkillEditor (NEW)           │
│       │                              ├─ Resource Binding card        │
│       │                              ├─ Config Form (auto-generated) │
│       └──click python_code──▶        ├─ Test Input (text / file)     │
│           SkillEditor (existing)     └─ Test Output                  │
│                                                                      │
│  Connections page ── new "Default" toggle per row                    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ API calls
┌────────────────────────────▼────────────────────────────────────────┐
│                         Backend API                                  │
│                                                                      │
│  PUT /skills/{id}/configure    ── update config_values +             │
│                                   bound_connection_id (builtin only) │
│  POST /skills/{id}/test        ── extended: builtin + python_code    │
│  POST /skills/upload-test-file ── multipart temp file upload         │
│  PUT /connections/{id}/set-default ── toggle is_default              │
│  GET /connections/defaults     ── get one default per type           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      Execution Layer                                 │
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────────┐                   │
│  │  SkillRunner      │    │  BuiltinSkillRunner   │ (NEW)            │
│  │  (python_code)    │    │  (builtin)            │                  │
│  └──────────────────┘    └──────────┬───────────┘                   │
│                                      │                               │
│                           ┌──────────▼───────────┐                  │
│                           │  Builtin Impls       │                  │
│                           │  ├─ language_skills   │ Azure AI Language│
│                           │  ├─ vision_skills     │ Azure AI Vision  │
│                           │  ├─ openai_skills     │ Azure OpenAI     │
│                           │  ├─ doc_skills        │ Doc Intelligence │
│                           │  └─ utility_skills    │ Local logic      │
│                           └──────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Model Changes

### Connection Model (modified)

```python
class Connection(BaseModel):
    __tablename__ = "connections"

    name: Mapped[str] = mapped_column(String(255), index=True, unique=True)
    connection_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)  # NEW
```

Constraint: At most one `is_default=true` per `connection_type` (enforced in API logic, not DB constraint for SQLite compatibility).

### Skill Model (modified)

```python
class Skill(BaseModel):
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(255), index=True, unique=True)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    skill_type: Mapped[str] = mapped_column(String(50))
    config_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)

    # python_code type fields (unchanged)
    source_code: Mapped[str | None] = mapped_column(Text, default=None)
    additional_requirements: Mapped[str | None] = mapped_column(Text, default=None)
    test_input: Mapped[dict | None] = mapped_column(JSON, default=None)
    connection_mappings: Mapped[dict | None] = mapped_column(JSON, default=None)

    # NEW: builtin skill runtime configuration
    required_resource_types: Mapped[dict | None] = mapped_column(JSON, default=None)
    # e.g. ["azure_ai_foundry"] or ["azure_content_understanding", "azure_doc_intelligence"]
    bound_connection_id: Mapped[str | None] = mapped_column(String, default=None)
    # FK-like reference to connections.id (no hard FK for flexibility)
    config_values: Mapped[dict | None] = mapped_column(JSON, default=None)
    # User's chosen parameter values, e.g. {"entity_categories": ["Person", "Location"]}
```

### Built-in Skill Definitions (updated)

Each skill in `BUILTIN_SKILLS` gains `required_resource_types`:

```python
{
    "name": "EntityRecognizer",
    "skill_type": "builtin",
    "is_builtin": True,
    "required_resource_types": ["azure_ai_foundry"],
    "description": "...",
    "config_schema": { ... },
}
```

## Built-in Skill Implementation Architecture

### File Structure

```
backend/app/services/builtin_skills/
├── __init__.py
├── runner.py              # BuiltinSkillRunner - dispatches to implementations
├── base.py                # BaseBuiltinSkill abstract class
├── language_skills.py     # EntityRecognizer, EntityLinker, KeyPhraseExtractor,
│                          # SentimentAnalyzer, PIIDetector, LanguageDetector
├── translator_skill.py    # TextTranslator
├── vision_skills.py       # OCR, ImageAnalyzer
├── openai_skills.py       # TextEmbedder, GenAIPrompt
├── doc_skills.py          # DocumentCracker
└── utility_skills.py      # TextSplitter, TextMerger, Shaper, Conditional
```

### Base Class

```python
class BaseBuiltinSkill(ABC):
    """Base class for all built-in skill implementations."""

    @abstractmethod
    def execute(self, data: dict, config: dict, client: Any) -> dict:
        """
        Execute the skill on a single record.

        Args:
            data: Input record data (Azure Custom Skill format)
            config: User-configured parameters (from config_values)
            client: Authenticated SDK client (from bound Connection)
        Returns:
            dict with processed results
        """
        ...
```

### BuiltinSkillRunner

```python
class BuiltinSkillRunner:
    """Executes builtin skills using registered implementations."""

    SKILL_REGISTRY: dict[str, type[BaseBuiltinSkill]] = {
        "EntityRecognizer": EntityRecognizerSkill,
        "LanguageDetector": LanguageDetectorSkill,
        # ... all 16 skills
    }

    def execute(self, skill_name: str, test_input: dict,
                config: dict, client: Any | None) -> dict:
        """Execute a builtin skill against test input."""
        impl_cls = self.SKILL_REGISTRY[skill_name]
        impl = impl_cls()

        results = []
        for record in test_input.get("values", []):
            record_id = record.get("recordId", "0")
            try:
                output = impl.execute(record["data"], config, client)
                results.append({"recordId": record_id, "data": output, "errors": [], "warnings": []})
            except Exception as e:
                results.append({"recordId": record_id, "data": {}, "errors": [{"message": str(e)}], "warnings": []})

        return {"values": results, "logs": [], "execution_time_ms": ...}
```

### Example: EntityRecognizer Implementation

```python
class EntityRecognizerSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any) -> dict:
        from azure.ai.textanalytics import TextAnalyticsClient
        from azure.core.credentials import AzureKeyCredential

        text = data.get("text", "")
        categories = config.get("entity_categories", ["Person", "Location", "Organization"])
        min_confidence = config.get("min_confidence", 0.6)

        # client is an httpx.Client with base_url and api-key header
        # Use Azure AI Language REST API
        response = client.post(
            "/language/:analyze-text",
            params={"api-version": "2023-04-01"},
            json={
                "kind": "EntityRecognition",
                "parameters": {"modelVersion": config.get("model_version", "latest")},
                "analysisInput": {"documents": [{"id": "1", "text": text, "language": "en"}]},
            },
        )
        response.raise_for_status()
        result = response.json()

        entities = []
        for doc in result.get("results", {}).get("documents", []):
            for entity in doc.get("entities", []):
                if entity["category"] in categories and entity["confidenceScore"] >= min_confidence:
                    entities.append({
                        "text": entity["text"],
                        "category": entity["category"],
                        "subcategory": entity.get("subcategory"),
                        "confidence": entity["confidenceScore"],
                        "offset": entity["offset"],
                        "length": entity["length"],
                    })

        return {"entities": entities}
```

### Example: TextSplitter (Local, no client)

```python
class TextSplitterSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any) -> dict:
        text = data.get("text", "")
        chunk_size = config.get("chunk_size", 1000)
        chunk_overlap = config.get("chunk_overlap", 200)
        method = config.get("split_method", "recursive")
        # ... pure Python chunking logic
        return {"chunks": chunks}
```

## API Changes

### PUT /api/v1/skills/{id}/configure (NEW)

Update builtin skill's runtime configuration (config_values + bound_connection_id).

```json
// Request
{
    "config_values": {"entity_categories": ["Person", "Location"], "min_confidence": 0.8},
    "bound_connection_id": "conn-uuid-here"
}
// Response: SkillResponse (full skill object)
```

Only allowed for `is_builtin=true` skills. Returns 403 for non-builtin.

### POST /api/v1/skills/{id}/test (EXTENDED)

Now supports both `python_code` and `builtin` types:
- `python_code`: existing behavior (SkillRunner)
- `builtin`: uses BuiltinSkillRunner, resolves bound_connection_id to get client

```json
// Request
{
    "test_input": {
        "values": [{"recordId": "1", "data": {"text": "Microsoft was founded by Bill Gates."}}]
    },
    "config_override": {"entity_categories": ["Person", "Organization"]}  // optional
}
```

`config_override` allows testing with different params without saving first.

### POST /api/v1/skills/upload-test-file (NEW)

Multipart file upload for testing DocumentCracker, OCR, ImageAnalyzer.

```
POST /api/v1/skills/upload-test-file
Content-Type: multipart/form-data
file: <binary>

Response:
{
    "file_id": "tmp-uuid",
    "filename": "invoice.pdf",
    "content_type": "application/pdf",
    "size": 123456,
    "expires_at": "2026-03-06T20:00:00Z"
}
```

The `file_id` can then be used in test_input:
```json
{"values": [{"recordId": "1", "data": {"file_id": "tmp-uuid"}}]}
```

### PUT /api/v1/connections/{id}/set-default (NEW)

Toggle a connection as default for its type.

```json
// Request (no body needed)
// Response: ConnectionResponse

// Side effect: clears is_default on any other connection of the same type
```

### GET /api/v1/connections/defaults (NEW)

Returns one default connection per type (for auto-binding UI).

```json
{
    "azure_ai_foundry": {"id": "...", "name": "..."},
    "azure_openai": {"id": "...", "name": "..."},
    "azure_content_understanding": null,
    "azure_doc_intelligence": null,
    "openai": null,
    "http_api": null
}
```

## Frontend Design

### BuiltinSkillEditor Page (`/skills/{id}/configure`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Skills    EntityRecognizer (Built-in)      [Save]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Left Column ─────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  Description (read-only)                                  │ │
│  │  从文本中识别命名实体，包括人名、地名、组织名...              │ │
│  │                                                           │ │
│  │  ── Resource Binding ──────────────────────────────       │ │
│  │  Required: Azure AI Foundry (multi-service)               │ │
│  │  Connection: [foundry-eastus (default) ▼]  ✅ Connected   │ │
│  │                                                           │ │
│  │  ── Configuration ─────────────────────────────           │ │
│  │  (Auto-generated from config_schema)                      │ │
│  │                                                           │ │
│  │  Entity Categories:                                       │ │
│  │  ☑ Person  ☑ Location  ☑ Organization  ☑ DateTime        │ │
│  │  ☑ Quantity  ☐ URL  ☐ Email  ☐ PersonType                │ │
│  │  ☐ Event  ☐ Product  ☐ Skill  ☐ Address                  │ │
│  │  ☐ Phone Number  ☐ IP Address                            │ │
│  │                                                           │ │
│  │  Model Version: [latest       ▼]                          │ │
│  │  Min Confidence: [────●──────] 0.6                        │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Right Column ────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  ── Test Input ────────────────────────────               │ │
│  │  ┌─────────────────────────────────────────┐             │ │
│  │  │ Microsoft was founded by Bill Gates in  │             │ │
│  │  │ Redmond, WA on April 4, 1975.          │             │ │
│  │  └─────────────────────────────────────────┘             │ │
│  │  [📎 Upload File]  [▶ Run Test]                          │ │
│  │                                                           │ │
│  │  ── Test Output ───────────────────────────               │ │
│  │  ✅ Success (230ms)                                       │ │
│  │  ┌─────────────────────────────────────────┐             │ │
│  │  │ { "entities": [                        │             │ │
│  │  │   {"text":"Microsoft",                 │             │ │
│  │  │    "category":"Organization",          │             │ │
│  │  │    "confidence": 0.98},                │             │ │
│  │  │   {"text":"Bill Gates",                │             │ │
│  │  │    "category":"Person",                │             │ │
│  │  │    "confidence": 0.99},                │             │ │
│  │  │   ...                                  │             │ │
│  │  │ ]}                                     │             │ │
│  │  └─────────────────────────────────────────┘             │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Config Form Auto-Generation

The config_schema (JSON Schema) drives automatic form rendering:

| JSON Schema Type | Ant Design Component |
|-----------------|---------------------|
| `string` with `enum` | `Select` dropdown |
| `string` (plain) | `Input` |
| `boolean` | `Switch` |
| `integer` / `number` | `InputNumber` (or `Slider` if min/max defined) |
| `array` of `string` with known options | `Checkbox.Group` |
| `array` (free-form) | `Select` mode="tags" |
| `object` (nested) | JSON editor fallback |

### Navigation Changes

- SkillLibrary: clicking a builtin skill name navigates to `/skills/{id}/configure` (instead of opening detail modal)
- SkillLibrary: "Configure" button replaces disabled "Edit" for builtin skills
- Route: add `/skills/:id/configure` → `BuiltinSkillEditor`

### Connection Page Changes

- Add "Default" column with star/toggle icon
- Clicking star on a connection sets it as default (API call to `set-default`)
- Only one star active per connection_type
- Visual indicator: filled star = default, outline star = not default

## Azure API Reference

### Foundry Skills - Azure AI Language REST API

All Language skills (NER, Sentiment, Key Phrase, PII, Entity Linking, Language Detection) use:
- Endpoint: `{foundry_endpoint}/language/:analyze-text?api-version=2023-04-01`
- Auth: `api-key` header
- Each skill maps to a different `kind` in the request body

### Foundry Skills - Azure AI Translator REST API

Text Translation uses:
- Endpoint: `{foundry_endpoint}/translator/text/v3.0/translate`
- Auth: `Ocp-Apim-Subscription-Key` header

### Foundry Skills - Azure AI Vision REST API

OCR and Image Analysis use:
- Endpoint: `{foundry_endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01`
- Auth: `Ocp-Apim-Subscription-Key` header

### Azure OpenAI Skills

TextEmbedder and GenAIPrompt use:
- Standard Azure OpenAI SDK (already in ClientFactory)
- TextEmbedder: `client.embeddings.create()`
- GenAIPrompt: `client.chat.completions.create()`

### Document Processing Skills

DocumentCracker uses:
- Azure Content Understanding: `{endpoint}/contentunderstanding/analyzers/{analyzer_id}:analyze`
- OR Azure Document Intelligence: `client.begin_analyze_document("prebuilt-read", ...)`
