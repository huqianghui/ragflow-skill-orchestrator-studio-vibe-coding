## 1. Backend: Rich Document Intelligence Response

- [x] 1.1 Switch `_crack_with_doc_intelligence` to `prebuilt-layout` model with `outputContentFormat=markdown`
- [x] 1.2 Parse and return structured fields: markdown, text, tables (HTML), figures, selectionMarks, pages, metadata

## 2. Backend: File Preview Endpoint

- [x] 2.1 Add `GET /skills/test-file/{file_id}` endpoint with RFC 5987 filename encoding
- [x] 2.2 Place route before `/{skill_id}` to avoid FastAPI path parameter collision

## 3. Frontend: Dependencies

- [x] 3.1 Install `react-markdown` for markdown rendering
- [x] 3.2 Install `rehype-raw` for HTML-in-markdown support

## 4. Frontend: 3-Column Document Intelligence Studio Layout

- [x] 4.1 Left column: file upload drop zone with drag-and-drop support
- [x] 4.2 Left column: file thumbnails (img for images, scaled iframe for PDFs, icon for others)
- [x] 4.3 Middle column: document preview (PDF iframe, image display, fallback icon)
- [x] 4.4 Right column: tabbed output panel (Content + Result JSON)
- [x] 4.5 Content sub-tabs: Markdown (react-markdown + rehype-raw + table CSS), Text (line numbers), Tables, Figures, Selection marks
- [x] 4.6 Collapsible config panel via gear button

## 5. Frontend: API Integration

- [x] 5.1 Add `getTestFileUrl(fileId)` method to skillsApi
- [x] 5.2 Store `uploadedContentType` for file type detection

## 6. Documentation and Specs

- [x] 6.1 Update `docs/api-reference.md` with test-file endpoint
- [x] 6.2 Update `openspec/specs/executable-builtin-skills/spec.md` with DI Studio layout and rich response specs

## 7. Verification

- [x] 7.1 ruff check + ruff format pass
- [x] 7.2 npx tsc -b + npm run build pass
- [x] 7.3 pytest 81/81 tests pass
- [x] 7.4 GitHub Actions CI passes
