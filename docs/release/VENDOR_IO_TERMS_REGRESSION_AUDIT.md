# Vendor IO Terms — Pre-Deploy Regression Audit

**Date:** 2026-07-27  
**Feature:** Vendor IO Terms Hierarchy (Platform → Vendor → IO Override)  
**Automated suite:** `npx tsx lib/io/vendor-io-terms-regression.test.ts` · `npx tsx lib/io/vendor-io-terms.test.ts`

## Official supported export formats (today)

| Format | Supported? | Surface |
|---|---|---|
| HTML | Yes | `/api/vendor-ios/[id]/document?format=html` · UI “HTML” |
| PDF | Yes | `/api/vendor-ios/[id]/document?format=pdf` · UI “PDF” |
| Word | **No** | Not in UI; API returns `400 Unsupported format` for other values |

**Evidence**

- UI: `features/io/components/vendor-io-document-actions.tsx` — View / HTML / PDF only  
- API: `app/api/vendor-ios/[id]/document/route.ts` — accepts `html` \| `pdf` only  
- Lifecycle docs: `docs/VENDOR_IO_INVOICE_LIFECYCLE.md` Phase **2b** = branded PDF (no Word)  
- Product reference: no Vendor IO Word export requirement  
- Git history: no prior `format=word` / `msword` implementation under Vendor IO routes

Word for Vendor IO is a **future enhancement** — see [docs/backlog/VENDOR_IO_WORD_EXPORT.md](../backlog/VENDOR_IO_WORD_EXPORT.md). It does **not** block this deployment.

## Scenario results

| # | Scenario | Result | Notes |
|---|---|---|---|
| 1 | New vendor, no Vendor Default → Platform Default | **PASS** | `null`/`null` → `VENDOR_IO_DEFAULT_TERMS`; matches template §8 |
| 2 | Vendor Default → new VIO uses Vendor Default | **PASS** | Create seeds `vendor_ios.terms_text` from vendor defaults |
| 3 | IO Override → document uses override only | **PASS** | IO layer wins over vendor |
| 4 | Change Vendor Default; existing frozen; new uses updated | **PASS** | Snapshot-on-create freeze |
| 5 | Restore Platform Default on vendor → new IO → Platform | **PASS** | Cleared vendor terms → platform |
| 6 | Legacy Vendor IO still generates | **PASS** | Unparseable prose → platform §8 |
| 7 | Export terms identical across **supported** formats | **PASS (supported formats)** | HTML + PDF share live `renderLiveVendorIoHtml` / same §8 list. Word = backlog (not in scope) |
| 8 | Users without edit permission cannot modify Vendor Default | **PASS** | RLS `influencers_update` requires `influencers.write`. Soft UX gap: editor not disabled client-side |

## Deployment recommendation

### **GO**

See [VENDOR_IO_TERMS_PRODUCTION_READINESS.md](./VENDOR_IO_TERMS_PRODUCTION_READINESS.md) for migration application, RLS hardening, and verification results.

Non-blocking follow-ups:

- Vendor IO Word Export — [backlog](../backlog/VENDOR_IO_WORD_EXPORT.md)
- Optional UX: disable Vendor Default Terms editor without `influencers.write`
