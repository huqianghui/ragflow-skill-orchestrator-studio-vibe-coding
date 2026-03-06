# How to Create a Python Code Skill

## Overview

Python Code Skills let you write custom data processing logic that runs in the platform. Each skill processes individual records following the Azure AI Search custom skill protocol.

## Quick Start

1. Go to **Skill Library** and click **New Python Skill**
2. Write your `process()` function in the code editor
3. Enter sample JSON in the test input panel
4. Click **Run Test** to verify
5. Click **Save** when ready

## The `process()` Function

Every Python skill must define a `process` function:

```python
def process(data: dict, context) -> dict:
    """
    Process a single record.

    Args:
        data: The input record data dict (e.g. {"text": "Hello"})
        context: Runtime context with get_client(), config, logger
    Returns:
        dict with processed results
    """
    return {"result": data["text"].upper()}
```

The framework calls `process()` once per record. You only handle one record at a time — the framework handles the loop and error isolation.

## Test Input Format

Test input follows the Azure AI Search custom skill format:

```json
{
  "values": [
    {
      "recordId": "1",
      "data": {
        "text": "Hello, World!"
      }
    },
    {
      "recordId": "2",
      "data": {
        "text": "Another record"
      }
    }
  ]
}
```

## Preloaded Imports

These packages are available in every skill without importing:

**Standard Library:** `re`, `json`, `math`, `csv`, `io`, `base64`, `hashlib`, `urllib.parse`, `logging`, `datetime`, `typing`, `collections`

**Third Party:** `requests`, `httpx`, `pydantic`, `openai`, `azure.identity`, `azure.ai.documentintelligence`, `azure.ai.contentsafety`, `azure.ai.projects`, `azure.ai.inference`

## Using Connections

Connections store credentials for external services. To use them:

1. Create a Connection in the **Connections** page
2. In the Skill Editor, add a **Connection Mapping** (e.g. name: `llm`, select your connection)
3. Access the client in code via `context.get_client("llm")`

## Examples

### Azure OpenAI Call

Set up a Connection of type `azure_openai`, map it as `llm`:

```python
def process(data: dict, context) -> dict:
    client = context.get_client("llm")  # Returns AzureOpenAI client
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Summarize the text."},
            {"role": "user", "content": data["text"]},
        ],
    )
    return {"summary": response.choices[0].message.content}
```

### OpenAI Call

Set up a Connection of type `openai`, map it as `llm`:

```python
def process(data: dict, context) -> dict:
    client = context.get_client("llm")  # Returns OpenAI client
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": f"Translate to French: {data['text']}"},
        ],
    )
    return {"translation": response.choices[0].message.content}
```

### Azure Document Intelligence

Set up a Connection of type `azure_doc_intelligence`, map it as `doc_intel`:

```python
def process(data: dict, context) -> dict:
    client = context.get_client("doc_intel")  # DocumentIntelligenceClient
    poller = client.begin_analyze_document(
        "prebuilt-layout",
        analyze_request={"url_source": data["document_url"]},
    )
    result = poller.result()
    return {
        "content": result.content,
        "page_count": len(result.pages) if result.pages else 0,
    }
```

### HTTP API Call

Set up a Connection of type `http_api` with `base_url`, map it as `api`:

```python
def process(data: dict, context) -> dict:
    client = context.get_client("api")  # httpx.Client with base_url and headers
    response = client.get(f"/items/{data['item_id']}")
    response.raise_for_status()
    return {"item": response.json()}
```

### Using the Logger

```python
def process(data: dict, context) -> dict:
    context.logger.info(f"Processing record with text length: {len(data['text'])}")

    if len(data["text"]) > 10000:
        context.logger.warning("Very long text, may be slow")

    result = data["text"].upper()
    return {"result": result}
```

Logs appear in the test output panel under the "Logs" section.

## Additional Requirements

If your skill needs pip packages not in the preloaded set, add them in the **Additional Requirements** field (one per line):

```
beautifulsoup4==4.12.0
lxml
pandas>=2.0
```

The platform creates an isolated virtual environment for your skill with these packages installed.

## Error Handling

- If your `process()` function raises an exception, that record fails but other records continue processing
- Errors are captured with message and traceback in the test output
- Use `context.logger.error()` for expected error conditions
- The execution has a timeout (default 60s) — long-running code will be terminated
