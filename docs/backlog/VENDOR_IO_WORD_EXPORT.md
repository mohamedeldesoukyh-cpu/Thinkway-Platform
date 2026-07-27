# Backlog: Vendor IO Word Export

**Status:** Future enhancement — **does not block** current production deployment  
**Priority:** P3 / nice-to-have  
**Created:** 2026-07-27  
**Related:** [Vendor IO Terms regression audit](../release/VENDOR_IO_TERMS_REGRESSION_AUDIT.md)

## Feature

**Vendor IO Word Export** — allow operators to download a Vendor IO as a Word-compatible document, matching the export pattern already used for Quotations and Shortlists.

## Context

Today Vendor IO officially supports **HTML** and **PDF** only (`/api/vendor-ios/[id]/document?format=html|pdf`). Word was never implemented for Vendor IO and is not required by the product specification for the current release.

## Requirements

1. **Same implementation pattern as Quotations and Shortlists**
   - Quotation reference: `app/api/quotations/[id]/export/route.ts` (`format === "word"` → HTML body with `Content-Type: application/msword`, `.doc` filename).
   - Shortlist reference: `app/api/shortlists/[id]/export/route.ts` (same HTML-as-`.doc` approach).

2. **Document format**
   - Prefer HTML-based `.doc` (`application/msword`) for parity and zero new dependencies.
   - Use DOCX only if an existing reusable DOCX helper already exists in the repo; do not introduce a new heavyweight pipeline for this feature alone.

3. **Terms hierarchy preserved**
   - Export must use the same live document render path as HTML (`renderLiveVendorIoHtml` / resolved terms via Platform → Vendor → IO Override).
   - §8 terms in Word must match HTML (and live PDF) for the same Vendor IO id.

4. **UI**
   - Add a **Word** action next to HTML / PDF on `VendorIoDocumentActions` (and any other Vendor IO download surfaces).

5. **Regression tests**
   - API accepts `format=word` and returns `application/msword` (or DOCX if chosen).
   - Terms fragment / titles from resolved hierarchy appear in the Word payload.
   - Unsupported-format behavior remains for unknown formats.

## Out of scope / non-goals

- Blocking or delaying the Vendor IO Terms hierarchy production deploy.
- Rewriting stored PDF/HTML blobs solely for Word.
- Changing terms resolution rules.

## Acceptance criteria

- [ ] `GET /api/vendor-ios/[id]/document?format=word` returns a downloadable Word document.
- [ ] UI exposes Word download for users with `vendor_ios.read`.
- [ ] Terms in Word match HTML for Platform / Vendor Default / IO Override fixtures.
- [ ] Automated regression coverage added and green in CI/local suite.
- [ ] Docs updated (`docs/VENDOR_IO_TERMS.md` supported formats; field map if needed).
