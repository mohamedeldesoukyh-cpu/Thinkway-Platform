# PO / FX Governance Migration

Apply migrations in timestamp order. The PO and FX engine depends on prior enterprise hierarchy and VAT migrations.

## Prerequisites

- Supabase CLI linked to your project, or SQL Editor access
- All migrations through `20260531230000_platform_metrics_tracking.sql` applied

## Apply

```bash
supabase db push
```

Or run manually in the SQL Editor:

```sql
-- Run the full contents of:
-- supabase/migrations/20260531240000_po_fx_governance_engine.sql
```

## What this migration adds

- `po_status` enum and PO columns on `campaign_headers`
- `md_exchange_rates`, `fx_rate_audit_logs`, `po_governance_logs`, `finance_notifications`
- `campaign_purchase_orders` (multi-PO ready)
- FX snapshot columns on `campaign_lines`
- Functions: `compute_po_status`, `resolve_effective_exchange_rate`, `sync_campaign_header_po_consumption`
- Trigger to sync PO consumption from `revenue_before_vat` (VAT excluded)
- Seed GBP currency and sample USD cross-rates

## Verify

```sql
SELECT code, decimal_places FROM md_currencies ORDER BY code;
SELECT from_currency, to_currency, exchange_rate, effective_start_date
FROM md_exchange_rates ORDER BY from_currency, effective_start_date;
SELECT po_status, COUNT(*) FROM campaign_headers GROUP BY po_status;
```

## Rollback note

This migration adds columns and new tables. Rollback requires manual drops if needed; prefer restoring from backup in production.
