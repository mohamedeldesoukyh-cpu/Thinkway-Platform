# Operational reset (campaigns + IOs)

Use this when you want a **clean operational slate** — remove all campaigns, assignments, Vendor IOs, Client IOs, invoices, and related transactional data — **without** changing application logic, schema, or master data.

## What is removed

| Area | Tables / data |
| --- | --- |
| Campaigns | `campaign_headers`, `campaign_lines`, `campaign_members`, `campaign_influencers` |
| Assignments | `assignment_deliverables`, `assignment_post_schedule`, legacy `deliverables` |
| IOs | `client_ios`, `vendor_ios`, `vendor_io_lines`, `io_notifications` |
| Billing | `invoices`, `invoice_line_items`, `invoice_versions`, `payments` |
| Finance registry | `finance_documents` / `finance_document_links` tied to campaigns, invoices, or IOs |
| Governance | `po_governance_logs`, campaign-related `finance_override_logs`, `approvals` |
| Movements | `movement_items`, `movement_batches` (required before header delete) |
| Budget links | `budget_lines` where `campaign_header_id` is set |
| Audit (optional) | `audit_logs` for campaign/IO/invoice entity types |

## What is kept

- **Holding groups**, **clients**, **brands**, **vendors/influencers**
- Master data (categories, currencies, teams, VR rates, etc.)
- Users, roles, permissions
- Intelligence warehouse (`intelligence` schema) — archived module; not touched
- Finance posting batches not tied to deleted documents (review manually if used)

## Numbering after reset

Document numbers are driven by `document_sequences` and insert triggers:

| Entity | Format | After reset |
| --- | --- | --- |
| Campaign header | `TW-YYYY-NNNN` | `TW-2026-0001` |
| Campaign line | `{header}-A`, `-B`, … | `TW-2026-0001-A` |
| Vendor IO | `VIO-YYYY-NNNN` | `VIO-2026-0001` |
| Client IO | `CIO-YYYY-NNNN` | `CIO-2026-0001` |
| Invoice | `INV-YYYY-NNNNN` | `INV-2026-00001` |

Yearly prefixes reset per calendar year (`TW-2026`, `VIO-2026`, etc.).

## How to run

### 1. Preflight (safe — no deletes)

In **Supabase → SQL Editor** (postgres / service role):

```bash
npx supabase db query --linked -f supabase/scripts/full_operational_reset.sql
```

With `v_execute := 0` (default in the script) you only see counts and current sequence values.

### 2. Execute wipe

Edit the script:

```sql
v_execute int := 1;
v_year int := 2026;  -- or NULL to reseed all years found
```

Re-run the script. Expect `campaign_headers` count **0** afterward.

### 3. Single-campaign delete (alternative)

If you only need to remove one campaign and re-gap numbering:

- `supabase/scripts/campaign_operational_reset_preflight.sql`
- `supabase/scripts/campaign_operational_reset.sql`

### 4. Storage (manual)

Generated IO PDFs/HTML in Supabase Storage (`vendor_io_documents`, `client_io_documents`) are **not** deleted by SQL. Remove orphaned files in the Storage UI if needed.

## Verify

```sql
SELECT count(*) AS campaigns FROM campaign_headers;
SELECT count(*) AS vendor_ios FROM vendor_ios;
SELECT count(*) AS client_ios FROM client_ios;
SELECT count(*) AS invoices FROM invoices;
SELECT prefix, last_value FROM document_sequences
WHERE prefix ~ '^(TW|VIO|CIO|INV)-'
ORDER BY prefix;
```

## Create your first campaign again

1. Ensure at least one **group → client → brand** exists (hierarchy unchanged).
2. **Campaigns → New campaign** — PO amount on this form sets the campaign PO budget (separate from Client PO governance).
3. Open campaign → **Assignments → Assign influencer**.
4. Client IO / Vendor IO are created when the workflow reaches those steps (not at empty create).

## Related scripts

| Script | Purpose |
| --- | --- |
| `supabase/scripts/full_operational_reset.sql` | Wipe **all** campaigns + reseed sequences |
| `supabase/scripts/campaign_operational_reset.sql` | Wipe **one** campaign |
| `supabase/migrations/20260609010000_campaign_document_sequence_reseed.sql` | `reseed_thinkway_campaign_sequence()` helper |
