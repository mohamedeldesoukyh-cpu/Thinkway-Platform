# Demo Readiness — Sprint 1

**Date:** 2026-07-26  
**Scope:** Client-facing workflows on Thinkway Platform (Production + Development)  
**Constraint:** No major new features — quality, consistency, stability, UX polish

---

## Overall status

| Area | Status |
|---|---|
| Authentication / login | **PASS** |
| Discovery Search | **PASS** |
| Creator Profile (in-app sheet) | **PASS** (UI only — no document export) |
| Campaign Match | **PASS** (workspace UI) |
| Shortlists Preview / Export | **PASS** |
| Client Quotation Preview / Export | **PASS** |
| Campaign Studio / Outputs Center | **PARTIAL** |
| Media Plan Preview / Export | **PASS** (Word N/A) |
| AI Copilot | **PASS** |
| Invoice / Client IO / Vendor IO | **PASS** |
| Campaign Performance Report | **PASS** |
| PWA / branding | **PASS** |
| Production framing / CSP | **PASS** (after Sprint 1 deploy) |
| **Platform demo readiness** | **PARTIAL → ready for guided demos** |

---

## Checklist

### Authentication
- [x] Login / session against Production Supabase
- [x] Environment banner (Development / Production)
- [x] Role-gated navigation

### Discovery
- [x] Creator Search infinite scroll / count (pool-cap pagination fixed)
- [x] Creator Profile sheet open from search / match / shortlists
- [x] Campaign Match workspace
- [x] Shortlist preview via `srcDoc` (no iframe DENY)
- [x] Shortlist HTML / PDF / Word / Excel / CSV / PPTX (deck templates)
- [x] Pitch template label on preview page

### Campaign Intelligence
- [x] Brief upload / Campaign Intelligence Profile path into Studio
- [x] Scores refresh after Copilot fact edits

### Campaign Studio
- [x] Outputs Center Open / Preview for generated kinds
- [x] Media Plan iframe `srcDoc` preview + section chrome
- [x] Publishing Calendar / Creator Mix / Platform Intelligence / Weekly Objectives / Operations / Production Schedule (Media Plan sections)
- [x] Creative / Influencer Concepts (Media Plan + modal)
- [x] Studio Proposal HTML / PDF / PPTX (chrome actions)
- [ ] Standalone Word export for Media Plan — **not built**
- [ ] File PDF/Office export for non–Media Plan outputs — **markdown chat export only**
- [ ] Catalog “Soon” kinds (SOW, client presentation, reverse brief, etc.) — **hidden / disabled**

### AI Copilot
- [x] Friendly rate-limit messaging (edge limiter)
- [x] Timeline start date dual-store + Monday Week-1 explanation
- [x] Regenerate / send guards against duplicate in-flight turns
- [x] Debug console noise gated off in Production

### Quotation
- [x] Preview `srcDoc` (fixes Production “refused to connect”)
- [x] Word / PDF / Excel / PPTX downloads
- [x] Filenames from serial + template suffix
- [x] Inline HTML framing carve-out only (not file downloads)

### Invoice / Finance documents
- [x] Invoice preview `srcDoc` + HTML/PDF
- [x] Client IO / Vendor IO preview + PDF
- [x] Campaign Performance preview + PDF/Excel/PPTX

### Exports (cross-cutting)
- [x] MIME types for Quotation / Shortlist / Media Plan / Invoice routes
- [x] Attachment `Content-Disposition` on downloads
- [x] Blob downloads for Influencer Concept JSON/HTML (same-origin)
- [x] Platform CSP: `frame-ancestors 'none'` + `X-Frame-Options: DENY` by default
- [x] Preview HTML responses may set `SAMEORIGIN` / `frame-ancestors 'self'` only

### PWA
- [x] Manifest / icons / Thinkway favicon on Production
- [x] Install / update prompts (browser-dependent)

### Production
- [x] Dual env model documented (`docs/RELEASE_WORKFLOW.md`)
- [x] Production Git deploy opt-in via `[deploy-production]` or CLI
- [x] Sprint 1 preview fixes included in demo readiness commit

---

## Sprint 1 fixes landed

1. **Quotation & Shortlist preview** — server-render HTML into `iframe srcDoc` (invoice pattern), eliminating Production framing blocks.
2. **Security headers** — global DENY retained; `SAMEORIGIN` only on inline HTML preview responses from export APIs.
3. **Shortlist preview toolbar** — Word + CSV aligned with workspace exports; pitch label fixed.
4. **Copilot / Studio debug logging** — silenced in Production unless explicit debug flags.
5. **Prior hardening retained** — Discovery pagination, Copilot rate-limit UX, Media Plan requested vs scheduled start dates.

---

## Known limitations

| Limitation | Impact on demo | Workaround |
|---|---|---|
| Media Plan has no Word (.docx) export | Low if PDF/PPTX used | Export PDF or PPTX |
| Non–Media Plan Studio outputs export as chat markdown, not Office files | Medium if client asks for “export strategy PDF” | Open Preview; copy; or regenerate Media Plan / Proposal deck |
| Catalog “Soon” output cards | Low | Do not click; stick to generated Media Plan + Proposal |
| Creator Profile / Campaign Match have no printable PDF package | Low | Use Shortlist or Quotation decks |
| PDF generation needs Chromium on the host | Medium if PDF returns 503 | Fall back to HTML download; check worker/runtime |
| Media Plan Week 1 snaps mid-week starts to Monday | Informational | Copilot + calendar explain requested vs scheduled |
| Production auto-deploy from `main` is skipped unless override | Ops | Use `vercel deploy --prod` or `[deploy-production]` |

---

## Future improvements

1. Word/DOCX builders for Media Plan and Quotation (true OOXML, not HTML-as-.doc).
2. File export pipeline for Full Strategy / Executive Proposal registry kinds.
3. Wire or hide Share / History actions on output cards.
4. Creator Profile / Campaign Match one-pager PDF.
5. Shared `srcDoc` preview shell component for all document modules.
6. Automated Playwright smoke: login → quotation preview → shortlist PPTX → media plan PDF.

---

## Demo script (recommended path)

1. Login on **Production** (`app.thinkwaymedia.com`).
2. Discovery Search → open a creator → add to Shortlist.
3. Shortlist Preview → switch Pitch/Showcase → download PDF or PPTX.
4. Create / open Quotation → Preview → download PDF + Excel.
5. Campaign Studio → regenerate **Media Plan** → Preview Publishing Calendar → Export PDF/PPTX.
6. Copilot: set start date mid-week → show Monday Week-1 explanation.
7. Open Invoice or Client IO preview if finance is in scope.
8. Optional: Install PWA from browser menu.

---

## Score

**Demo readiness score: 86 / 100**

Ready for a **guided client demo** that follows the script above. Not ready to claim “every Studio output exports to Word/PDF/PPTX” without caveats.
