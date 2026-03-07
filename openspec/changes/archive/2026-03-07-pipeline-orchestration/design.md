## Context

The platform has 16 working built-in skills and custom Python skills, each individually testable. Pipeline CRUD (list/create/get/update/delete) is implemented with an empty `graph_data: {nodes: [], edges: []}` field. The frontend has placeholder pages (`Pipelines.tsx` shows an empty table, `PipelineEditor.tsx` shows a stub div). `@xyflow/react` is installed but unused.

The user wants Azure AI Search-style pipeline orchestration: an ordered skill list (not a visual DAG canvas), shared Enrichment Tree context, file upload debugging, and per-node input/output inspection.

All 16 skills share a uniform interface: `execute(data: dict, config: dict, client: Any | None) → dict`. Most skills take `text` (str) as primary input. DocumentCracker/OCR/ImageAnalyzer take `file_content` (bytes). TextSplitter outputs a `chunks` array (fan-out point).

## Goals / Non-Goals

**Goals:**
- Implement Enrichment Tree as the shared data context for pipeline execution
- Build PipelineRunner that chains skills via tree path references
- Support fan-out via `context` (e.g., `/document/chunks/*` runs skill per chunk)
- Azure AI Search Debug Session-style UI (3-column: skill list, data tree, node detail)
- Pipeline editor with sortable skill node list and smart path dropdowns
- Pipeline templates for common patterns
- Wire Pipelines list page to real API

**Non-Goals:**
- Visual DAG canvas with edge dragging (Azure uses ordered lists, not visual graphs)
- Async/streaming execution with WebSocket progress (v1 is synchronous)
- Pipeline scheduling or production batch execution
- Multi-document pipeline runs (v1 debugs one file at a time)
- Parallel node execution (v1 is strictly sequential)
- Index/target integration (writing results to Azure AI Search or databases)

## Decisions

### Decision 1: Enrichment Tree as shared context (over direct skill-to-skill data passing)

**Choice**: Path-addressable tree structure where every skill reads from and writes to named paths.

**Alternatives considered**:
- *Direct passing* (output of node A becomes input of node B): Simple but doesn't support fan-out or multiple consumers reading the same data.
- *Message queue*: Overkill for synchronous single-document debugging.

**Rationale**: The Enrichment Tree naturally models Azure AI Search's enrichment model. A single TextSplitter output at `/document/chunks` can be consumed by multiple downstream skills. Fan-out is expressed declaratively via `context: "/document/chunks/*"` rather than requiring explicit loop logic.

**Implementation**: `EnrichmentTree` class in `backend/app/services/pipeline/enrichment_tree.py`:
- Internal storage: nested Python dict/list
- `get(path: str) → Any` — resolve `/document/chunks/0/text` to a value
- `set(path: str, value: Any)` — create intermediate dicts/lists as needed
- `expand_context(context_path: str) → list[str]` — `/document/chunks/*` → `["/document/chunks/0", "/document/chunks/1", ...]`
- `resolve_source(source: str, context_path: str, instance_path: str) → str` — replace `*` with instance index
- `to_dict(exclude_binary: bool) → dict` — for API response, replacing bytes with placeholder strings

### Decision 2: Ordered list with source path references (over visual DAG canvas)

**Choice**: Pipeline nodes are defined as an ordered list. Each node declares `inputs` (source paths from the tree) and `outputs` (target names written to the tree). Execution order = list order.

**Alternatives considered**:
- *React Flow visual canvas*: More visually appealing but significantly more complex (port typing, edge validation, drag handling). Azure AI Search itself uses ordered skill definitions, not visual graphs.
- *Hybrid (list edit + auto-generated graph)*: Could add a read-only flow diagram later, but the list editor is the primary editing interface.

**Rationale**: Matches the Azure AI Search reference UX. Dramatically simpler to implement (3-4 days vs ~2 weeks for canvas). Source path dropdowns provide better discoverability than drag-connecting ports.

**Pipeline node schema** (stored in `Pipeline.graph_data.nodes`):
```json
{
  "id": "node_abc123",
  "skill_id": "uuid-of-skill",
  "label": "User-visible name",
  "position": 0,
  "context": "/document",
  "inputs": [
    {"name": "text", "source": "/document/content"}
  ],
  "outputs": [
    {"name": "chunks", "targetName": "chunks"},
    {"name": "totalChunks", "targetName": "totalChunks"}
  ],
  "config_overrides": {},
  "bound_connection_id": null
}
```

### Decision 3: Context-based fan-out (over explicit loop nodes)

**Choice**: When a node's `context` contains `/*` (e.g., `/document/chunks/*`), the runner automatically iterates over the array and executes the skill once per element.

**Alternatives considered**:
- *Explicit ForEach node*: Requires users to add loop constructs manually.
- *Skill-level batching*: Each skill handles its own iteration internally.

**Rationale**: Declarative and matches Azure. The runner handles the loop, so skill implementations remain simple (process one record at a time). Source paths with `*` are resolved per-instance: `/document/chunks/*/text` at instance index 2 → `/document/chunks/2/text`.

**Path resolution rules**:
1. If source contains `*` and context contains `*`: replace `*` in source with the current instance index
2. If source has no `*`: resolve from root (allows reading global data in a fan-out context)
3. Output `targetName` is relative to the context instance path

### Decision 4: Pipeline I/O defaults per skill (over user-configured-from-scratch)

**Choice**: Each built-in skill declares default `pipeline_io` — recommended `context`, `inputs`, and `outputs`. When adding a skill to a pipeline, these defaults are pre-filled. Users can customize.

**Implementation**: New `pipeline_io` JSON field on the Skill model, seeded via `BUILTIN_SKILLS`. Also stored in a separate `PIPELINE_DEFAULTS` dict in `backend/app/data/pipeline_defaults.py` for reference.

**Default I/O declarations for all 16 skills**:

| Skill | default_context | inputs | outputs (name→targetName) |
|-------|----------------|--------|--------------------------|
| DocumentCracker | /document | file_content←/document/file_content, file_name←/document/file_name | content→content, markdown→markdown, text→text, tables→tables, figures→figures, pages→pages, metadata→metadata |
| TextSplitter | /document | text←/document/content | chunks→chunks, totalChunks→totalChunks |
| TextMerger | /document | texts←/document/chunks | text→mergedText, sourceCount→mergeSourceCount |
| LanguageDetector | /document | text←/document/content | languageCode→language, languageName→languageName, confidence→languageConfidence |
| EntityRecognizer | /document | text←/document/content | entities→entities |
| EntityLinker | /document | text←/document/content | entities→linkedEntities |
| KeyPhraseExtractor | /document | text←/document/content | keyPhrases→keyPhrases |
| SentimentAnalyzer | /document | text←/document/content | sentiment→sentiment, confidenceScores→sentimentScores |
| PIIDetector | /document | text←/document/content | entities→piiEntities, redactedText→redactedText |
| TextTranslator | /document | text←/document/content | translatedText→translatedText, sourceLanguage→sourceLanguage |
| OCR | /document | file_content←/document/file_content, file_name←/document/file_name | text→ocrText, pages→ocrPages |
| ImageAnalyzer | /document | file_content←/document/file_content, file_name←/document/file_name | description→imageDescription, tags→imageTags, objects→imageObjects |
| TextEmbedder | /document | text←/document/content | embedding→embedding, model→embeddingModel |
| GenAIPrompt | /document | text←/document/content | output→aiOutput, model→aiModel |
| Shaper | /document | (dynamic) | (dynamic) |
| Conditional | /document | (dynamic) | matches→conditionResult |

**Smart context detection**: When TextEmbedder is added after TextSplitter, the UI detects that `/document/chunks` exists in preceding outputs and suggests changing context to `/document/chunks/*` and input source to `/document/chunks/*/text`.

### Decision 5: Synchronous debug execution with timeout (over async/streaming)

**Choice**: `POST /pipelines/{id}/debug` is synchronous — upload file, execute all nodes, return full results in one response.

**Alternatives considered**:
- *WebSocket streaming*: Real-time progress per node. More complex; deferred to future.
- *Polling model*: Start async job, poll for results. Adds complexity without strong benefit for debug use case.

**Rationale**: For debugging a single document through 3-5 skills, total execution is typically under 30 seconds. A synchronous response with loading spinner is adequate for v1. The timeout is configurable (default 120s from `settings.sync_execution_timeout_s`).

### Decision 6: Connection resolution priority

Per-node connections are resolved in this order:
1. **Node-level** `bound_connection_id` (from `graph_data.nodes[i].bound_connection_id`)
2. **Skill-level** `bound_connection_id` (from `Skill.bound_connection_id`)
3. **Default connection** for the first `required_resource_type` (from `Connection.is_default`)
4. **Error** if none found and skill requires a connection

This allows users to override connections per-node while inheriting sensible defaults.

### Decision 7: Available paths computation (frontend)

The source path dropdown for each node shows paths available from:
1. **Initial paths**: `/document/file_content`, `/document/file_name`
2. **Preceding nodes' outputs**: computed by walking nodes in order, each adding its output paths

When a node has context with `/*`, its outputs generate wildcard paths. For example, TextEmbedder at context `/document/chunks/*` with output `embedding→embedding` adds the available path `/document/chunks/*/embedding`.

This computation is performed client-side in the frontend, recalculated whenever nodes are reordered or modified.

### Decision 8: Debug response format

```json
{
  "status": "success" | "partial" | "error",
  "total_execution_time_ms": 3200,
  "enrichment_tree": {
    "document": {
      "file_name": "report.pdf",
      "file_content": "(binary, 2.3 MB)",
      "content": "...",
      "chunks": [
        {"index": 0, "text": "...", "embedding": [0.01, -0.03, "...(1536 dims)"]},
        {"index": 1, "text": "...", "embedding": [0.05, 0.02, "...(1536 dims)"]}
      ]
    }
  },
  "node_results": [
    {
      "node_id": "node_1",
      "skill_name": "DocumentCracker",
      "status": "success",
      "execution_time_ms": 2500,
      "records_processed": 1,
      "input_snapshots": [{"file_name": "report.pdf", "file_content": "(binary)"}],
      "output_snapshots": [{"content": "...", "markdown": "..."}],
      "errors": [],
      "warnings": []
    }
  ]
}
```

Binary fields (`file_content`) are replaced with `"(binary, X MB)"` in the response. Large arrays (embeddings) are truncated to first 5 elements + dimension count.

## Risks / Trade-offs

**[Risk] Fan-out can cause many API calls** → TextSplitter producing 100 chunks × TextEmbedder = 100 OpenAI API calls. Mitigation: v1 executes sequentially with a global timeout (120s). Future: batch API calls, parallel execution, progress streaming.

**[Risk] Large enrichment tree response** → 50 chunks with 1536-dim embeddings ≈ 600KB of floats. Mitigation: Truncate embeddings in response (show first 5 values), exclude binary fields. Full data available during execution.

**[Risk] Node failure halts pipeline** → If TextSplitter fails, TextEmbedder can't run. Mitigation: v1 stops on first error and returns partial results. The frontend shows completed nodes (green), failed node (red), and skipped nodes (gray).

**[Risk] Path typos cause silent failures** → User types `/document/conent` instead of `/document/content`. Mitigation: Frontend source path dropdown only shows available paths computed from preceding nodes. Manual typing is allowed but validated against available paths with a warning.

**[Risk] DB migration for pipeline_io field** → Adding a JSON column to the Skill table. Mitigation: Follow established migration pattern — update Alembic init migration, delete local DB, re-run migration. No data loss (built-in skills are re-seeded).

**[Trade-off] Synchronous execution limits scale** → Can't process very large documents or pipelines with many fan-out skills. Accepted for v1 debug use case. Future versions can add async execution with progress reporting.

**[Trade-off] No visual DAG** → Less visually impressive than a React Flow canvas. Accepted because it matches the Azure reference UX, is much faster to build, and provides better discoverability through dropdown suggestions.

## Open Questions

- Should custom `python_code` skills be usable in pipelines? They'd need user-defined pipeline_io mappings. Deferred to a follow-up change.
- Should pipeline validation be a separate button/API (as in the existing spec) or automatically triggered on save? Start with manual "Validate" button.
