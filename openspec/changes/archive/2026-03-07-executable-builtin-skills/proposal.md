# Change Proposal: Executable Built-in Skills

## Summary

Make all 16 built-in skills (15 existing + GenAIPrompt) fully executable by aligning with Azure AI Search's skill architecture. Each built-in skill gets hidden Python implementation code, declares its required Azure resource type, auto-binds to user-configured Connections, and becomes testable on-page with sample text or file upload. This enables built-in skills to work in Pipeline execution alongside custom python_code skills.

## Motivation

Current built-in skills are "empty shells" - they have config_schema definitions but no execution logic, no resource binding, and no test capability. Azure AI Search's built-in skills are fully functional: configure parameters, bind an Azure resource, and execute. We need parity to deliver a usable RAG pipeline orchestrator.

## Scope

### In Scope

1. **Connection model changes** - Add `is_default` boolean for auto-selection
2. **Skill model changes** - Add `required_resource_types` (JSON), `bound_connection_id` (FK), `config_values` (JSON for user's parameter choices)
3. **Built-in skill definitions** - Add `required_resource_types` for all 16 skills; categorize into 3 resource groups
4. **Built-in skill executor** - New `BuiltinSkillRunner` service with Python implementations calling Azure APIs
5. **New skill: GenAIPrompt** - LLM-powered enrichment skill using Azure OpenAI chat completion
6. **API expansion** - Extend `/skills/{id}/test` for builtin type; add file upload endpoint; add builtin config update endpoint
7. **Frontend: BuiltinSkillEditor** - New page for configuring and testing built-in skills (resource binding + config form + test panel)
8. **Frontend: Connection default toggle** - Mark one connection per type as default

### Out of Scope

- Local model deployment (future)
- Pipeline execution engine integration (Phase 2, separate change)
- Azure Vision multimodal embeddings skill (future)
- Azure Content Understanding skill as standalone (already covered by DocumentCracker)

## Key Decisions

### Resource Categorization (aligned with Azure AI Search)

| Resource Group | Connection Type | Skills |
|---------------|----------------|--------|
| **Foundry (AI Language/Vision/Translator)** | `azure_ai_foundry` | LanguageDetector, EntityRecognizer, EntityLinker, KeyPhraseExtractor, SentimentAnalyzer, PIIDetector, TextTranslator, OCR, ImageAnalyzer |
| **Azure OpenAI** | `azure_openai` | TextEmbedder, GenAIPrompt |
| **Document Processing** | `azure_content_understanding` (default) or `azure_doc_intelligence` | DocumentCracker |
| **Local (no resource)** | none | TextSplitter, TextMerger, Shaper, Conditional |

### Connection Auto-Binding

- Each connection type has at most ONE `is_default=true` connection
- When a user opens a built-in skill that requires a resource, the system auto-selects the default connection of that type
- User can override to any other connection of the same type
- Setting a new default automatically clears the old default of the same type

### Built-in Skill Update Rules (relaxed from current)

- Built-in skill `config_values` and `bound_connection_id` ARE updatable by users (these are runtime configuration, not skill definition)
- Built-in skill definition fields (name, description, skill_type, config_schema, source code) remain read-only
- `is_builtin` skills now have a "Configure" action instead of being fully locked

### Test with File Upload

- New `POST /api/v1/skills/upload-test-file` endpoint accepts multipart file upload
- Returns a temporary file path/URL that can be referenced in test_input JSON
- Temp files auto-cleaned after 1 hour
- Relevant for DocumentCracker, OCR, ImageAnalyzer

## Risks

| Risk | Mitigation |
|------|-----------|
| Azure API compatibility across regions | Use stable API versions; document supported regions |
| SDK dependency bloat | Azure AI SDKs already in venv (azure-ai-textanalytics, azure-ai-vision, azure-ai-translation) |
| Built-in skill code maintenance | Implementations are simple SDK wrappers; config_schema documents all params |
| Breaking change to Skill model | Alembic migration; new columns are nullable; existing data unaffected |
