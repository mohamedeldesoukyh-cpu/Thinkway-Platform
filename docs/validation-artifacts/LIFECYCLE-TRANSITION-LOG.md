# Lifecycle transition log — TW-2026-0003

**Campaign:** `LIFECYCLE-FINAL-VALIDATION-2026-06-04`  
**ID:** `d7698a72-6b6a-491b-b012-08be3e923262`  
**Rule:** Do not reference INV-2026-1. Snapshot SQL after every step.

## Snapshot command

```bash
npx supabase db query --linked -f supabase/scripts/lifecycle_final_validation_snapshot.sql
```

Save output to `docs/validation-artifacts/snapshots/` with filename: `{step}-{timestamp}.json`.

Dev server logs (if running locally): watch for `[invoice-lifecycle-debug]` and `[invoice-lifecycle-commit]` lines.

---

## Expected transitions

| Step | UI action | Invoice status | regeneration_status | line_items | subtotal | Notes |
|------|-----------|----------------|---------------------|------------|----------|-------|
| 0 | Seed complete | — | — | 0 | — | VIO-2026-0006 rev 0 |
| 5 | First invoice (del 1) | draft | active | 1 | 1000 | del0 locked, del1 open |
| 7 | Append (del 2) | draft | active | 2 | 2000 | both locked |
| 9 | Commercial → 1200 | draft | active | 2 | 2000 | commercial on deliverable |
| 10 | Ungenerate | draft | pending_regeneration | 2 | 2000 | locks cleared, lines preserved |
| 11 | Regenerate | draft | **active** | 2 | **2200** | same invoice # |
| 13 | Ungenerate | draft | pending_regeneration | 2 | 2200 | locks cleared |
| 15 | Re-generate | draft | **active** | 2 | 2200 | final state |

---

## Step log (fill during UI run)

### Step 0 — Baseline (pre-invoice)

- [ ] Snapshot saved: ___
- invoices: 0
- deliverables ready: 2
- VIO: VIO-2026-0006, revision 0, active

---

### Step 5 — First invoice

**UI:** Select deliverable 1 only → Generate invoice

| Field | Expected | Actual |
|-------|----------|--------|
| invoice document_number | INV-2026-* (new) | |
| status | draft | |
| regeneration_status | active | |
| line_item_count | 1 | |
| subtotal | 1000 | |
| line_sum delta | 0 | |
| del0 locked | yes | |
| del1 locked | no | |
| line billing_status | partially_invoiced or invoiced | |
| phantom Generate on del0 | no | |
| toast count | 1 | |

- [ ] Snapshot: ___
- [ ] Screenshot: ___

**If fail → trace:** lifecycle mutation / lock sync / totals / UI derivation / stale data

---

### Step 7 — Append

**UI:** Select deliverable 2 → Append to same invoice

| Field | Expected | Actual |
|-------|----------|--------|
| same invoice # | yes | |
| line_item_count | 2 | |
| subtotal | 2000 | |
| duplicate deliverable grains | 0 rows | |
| both deliverables locked | yes | |

- [ ] Snapshot: ___

---

### Step 9 — Commercial change

**UI:** Edit deliverable 1 revenue 1000 → 1200

| Field | Expected | Actual |
|-------|----------|--------|
| del0 revenue_before_vat | 1200 | |
| invoice subtotal (unchanged until regen) | 2000 | |

- [ ] Snapshot: ___

---

### Step 10 — Ungenerate

**UI:** Ungenerate invoice (reason logged)

| Field | Expected | Actual |
|-------|----------|--------|
| regeneration_status | pending_regeneration | |
| is_operational_locked | false | |
| del0 locked_at | null | |
| del1 locked_at | null | |
| line items preserved | 2 | |
| invoice_id on line | null | |

- [ ] Snapshot: ___

---

### Step 11 — Regenerate

**UI:** Regenerate same invoice

| Field | Expected | Actual |
|-------|----------|--------|
| same document_number | yes | |
| regeneration_status | **active** (not regenerated) | |
| line_item_count | 2 (no new rows) | |
| subtotal | 2200 | |
| line_sum | 2200 | |
| assignments invoiced | yes | |
| VIO revision | /1 if commercial revise ran | |
| phantom Generate | no | |
| toast loops | no | |

- [ ] Snapshot: ___
- [ ] Screenshot: ___

---

### Step 13–15 — Ungenerate + re-generate

Repeat ungenerate → verify locks cleared → regenerate → verify final totals.

| Field | Expected | Actual |
|-------|----------|--------|
| final subtotal | 2200 | |
| pending_regeneration | none | |
| duplicate line items | 0 | |

- [ ] Snapshot: ___
- [ ] Screenshot: ___

---

## Failure triage (no symptom patching)

| Symptom | Check first | Root cause bucket |
|---------|-------------|-------------------|
| Wrong subtotal | Section 2 delta | totals reconciliation |
| Duplicate line items | Section 3 | lifecycle mutation / PR1 |
| Locks not cleared after ungenerate | Section 4–5 | lock synchronization |
| pending_regeneration stuck | Section 8 | lifecycle mutation |
| Generate shown on invoiced row | UI + Section 5 | UI derivation mismatch |
| Wrong invoice # on regenerate | Section 1 | lifecycle mutation |
| Exploded total | line_item_count > deliverables | stale data or duplicate insert |
| Toast loop | UI only | UI state / revalidation (not DB) |

---

## Final sign-off

- [ ] All invariant queries (Section 8) return 0 rows
- [ ] All success criteria in `LIFECYCLE-FINAL-VALIDATION.md` checked
- [ ] Ready for production promotion: **YES / NO**

**Validator:** ___
**Date:** ___
