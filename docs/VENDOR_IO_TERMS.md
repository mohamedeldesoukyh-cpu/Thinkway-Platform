# Vendor IO Terms Hierarchy

Enterprise contract terms for Vendor IOs follow the same design as Client IO.

## Architecture

| Layer | Storage | Owner |
|---|---|---|
| Platform Default | `lib/io/vendor-io-default-terms.ts` (`VENDOR_IO_DEFAULT_TERMS`) | Engineering — kept in sync with `Thinkway_IO_Global.html` §8 |
| Vendor Default | `influencers.vendor_io_terms_text` | Vendor Overview → **Vendor IO Default Terms** |
| Deal Override | `vendor_ios.terms_text` | Vendor IO editor (`/ios/vendor`) |
| Generated document | `vendor_ios.terms_html` + live HTML/PDF render | Document generation |

Shared helpers live in `lib/io/client-io-terms.ts` (`parseTermsText`, `serializeTermsText`, `resolveEffectiveTerms`, `resolveEffectiveVendorIoTerms`, `renderTermsListHtml`, …).

UI badge: `features/io/components/io-terms-source-badge.tsx`.

## Hierarchy

```
Platform Default  (VENDOR_IO_DEFAULT_TERMS / Thinkway_IO_Global.html §8)
        ↓
Vendor Default    (influencers.vendor_io_terms_text)   — optional
        ↓
Vendor IO Override (vendor_ios.terms_text)             — per deal
```

## Resolution order

**IO → Vendor → Platform** (first non-empty structured JSON list wins).

- `NULL` / empty / unparseable at any layer means “inherit the parent layer.”
- Structured format: JSON array `[{ "title": string, "body": string }, …]`.
- New Vendor IOs **snapshot** vendor defaults onto `vendor_ios.terms_text` at create time (via `generate-vendor-io-action` / `upsert_vendor_io_from_assignment`). Changing vendor defaults later does **not** rewrite existing IOs.
- Document generation calls `resolveEffectiveVendorIoTerms` and injects `<ul class="terms-list">` via `renderVendorIoHtml`.

## Migration

| File | Purpose |
|---|---|
| `supabase/migrations/20260726220000_vendor_io_terms.sql` | Adds `influencers.vendor_io_terms_text`; seeds new VIOs from vendor defaults in `upsert_vendor_io_from_assignment` |
| `supabase/migrations/20260727001500_drop_legacy_influencer_allow_all_policies.sql` | Drops legacy permissive influencers SELECT/INSERT/UPDATE policies so `influencers.write` RLS is effective |

Apply with Production/Dev psql runners (`scripts/psql-production.mjs` / `scripts/psql-development.mjs`) when `supabase_migrations` history is unavailable.

## Backward compatibility

- Existing `vendor_ios` rows are **not** mutated by the terms migration.
- Legacy freeform `terms_text` that does not parse as structured JSON falls through to vendor/platform defaults (platform copy matches the former static template Section 8).
- Historical IOs keep their stored `terms_text` / generated blobs until regenerated.
- Regenerating a legacy freeform row resolves via the hierarchy above.

## Supported document formats

| Format | Status | Endpoint / UI |
|---|---|---|
| HTML | Supported | `/api/vendor-ios/[id]/document?format=html` |
| PDF | Supported | `/api/vendor-ios/[id]/document?format=pdf` |
| Word | Not supported | Backlog: [docs/backlog/VENDOR_IO_WORD_EXPORT.md](./backlog/VENDOR_IO_WORD_EXPORT.md) |

HTML and live PDF share the same render path (`renderLiveVendorIoHtml` → `renderHtmlToPdf`). Legal terms must match across HTML and PDF (see regression suite).

## Permissions

| Action | Permission |
|---|---|
| View Vendor IO documents | `vendor_ios.read` (API) |
| Edit Vendor Default Terms (Overview) | `influencers.write` (action + RLS `influencers_update`) |
| Save terms as Vendor Default from IO editor | `influencers.write` |
| Edit deal override on Vendor IO | `vendor_ios` update RLS (`vendor_ios.write` / campaign access) |

Read-only users can view documents when authorised; they cannot persist Vendor Default Terms.

## UI surfaces

| Surface | Location |
|---|---|
| Vendor defaults | Vendor profile → Overview → **Vendor IO Default Terms** |
| Per-deal editor | **Vendor IOs** → `/ios/vendor` → structured terms editor |
| Source badge | Platform Default / Vendor Default / Custom for this IO |

Editor actions: Save draft · Restore Vendor Default · Restore Platform Default · Save these terms as Vendor Default.

## Regression suite

```bash
npm run test:vendor-io-terms
```

Covers hierarchy scenarios 1–6, HTML/PDF document parity (titles, numbering, order, legal wording), and unit helpers.

## Known limitations

- Word export is not implemented (backlog).
- Stored PDF at `generated_pdf_url` can lag live HTML until **Refresh document**; live `format=pdf` regenerates when needed.
- UI does not disable the Vendor Default Terms editor for read-only users (save is rejected by action + RLS).
- Production may not have `supabase_migrations.schema_migrations`; migration status is verified by schema inspection when history is absent.

## Related docs

- [Pre-deploy regression audit](./release/VENDOR_IO_TERMS_REGRESSION_AUDIT.md)
- [Production readiness report](./release/VENDOR_IO_TERMS_PRODUCTION_READINESS.md)
- [Template field map §8](./VENDOR_IO_TEMPLATE_FIELD_MAP.md)
