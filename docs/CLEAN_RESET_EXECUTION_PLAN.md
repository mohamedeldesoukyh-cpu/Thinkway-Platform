# Thinkway — Clean reset execution plan

Canonical lifecycle reference: `docs/VENDOR_IO_INVOICE_LIFECYCLE.md` · Revise verification: `docs/VENDOR_IO_REVISE_VERIFICATION.md`

## Campaign creation (no auto bootstrap)

`createCampaignAction` inserts **only** `campaign_headers` + PO budget fields. It does **not** insert `campaign_lines`, deliverables, or synthetic “Other” rows.

Assignment hierarchy no longer injects `buildSyntheticDeliverable` for empty lines — deliverables exist only when created via **Create assignment** / commercial sync.

## Architecture rule (permanent)

**Never manually UPDATE `operational_status` or `billing_status` on `campaign_lines`.**

All transitions must run only through:

| Action | Code path |
|--------|-----------|
| Generate Vendor IO | `generateVendorIosFromLinesAction` |
| Revise Vendor IO | `reviseVendorIosFromLinesAction` → `finalizeLineBillingAfterVendorIoRevision` |
| Generate invoice | `invoice-from-deliverables` / billing actions |
| Ungenerate invoice | `ungenerateInvoiceAction` |
| Append invoice | Billing append actions (eligible states only) |
| Reopen workflow | Invoice ungenerate + finance override window |

DB enforces invariants (`20260608010000_campaign_line_status_invariants.sql`):

- `billing_status` ∈ `{invoiced, paid, closed}` ⇒ `invoice_id IS NOT NULL`
- `operational_status = reopened` ⇒ `invoice_id IS NULL`

---

## Phase 1 — Remove old campaign operational data

### Script

`supabase/scripts/campaign_operational_reset.sql`

### Configure

In the `DO $$` block at the top of the script:

```sql
v_campaign_document_number text := 'TW-2026-0003'; -- your old campaign TW number
-- OR
v_campaign_name_pattern text := '%Arab bank%event%';
v_execute int := 0;  -- preflight first
```

### Run (Supabase SQL Editor)

1. **Preflight** — `v_execute := 0` → review `NOTICE` counts (lines, invoices, VIOs, deliverables).
2. **Execute** — `v_execute := 1` → re-run the same block.

### Removed (this campaign only)

- `campaign_lines`, `assignment_deliverables`, `assignment_post_schedule`
- `vendor_ios`, `vendor_io_lines` (including superseded / revision chain)
- `invoices`, `invoice_line_items`, `invoice_versions`, `payments`
- `client_ios`, `campaign_influencers`, `campaign_publications`
- Finance overrides, campaign-scoped audit/approvals
- Legacy `deliverables` rows for the campaign
- `movement_items`, `budget_lines` for the campaign
- **`campaign_headers` row**

### Preserved (global)

- Clients, brands, groups
- Vendors / influencers (master data)
- Currencies, exchange rates, VAT config
- Users, roles, permissions, settings

---

## Phase 2 — Create new clean campaign

In the app (not SQL):

1. **New campaign** — e.g. **Arab bank event v2**
2. Same **legal entity / brand / client** as before
3. **No auto line A** — campaign creation only inserts `campaign_headers` + PO budget
4. Open **Assignments** → empty state → **Create assignment**
5. Add deliverables/posts on each assignment before VIO / invoice

Confirm empty state:

- No placeholder line, no synthetic “Other” deliverable
- No invoices, no VIOs, no deliverable locks
- Assignments tab at render stage **footer** (see Phase 4)

---

## Phase 3 — Clean lifecycle validation

Run in order. After each step, optional DB check:

```sql
SELECT id, document_number, name, operational_status, billing_status, vendor_io_id, invoice_id
FROM campaign_lines
WHERE campaign_header_id = '<new-campaign-uuid>';
```

| Step | Action | Expected |
|------|--------|----------|
| 1 Draft | Create assignment + deliverables + posts | `operational_status=draft`, `billing_status=draft` |
| 2 Generate VIO | Footer → Generate Vendor IO | `io_generated`, `approved` or `moved_to_billing`, `vendor_io_id` set, VIO doc `VIO-YYYY-NNNN` |
| 3 Generate invoice | Footer → Generate invoice | `invoiced`, `invoice_id` set, deliverables locked, preview OK |
| 4 Ungenerate invoice | Finance ungenerate | `reopened`, `invoice_id` null, deliverables unlocked, `moved_to_billing` |
| 5 Revise VIO | Footer → Revise (reason ≥3 chars) | Old VIO superseded, new `VIO-…/1`, `io_generated`, no `reopened`+`invoiced` |
| 6 Invoice again | Generate invoice | New invoice, no duplicate line items / stale children |
| 7 Append invoice | Only when `partially_invoiced` or `reopened` | Blocked on paid/closed/locked/void |
| 8 Multi-revision | Revise → `/2` → invoice | Only latest VIO active; tab stable each time |

### Automated checks (local)

```bash
npx tsx lib/billing/vendor-io-revision-scenarios.test.ts
```

### Server logs (revise)

- `[revise-vendor-io] billing_finalize_complete` with `valid: true`
- No `billing_finalize_invariant_failed` or `post_sync_invalid_pair`

### Assignments tab — final validation

- [ ] No emergency JSON fallback
- [ ] No stale status pills
- [ ] No duplicate parent/child rows
- [ ] No duplicate React keys in console (`[Assignments] DUPLICATE CHILD KEYS`)
- [ ] Expand/collapse deliverables stable after each mutation

---

## Phase 4 — Render stage rollout (after Phase 3 passes)

| Order | `ASSIGNMENTS_RENDER_STAGE` | Notes |
|-------|----------------------------|--------|
| 1 | `footer` | Current production baseline |
| 2 | `dialogs` | Invoice sheets on assignments tab |
| 3 | `full` | All features; banner hidden in production |

Set both env vars and **redeploy**:

```text
ASSIGNMENTS_RENDER_STAGE=dialogs
NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE=dialogs
```

See `docs/ASSIGNMENTS_RECOVERY_CHECKLIST.md`.

### After `full` is stable (~48h)

Remove (separate PR):

- ~~Production recovery auto-upgrade / bisect banner~~ (removed)
- ~~`AssignmentsJsonFallback` emergency path~~ (removed)
- `ASSIGNMENTS_ALLOW_RENDER_BISECT` usage
- Static-table / expansion bisect stages from production code paths

**Keep permanently:**

- `campaign-line-status-invariants` + DB CHECK constraints
- `finalizeLineBillingAfterVendorIoRevision`
- `sanitize-assignment-hierarchy` + hierarchy validation logs

---

## Quick reference — correct post-revise sequence

```
Revise Vendor IO
  → supersede old VIO
  → insert new VIO + vendor_io_lines
  → finalizeLineBillingAfterVendorIoRevision
      → clear invoice_id / overrides / locks
      → reset deliverables + posts
      → sync billing + operational (with invariant repair)
  → revalidatePath
  → hierarchy rebuild (active VIO only)
```
