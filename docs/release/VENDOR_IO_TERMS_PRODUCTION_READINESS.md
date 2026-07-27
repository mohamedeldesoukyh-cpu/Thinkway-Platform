# Vendor IO Terms — Production Readiness Report

**Date:** 2026-07-27  
**Production project:** `ienowhwfyxoqtzbgltno` (`thinkway-production`)  
**Feature:** Vendor IO Terms Hierarchy (Platform → Vendor → IO Override)

## 1. Files changed (feature + readiness)

### Schema
- `supabase/migrations/20260726220000_vendor_io_terms.sql`
- `supabase/migrations/20260727001500_drop_legacy_influencer_allow_all_policies.sql`

### Core / documents
- `lib/io/vendor-io-default-terms.ts`
- `lib/io/client-io-terms.ts`
- `lib/io/vendor-io-document-data.ts`
- `lib/io/vendor-io-document-types.ts`
- `lib/io/vendor-io-template-render.ts`
- `lib/io/vendor-io-row-map.ts`
- `lib/io/extract-vendor-io-terms.ts`
- `lib/domains/io/types.ts`
- `types/database.ts`

### App / UI / actions
- `features/vendors/actions.ts` — Overview save + `influencers.write`
- `features/vendors/schemas.ts`
- `features/vendors/components/tabs/vendor-overview-tab.tsx`
- `features/io/actions.ts` — Save as Vendor Default + `influencers.write`
- `features/io/components/vendor-io-form.tsx`
- `features/io/components/vendor-io-detail-sheet.tsx`
- `features/io/components/client-io-terms-editor.tsx`
- `features/io/components/io-terms-source-badge.tsx`
- `features/io/generate-vendor-io-action.ts`
- `features/io/queries.ts`

### Tests / scripts
- `lib/io/vendor-io-terms.test.ts`
- `lib/io/vendor-io-terms-regression.test.ts`
- `lib/io/vendor-io-document-parity.test.ts`
- `scripts/verify-vendor-io-terms-production.mjs`
- `package.json` — `test:vendor-io-terms`, `verify:vendor-io-terms-production`

### Docs
- `docs/VENDOR_IO_TERMS.md`
- `docs/VENDOR_IO_TEMPLATE_FIELD_MAP.md`
- `docs/release/VENDOR_IO_TERMS_REGRESSION_AUDIT.md`
- `docs/release/VENDOR_IO_TERMS_PRODUCTION_READINESS.md` (this file)
- `docs/backlog/VENDOR_IO_WORD_EXPORT.md`
- `RELEASE_NOTES.md`

## 2. Migration status (Production)

| Check | Result |
|---|---|
| `20260726220000_vendor_io_terms.sql` applied | **PASS** — `ALTER TABLE` + `CREATE FUNCTION` via `psql-production` |
| `influencers.vendor_io_terms_text` | **PASS** — `text`, nullable, comment set |
| `upsert_vendor_io_from_assignment` seeds vendor terms | **PASS** |
| `supabase_migrations.schema_migrations` | **N/A** — schema not present on Production; verified by schema inspection |
| `20260727001500_drop_legacy_influencer_allow_all_policies.sql` | **PASS** — legacy Allow authenticated* policies dropped |
| Migration errors | **None** |

Development (`hsxrewjcbvmbkqdlzjhs`) received the same two SQL files for parity.

## 3. Smoke test results (Scenarios 1–5)

Automated resolution smoke (`npm run test:vendor-io-terms` / regression suite):

| Scenario | Expected | Result |
|---|---|---|
| 1 New vendor, no Vendor Default → Platform | Platform Default | **PASS** |
| 2 Add Vendor Default → new VIO uses it | Vendor Default | **PASS** |
| 3 Override on VIO → document uses override | IO Override | **PASS** |
| 4 Change Vendor Default; existing frozen; new inherits updated | Freeze + new default | **PASS** |
| 5 Restore Platform → new VIO uses Platform | Platform Default | **PASS** |

> UI create/generate on Production requires a logged-in operator after app deploy. Schema + resolution + document parity are verified pre-deploy; post-deploy checklist: Overview → create VIO → HTML/PDF §8.

## 4. Regression results

```text
npm run test:vendor-io-terms
```

| Suite | Result |
|---|---|
| `vendor-io-terms.test.ts` | **PASS** |
| `vendor-io-terms-regression.test.ts` (S1–7 hierarchy) | **PASS** |
| `vendor-io-document-parity.test.ts` (HTML vs PDF legal terms) | **PASS** — Platform / Vendor Default / IO Override |
| `verify:vendor-io-terms-production` | **PASS** (4/4) |

Document parity compares section titles, numbering, order, and clause bodies. CSS/formatting ignored.

## 5. Production verification

| Item | Result |
|---|---|
| Column + function on Prod | **PASS** |
| Legacy influencers allow-all policies removed | **PASS** |
| Intended `influencers_*` RLS active | **PASS** |
| Document API formats HTML/PDF | **PASS** (code + UI) |
| `vendor_ios.read` for document GET | **PASS** |
| App-level `influencers.write` on Vendor Default saves | **PASS** |

## 6. Remaining known limitations

- Word export not supported (backlog — non-blocking).
- Stored PDF may lag until Refresh document; live PDF path regenerates.
- Terms editor UI not disabled for read-only users (save rejected).
- No `supabase_migrations` history table on Production (track via schema checks / this report).

## 7. Final recommendation

### **GO**

Database migrations applied on Production. Automated hierarchy + HTML/PDF parity + RLS/permission checks pass. Deploy the application build containing the Vendor IO Terms feature, then run the short post-deploy UI smoke (Scenarios 1–5 + HTML/PDF).
