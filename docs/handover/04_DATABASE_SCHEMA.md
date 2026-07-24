# 04 — Database Schema

## Source of truth

- Migrations: `supabase/migrations/` (**176** SQL files as of 2026-07-24)
- Types: `types/database.ts`
- Schema dump helper: `supabase/schema.sql` (may lag migrations)

## Hierarchy tables

`groups`, `clients` (legal entities), `brands`, `campaign_headers`, `campaign_lines`, `campaign_influencers`, `influencers`.

## Cross-cutting

- Auth: `profiles`, roles/permissions, `user_invites`
- Finance: invoices, credit/debit notes, FX, posting, PO tracker tables
- Discovery: DNA, imports, enrichment runs, shortlists, quotations
- Approvals / audit logs

## Security migrations (must be applied)

| Migration | Purpose |
|-----------|---------|
| `20260724150000_finance_fx_rls_least_privilege.sql` | P0 finance/FX RLS |
| `20260724160000_finance_po_notifications_rls_hardening.sql` | P0 PO notifications |
| `20260724170000_invalidate_plaintext_invites.sql` | Invite token hardening |
| `20260724180000_p4_campaign_publication_media_select.sql` | P4 storage SELECT |

## RLS

See `docs/security/RLS_MATRIX.md` and `docs/security/P0_FINANCE_FX_RLS_DEPLOYMENT.md`.
Prefer `FORCE ROW LEVEL SECURITY` on privileged finance tables where migration applies it.

