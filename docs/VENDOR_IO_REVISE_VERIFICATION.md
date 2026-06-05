# Vendor IO revise — verification checklist

Run automated invariant checks:

```bash
npx tsx lib/billing/vendor-io-revision-scenarios.test.ts
```

Apply DB constraints (local / staging / production):

```bash
supabase db push
# or run supabase/migrations/20260608010000_campaign_line_status_invariants.sql
```

## Correct post-revise sequence

```
Revise Vendor IO
  → supersede old VIO (is_superseded = true)
  → insert new VIO + vendor_io_lines
  → finalizeLineBillingAfterVendorIoRevision
      → clear invoice_id / finance override / locks
      → reset deliverables + posts
      → syncLineBillingFromDeliverables
      → syncLineOperationalStatus (+ invariant repair)
  → revalidatePath
  → hierarchy rebuild (active VIO only, sanitized children)
```

## Scenario matrix

| # | Scenario | Expected after action |
|---|----------|------------------------|
| 1 | Reopened → Revise VIO | `operational_status=io_generated`, `billing_status=moved_to_billing` (or `approved`), `invoice_id=null`, new VIO, old VIO superseded, deliverables `ready_to_invoice` unlocked |
| 2 | Generate invoice after revise | `partially_invoiced` or `invoiced` with `invoice_id` set when fully locked; no duplicate `invoice_line_items`; hierarchy child keys unique |
| 3 | Expand deliverables after revise | No invoice doc on children; `is_locked=false`; no duplicate post/deliverable ids |
| 4 | Multiple revisions `/1`, `/2` | Only `is_superseded=false` VIO in `getCampaignVendorIos`; line `vendor_io_id` points at latest; tab stable each cycle |
| 5 | DB invariants | Never persist `billing_status=invoiced` + `invoice_id IS NULL`; never `operational_status=reopened` + `invoice_id IS NOT NULL` |

## Server logs (revise)

- `[revise-vendor-io] billing_finalize_complete` → `valid: true`
- No `billing_finalize_invariant_failed` or `post_sync_invalid_pair`

## Assignments render stage progression

After scenarios 1–5 pass in staging/production:

1. `ASSIGNMENTS_RENDER_STAGE=dialogs` + redeploy
2. Validate invoice sheets / dialogs on assignments tab
3. `ASSIGNMENTS_RENDER_STAGE=full` + redeploy (banner auto-hides in production)
4. Remove `ASSIGNMENTS_ALLOW_RENDER_BISECT` and legacy emergency paths when `full` is stable for 48h

See `docs/ASSIGNMENTS_RECOVERY_CHECKLIST.md`.
