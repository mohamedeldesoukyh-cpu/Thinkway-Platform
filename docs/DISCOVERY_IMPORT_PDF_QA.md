# Discovery Import — PDF QA

Verification guide for PDF uploads in **Discovery → Import Center** after the `pdf-parse` v2 fix.

## Background

Discovery Import PDFs are processed by:

1. Upload → Supabase Storage (`creator-imports`)
2. BullMQ `creator-import` queue
3. `services/discovery-worker` → `creator-import.worker.ts`
4. `lib/discovery-import/process.ts` → `parseImportFile()` → `parsePdfBuffer()`
5. Text extraction via `lib/discovery-import/parsers/pdf-text.ts` (`PDFParse` class from `pdf-parse` v2)
6. Creator rows parsed with one of two strategies (see below)

### Root cause #2 — zero creators from the real indaHash export (fixed)

After the `pdf-parse` v2 fix, uploads completed but extracted **0 creators**. Root
cause was **Case B (parser mismatch, not OCR)**: text extracts cleanly, but the
real indaHash web **"Creator Search"** PDF uses a completely different layout than
the synthetic `@handle Platform followers ER% ...` fixture the parser was built on.

Evidence from the real file (`Creator 1.pdf`):

- `extractPdfText` → **3,246 chars** (not empty → no OCR needed)
- `isIndahashText` → `true`
- `parseIndahashText` (old) → **0 rows**

The real layout flattens a multi-column table into a token stream, handles have
**no leading `@`**, there is **no per-row platform/country**, and numeric fields
(ER%, relevance `100`, rank, follower counts) appear in **inconsistent order**,
interleaved with Title-Case audience-interest phrases:

```
Clothes, Shoes, Handbags & Accessories
wafasyedofficial Type to search	Camera & Photography
0.68% 100	1
1.2M 4.6M 9.6M Restaurants, Food & Grocery
```

**Fix:** added `parseIndahashSearchExport()` which anchors on lowercase handle
tokens and recovers ER%, relevance, and follower counts from the tokens following
each handle. Platform defaults to `instagram` (this export is IG-only); country is
read once from the `Country : <X>` filter header. `parsePdfBuffer()` now tries the
structured `@handle` parser first, then falls back to the search-export parser.

Result for `Creator 1.pdf`: **20 / 20 creators** extracted (parser
`indahash-pdf-search`).

### Diagnostics columns

`creator_import_files` now records, per upload:

- `extracted_text_length` — chars returned by text extraction
- `parser_strategy` — `indahash-pdf` | `indahash-pdf-search` | `pdf-empty-text` | `pdf-unrecognized` | …
- `extraction_method` — `text` | `ocr`
- `warning_message` — human-readable reason for 0 creators (e.g. likely scanned/image PDF → OCR)

These make a future zero-creator import diagnosable from the row alone. When
`extracted_text_length < 100`, the file is flagged `pdf-empty-text` with an OCR
hint (Case A); OCR is **not** currently implemented because the real file is Case B.

### Root cause #1 (fixed) — pdf-parse v2 API

`pdf-parse` **v2** no longer exposes a default export function. The old pattern:

```ts
const pdfParse = (await import("pdf-parse")).default;
await pdfParse(buffer); // TypeError: pdfParse is not a function
```

The correct v2 API:

```ts
import { PDFParse } from "pdf-parse";

const parser = new PDFParse({ data: buffer });
const { text } = await parser.getText({ pageJoiner: "" });
await parser.destroy();
```

## Automated regression tests

```bash
npm run test:discovery-import-indahash
npm run test:discovery-import-pdf
```

PDF tests cover:

| Case | Expectation |
|------|-------------|
| Small indaHash PDF (`@handle` layout) | `indahash-pdf` parser, creators extracted |
| indaHash web "Creator Search" export (scattered layout, no `@`) | `indahash-pdf-search` parser, creators extracted |
| Multi-page PDF | Creators aggregated across pages |
| Empty / near-empty PDF | `pdf-empty-text`, 0 creators, OCR warning |
| Malformed PDF | `extractPdfText` throws invalid PDF error |

On Windows, if `npm` TLS errors occur:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npm run test:discovery-import-pdf
```

## Manual worker QA

### Prerequisites

- Redis running (BullMQ)
- `services/discovery-worker` env configured (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`)
- Discovery Import migrations applied (`creator_import_files`, storage bucket `creator-imports`)

### Start worker

```bash
cd services/discovery-worker
npm run dev
```

### Upload a PDF

1. Open **Discovery → Import**
2. Upload an indaHash-style PDF export (or a PDF generated from the indaHash text fixture)
3. Confirm UI status: **Queued** → **Processing** → **Completed**

### Expected worker logs

```
[creator-import] extracted text length 3246
[creator-import] extracted creators=20 (search-export)
[creator-import] completed <job-id> { importFileId, parser: 'indahash-pdf-search', duration_ms: ... }
```

For unrecognized PDFs (text present, no layout matched):

```
[creator-import] extracted text length 1840
[creator-import] extracted creators=0
[creator-import] first 3000 chars <sample text for debugging>
```

For empty / image-only PDFs (Case A — OCR candidate):

```
[creator-import] extracted text length 2
[creator-import] first 3000 chars
```

Processing log in `creator_import_files.processing_log` should include:

- `Parser indahash-pdf extracted N creator row(s)` (or `pdf-unrecognized` for empty/unrecognized content)
- Upsert counters and enrichment queue count

### Failure checks

| Symptom | Likely cause |
|---------|----------------|
| `pdfParse is not a function` / `Parse is not a function` | Old parser code still deployed; redeploy worker with `pdf-text.ts` fix |
| `Invalid PDF structure` | Corrupt/truncated upload; re-export from source |
| `extracted creators=0` + `parser_strategy='pdf-empty-text'` | PDF is image-only (no text layer); re-export with selectable text or add OCR |
| `extracted creators=0` + `parser_strategy='pdf-unrecognized'` | Text extracted but layout unknown; inspect `warning_message` + sample log, extend a parser |
| Stuck on **Processing** | Worker not running or Redis disconnected |

## Fixture reference

Structured `@handle` indaHash sample (also used by PDF tests):

`lib/discovery-import/fixtures/indahash-nano-sample.txt`

```
@username Platform followers ER% country categories relevance
```

Real-world indaHash web "Creator Search" export sample (scattered layout):

`lib/discovery-import/fixtures/indahash-search-export-sample.txt`

```
<audience interest phrases>
<handle> <audience interest phrases>
<ER%> 100 <rank>        (ER% / 100 / rank order varies per row)
<followers> <reach> ... <audience interest phrases>
```

## Files touched

PDF v2 fix:

- `lib/discovery-import/parsers/pdf-text.ts` — v2 `PDFParse` wrapper

Zero-creator (search-export) fix:

- `lib/discovery-import/parsers/indahash.ts` — `parseIndahashSearchExport()`
- `lib/discovery-import/parsers/index.ts` — two-strategy `parsePdfBuffer()` + diagnostics + logs
- `lib/discovery-import/types.ts` — `ImportParseDiagnostics`
- `lib/discovery-import/process.ts` — persists diagnostics columns
- `lib/discovery-import/fixtures/indahash-search-export-sample.txt` — fixture
- `lib/discovery-import/parsers/{indahash,pdf}.test.ts` — regression tests
- `supabase/migrations/20260625170000_discovery_import_diagnostics.sql` — diagnostics columns
- `types/database.ts` — `creator_import_files` diagnostics columns
