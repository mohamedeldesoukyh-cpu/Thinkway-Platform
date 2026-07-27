# Hotfix — Vendors list statement timeout

**Date:** 2026-07-27  
**Trigger:** Production `/vendors` showed `canceling statement due to statement timeout` (0 vendors).

## Root cause

1. Release readiness dropped legacy `Allow authenticated users select influencers` (`USING (true)`).
2. `influencers_select` then required `has_permission('influencers.read') AND can_access_influencer(id)` **per row**.
3. `can_access_influencer` is `SECURITY DEFINER` and re-runs role lookups for every row (~0.4ms × 7086 ≈ **2.8s**).
4. Vendors page used PostgREST `{ count: "exact" }`, which **also** scanned all rows under RLS (~2.8s). Combined request exceeded the statement timeout.
5. Not caused by Vendor IO Terms columns/selects; caused by the **RLS hardening** shipped with that release (`20260727001500_drop_legacy_influencer_allow_all_policies.sql`). Avatar columns from `82c2993` are incidental.

## Slow SQL (before)

PostgREST shape from `getVendorsList`:

- `SELECT … FROM influencers ORDER BY created_at DESC LIMIT 25 OFFSET 0` + nested `influencer_platform_accounts`
- Exact `COUNT(*)` under the same RLS filter

`EXPLAIN ANALYZE` (authenticated super_admin): list **~2873ms**, count **~2759ms**.

## Fix

| Change | Purpose |
|---|---|
| `influencers_select` internal fast path via `can_read_all_influencers()` | Keep least-privilege; avoid per-row helper on list |
| `influencers_created_at_desc_idx` | Support `ORDER BY created_at DESC LIMIT n` |
| `vendor_list_total_count(...)` SECURITY DEFINER RPC | O(auth)+indexed count for internal users (~3ms) |
| App: drop PostgREST exact count; call RPC in parallel | Prevent timeout on pagination total |

Migrations: `20260727023000` … `20260727023300`.

## Performance

| Path | Before | After |
|---|---|---|
| List LIMIT 25 (RLS) | ~2873 ms | ~20 ms |
| Total count (internal) | ~2759 ms (RLS exact) | ~3 ms (RPC) |
| Count + search filter | n/a (timeout) | ~29 ms |

## Validation

- DB applied on Production + Development
- List + RPC EXPLAIN after fix: PASS
- App deploy required for `features/vendors/queries.ts` change
