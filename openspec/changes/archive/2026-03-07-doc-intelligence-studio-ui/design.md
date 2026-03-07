## Context

The DocumentCracker skill had a basic 2-column config+test layout. Azure Document Intelligence Studio uses a 3-column layout with document preview and rich content tabs. The backend used `prebuilt-read` which returns only plain text, while `prebuilt-layout` provides tables, figures, selection marks, and markdown output.

## Goals / Non-Goals

**Goals:**
- Match Azure Document Intelligence Studio's 3-column layout for DocumentCracker
- Return rich structured data (markdown, tables, figures, selection marks) from Document Intelligence API
- Support file preview (PDF iframe, image display) with thumbnails
- Properly render HTML-in-markdown output (tables, figures)
- Support non-ASCII filenames (Chinese, Japanese, etc.) throughout

**Non-Goals:**
- Page-by-page navigation in preview (browser's built-in PDF viewer handles this)
- Bounding box overlay on document preview (future enhancement)
- Changing non-DocumentCracker skill layouts

## Decisions

### 1. Use `prebuilt-layout` instead of `prebuilt-read`
**Choice:** Switch to `prebuilt-layout` model with `outputContentFormat=markdown`.
**Rationale:** `prebuilt-read` returns only text. `prebuilt-layout` extracts tables, figures, selection marks, and produces markdown with embedded HTML tables — matching Azure DI Studio's output.

### 2. File preview via dedicated endpoint
**Choice:** Add `GET /skills/test-file/{file_id}` endpoint serving raw file bytes.
**Alternative considered:** Base64 data URLs in frontend — rejected due to large file sizes and no browser-native PDF rendering.
**Rationale:** Allows `<iframe src={url}>` for PDF and `<img src={url}>` for images. Route placed before `/{skill_id}` to avoid FastAPI path parameter collision.

### 3. RFC 5987 for non-ASCII filenames
**Choice:** Use `filename*=UTF-8''<url-encoded>` in Content-Disposition header.
**Rationale:** HTTP headers are latin-1 encoded. Raw Chinese/CJK characters crash Starlette's Response. This is the standard solution per RFC 5987.

### 4. `react-markdown` + `rehype-raw` for rendering
**Choice:** Use react-markdown with rehype-raw plugin.
**Alternative considered:** Custom HTML parser — rejected as over-engineering.
**Rationale:** Document Intelligence returns markdown with embedded HTML (`<table>`, `<figure>` tags). react-markdown strips raw HTML by default; rehype-raw enables it. Scoped CSS under `.di-markdown-content` prevents style leaks.

### 5. Conditional layout (3-col vs 2-col)
**Choice:** DocumentCracker gets 3-column DI Studio layout; all other built-in skills keep the existing 2-column layout.
**Rationale:** Only DocumentCracker produces rich structured document analysis. Other skills (text processing, language detection) don't benefit from document preview.

## Risks / Trade-offs

- **Bundle size increase** — react-markdown + rehype-raw add ~180KB to the JS bundle → Acceptable for the functionality gained; can code-split later if needed.
- **`dangerouslySetInnerHTML` for tables** — The Tables tab renders backend-generated HTML → The HTML is constructed server-side from Document Intelligence API data, not from user input, so XSS risk is minimal.
- **PDF preview relies on browser** — Browser's built-in PDF viewer varies across browsers → Acceptable for MVP; all modern browsers support PDF in iframe.
