# Clean lifecycle validation (post auto-bootstrap removal)

Operational entities are created **only** by explicit user actions. Campaign create inserts a header (and PO fields) only — no lines, deliverables, Vendor IO, or billing rows.

## Prerequisites

1. **Deploy latest app code** — production still running an old build if you see `Assignments render stage: footer` banner or auto `— Other` lines on new campaigns.
2. Apply migrations (minimum):
   - `20260608010000_campaign_line_status_invariants.sql`
   - `20260608020000_operational_entity_integrity.sql`
   - `20260609000000_disable_operational_bootstrap.sql`
   - `20260609010000_campaign_document_sequence_reseed.sql`
2. Remove legacy Vercel env: `ASSIGNMENTS_RENDER_STAGE`, `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE`, `ASSIGNMENTS_ALLOW_RENDER_BISECT` (ignored by current code; delete to avoid confusion).
3. Redeploy and hard-refresh the browser.

## SQL baseline (new campaign)

After creating a campaign (before any assignment), run `supabase/scripts/campaign_operational_reset_preflight.sql` with your `document_number` or name filter.

Expected counts:

| Entity | Expected |
|--------|----------|
| `campaign_lines` | 0 |
| `assignment_deliverables` | 0 |
| `vendor_ios` | 0 |
| `invoices` (campaign-scoped) | 0 |

Also confirm in UI:

- **Assignments** tab: empty state, **Create assignment** (no Line A, no “Other”, no synthetic rows).
- **Deliverables** tab: empty.
- **Vendor IO** tab: empty.
- **Billing** tab: no operational invoice rows for the campaign.

Invalid status pairs must not exist:

```sql
SELECT id, document_number, operational_status, billing_status, invoice_id
FROM campaign_lines
WHERE campaign_header_id = '<campaign-id>'
  AND (
    (operational_status = 'reopened' AND billing_status IN ('invoiced', 'paid', 'closed'))
    OR (billing_status IN ('invoiced', 'paid', 'closed') AND invoice_id IS NULL)
    OR (operational_status = 'reopened' AND invoice_id IS NOT NULL)
  );
```

Expect **zero rows**.

### Delete bootstrap campaigns + reseed serial counter

Invalid bootstrap campaigns (TW-2026-2, TW-2026-3) should be **fully deleted**, not only shell-purged:

1. Run `supabase/scripts/delete_bootstrap_campaigns_and_reseed.sql` with `v_execute := 0`.
2. Set `v_execute := 1`, re-run — deletes headers and calls `reseed_thinkway_campaign_sequence(2026)`.
3. Verify: if TW-2026-1 is the only survivor, next new campaign must be **TW-2026-2** (not TW-2026-4).

```sql
SELECT prefix, last_value FROM document_sequences WHERE prefix = 'TW-2026';
-- last_value = highest surviving serial (e.g. 1 → next insert is 2)
```

**Controlled reset only** — after go-live, never reseed; deleted numbers stay gaps for audit.

## Manual checklist

### 1. New campaign

Create a brand-new campaign from **Campaigns → New campaign**.

- [ ] Assignments: empty, no hidden draft operational state
- [ ] Deliverables: empty
- [ ] No auto-created billing or Vendor IO

### 2. Create assignment

Use **Create assignment** once.

- [ ] Exactly one `campaign_lines` row (check document number suffix `-A`)
- [ ] `operational_status` / `billing_status` at draft baseline (no manual overrides in network payload)
- [ ] No extra hidden lines; no auto deliverables

### 3. Deliverables

Add deliverables manually on the assignment.

- [ ] Each row has correct `campaign_line_id`
- [ ] No synthetic `synthetic-*` ids; no duplicate child keys in console
- [ ] Hierarchy expand/collapse stable (no emergency JSON view)

### 4. Vendor IO

Select line(s) → **Generate Vendor IO**.

- [ ] One VIO per action; footer actions work
- [ ] Line: `draft` → `io_generated` (via sync, not hand-set in UI)
- [ ] No stale `invoice_id` on line

### 5. Invoice

Generate invoice from selection.

- [ ] `invoice_id` set on line; deliverables locked as expected
- [ ] `billing_status`: `moved_to_billing` → `invoiced`; operational status matches children
- [ ] Child rows render after refresh

### 6. Ungenerate + revise

**Ungenerate invoice** then **Revise Vendor IO**.

- [ ] `invoice_id` cleared; deliverables unlocked; `remaining_amount` reset
- [ ] Line returns to `reopened` or `io_generated` per rules (never `reopened` + `invoiced`)
- [ ] Old VIO `is_superseded`; new VIO suffix `/1`, `/2`, …

### 7. Re-invoice

Generate invoice again.

- [ ] No stale invoice references; no duplicate deliverable rows
- [ ] No invalid status pairs after refresh

### 8. Observability (keep)

On failure, use:

- Browser: `[Assignments]` tab boundary, `[revise-vendor-io]` in server logs
- `AssignmentsTabErrorFallback` (message only — no JSON dump)
- SQL invariant query above

Removed (do not expect): render-stage banner, `AssignmentsJsonFallback`, static-table bisect, production recovery auto-upgrade.

## Server log signals (revise)

After **Revise Vendor IO**, production logs should include:

```
[revise-vendor-io] billing_finalize_complete … valid: true
```

Red flags:

- `post_sync_invalid_pair`
- `DUPLICATE CHILD KEYS`
- `reopened` + `invoiced` on same line

## Reference

- Reset playbook: `docs/CLEAN_RESET_EXECUTION_PLAN.md`
- VIO/invoice rules: `docs/VENDOR_IO_INVOICE_LIFECYCLE.md`
- Architecture: `docs/ARCHITECTURE_ALIGNMENT.md`
