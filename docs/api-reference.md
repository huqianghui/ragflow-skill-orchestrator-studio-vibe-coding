# API Reference

Base URL: `/api/v1`

## Connection API

### List Connections

```
GET /connections?page=1&page_size=10
```

**Response** `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "my-openai",
      "connection_type": "azure_openai",
      "description": "Production Azure OpenAI",
      "config": { "endpoint": "https://...", "api_key": "****cdef" },
      "created_at": "2024-01-01T00:00:00",
      "updated_at": "2024-01-01T00:00:00"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10
}
```

Secret fields in `config` are always masked in responses.

### Create Connection

```
POST /connections
```

**Body**
```json
{
  "name": "my-openai",
  "connection_type": "azure_openai",
  "description": "Optional description",
  "config": {
    "endpoint": "https://myresource.openai.azure.com",
    "api_key": "your-api-key",
    "api_version": "2024-02-01",
    "deployment": "gpt-4o"
  }
}
```

**Supported connection types and required config fields:**

| Type | Required Config |
|------|----------------|
| `azure_openai` | `endpoint`, `api_key`, `api_version`, `deployment` |
| `openai` | `api_key` |
| `azure_doc_intelligence` | `endpoint`, `api_key` |
| `azure_content_understanding` | `endpoint`, `api_key` |
| `azure_ai_foundry` | `endpoint`, `api_key` |
| `http_api` | `base_url` (optional: `headers`, `auth_type`, `auth_token`) |

**Response** `201 Created` — returns `ConnectionResponse`

### Get Connection

```
GET /connections/{connection_id}
```

**Response** `200 OK` — returns `ConnectionResponse`

### Update Connection

```
PUT /connections/{connection_id}
```

**Body** — any subset of fields (partial update)
```json
{
  "name": "updated-name",
  "config": { "api_key": "new-key" }
}
```

**Response** `200 OK` — returns `ConnectionResponse`

### Delete Connection

```
DELETE /connections/{connection_id}
```

**Response** `204 No Content`

### Test Connection

```
POST /connections/{connection_id}/test
```

Tests connectivity by making a lightweight call to the service.

**Response** `200 OK`
```json
{
  "success": true,
  "message": "Connection successful"
}
```

---

## Skill API

### List Skills

```
GET /skills?page=1&page_size=10
```

**Response** `200 OK` — paginated list of `SkillResponse`

### Create Skill

```
POST /skills
```

**Body**
```json
{
  "name": "MySkill",
  "description": "Extracts key phrases",
  "skill_type": "python_code",
  "source_code": "def process(data, context):\n    return {'result': data['text'].upper()}",
  "additional_requirements": "beautifulsoup4>=4.12.0",
  "test_input": {
    "values": [{ "recordId": "1", "data": { "text": "hello" } }]
  },
  "connection_mappings": { "llm": "<connection-id>" }
}
```

**Skill types:** `python_code`, `web_api`, `config_template`

**Response** `201 Created` — returns `SkillResponse`

### Get Skill

```
GET /skills/{skill_id}
```

### Update Skill

```
PUT /skills/{skill_id}
```

Built-in skills cannot be modified (returns `403`).

### Delete Skill

```
DELETE /skills/{skill_id}
```

**Response** `204 No Content`

### Get Preloaded Imports

```
GET /skills/preloaded-imports
```

Returns the list of standard library and third-party imports available in every Python skill.

**Response** `200 OK`
```json
{
  "standard_library": [
    "import re",
    "import json",
    "import math",
    "..."
  ],
  "third_party": [
    "import requests",
    "from openai import OpenAI, AzureOpenAI",
    "..."
  ]
}
```

### Test Saved Skill

```
POST /skills/{skill_id}/test
```

Executes a saved `python_code` skill with sample input. Only works for `python_code` skills.

**Body**
```json
{
  "test_input": {
    "values": [
      { "recordId": "1", "data": { "text": "Hello, World!" } }
    ]
  }
}
```

**Response** `200 OK`
```json
{
  "values": [
    {
      "recordId": "1",
      "data": { "result": "..." },
      "errors": [],
      "warnings": []
    }
  ],
  "logs": [
    { "level": "INFO", "message": "Processing..." }
  ],
  "execution_time_ms": 42
}
```

Error responses per record (other records still execute):
```json
{
  "values": [
    {
      "recordId": "1",
      "data": null,
      "errors": [{ "message": "division by zero", "traceback": "..." }],
      "warnings": []
    }
  ]
}
```

### Test Unsaved Code

```
POST /skills/test-code
```

Executes Python code without saving it first. Useful for testing during development.

**Body**
```json
{
  "source_code": "def process(data, context):\n    return data",
  "connection_mappings": { "llm": "<connection-id>" },
  "test_input": {
    "values": [{ "recordId": "1", "data": {} }]
  }
}
```

**Response** — same format as `/skills/{id}/test`
