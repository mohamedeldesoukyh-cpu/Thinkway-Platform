# Assignments tab — production notes

Render-stage bisect and emergency JSON fallback have been **removed**. The Assignments tab always renders the full operational grid.

Lifecycle validation after auto-bootstrap removal: **`docs/CLEAN_LIFECYCLE_VALIDATION.md`**

Clean-slate campaign reset: **`docs/CLEAN_RESET_EXECUTION_PLAN.md`**

## Vercel cleanup

Delete obsolete Production variables (no effect if left, but confusing):

- `ASSIGNMENTS_RENDER_STAGE`
- `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE`
- `ASSIGNMENTS_ALLOW_RENDER_BISECT`

Redeploy after removal. Hard refresh: `Ctrl+Shift+R`.

## On Assignments tab failure

- UI: `AssignmentsTabErrorFallback` (error message + digest only)
- Browser console: `[Assignments] tab boundary`, row crash logs
- Server: `[assignment-hierarchy]`, `[revise-vendor-io]`

Do **not** expect JSON emergency rows or render-stage banners.

## Revise Vendor IO

1. `npx tsx lib/billing/vendor-io-revision-scenarios.test.ts`
2. Migration `20260608010000_campaign_line_status_invariants.sql`
3. Manual path in `docs/VENDOR_IO_REVISE_VERIFICATION.md`
4. Log: `[revise-vendor-io] billing_finalize_complete` with `valid: true`
