## Why

The DocumentCracker built-in skill works but uses a simple config+test panel. Users analyzing documents need a richer experience matching Azure Document Intelligence Studio: a 3-column layout with document preview, file thumbnails, and tabbed rich content output (Markdown, Text, Tables, Figures, Selection marks). The backend also returns only plain text, missing the rich structured data that the `prebuilt-layout` model provides.

## What Changes

- **Backend: Rich analyze response** — Switch from `prebuilt-read` to `prebuilt-layout` model with `outputContentFormat=markdown`. Return structured fields: `markdown`, `text`, `tables` (HTML), `figures`, `selectionMarks`, `pages`, `metadata`.
- **Backend: File preview endpoint** — Add `GET /skills/test-file/{file_id}` to serve uploaded files for iframe/img preview. Uses RFC 5987 encoding for non-ASCII filenames.
- **Frontend: 3-column Document Intelligence Studio layout** — Left: file upload with drag-and-drop + thumbnails (image/PDF/icon). Middle: document preview (PDF iframe / image). Right: tabbed output panel with Content (Markdown/Text/Tables/Figures/Selection marks) and Result JSON tabs.
- **Frontend: Markdown rendering** — Add `react-markdown` + `rehype-raw` for proper rendering of HTML tables and figures embedded in markdown output.
- **Non-DocumentCracker skills** keep the existing 2-panel layout unchanged.

## Capabilities

### New Capabilities

_(none — this enhances an existing capability)_

### Modified Capabilities

- `executable-builtin-skills`: DocumentCracker returns rich structured data instead of plain text; BuiltinSkillEditor gains a 3-column DI Studio layout for file-based skills; new file preview endpoint added.

## Impact

- **Backend**: `doc_skills.py` (rich response), `skills.py` (new endpoint + route ordering)
- **Frontend**: `BuiltinSkillEditor.tsx` (major UI redesign), `api.ts` (new method), `package.json` (new deps)
- **Dependencies**: `react-markdown`, `rehype-raw` added to frontend
- **i18n**: RFC 5987 encoding required for non-ASCII filenames in HTTP headers
