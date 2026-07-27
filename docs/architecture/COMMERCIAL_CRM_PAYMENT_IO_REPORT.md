# Commercial CRM — Payment & IO Workflow Enhancement

**Date:** 2026-07-27  
**Constraint:** Extend Vendors Payments tab + existing billing/IO. No second payment module.

## 1. Database changes (additive)

Migration `supabase/migrations/20260727100000_commercial_crm_payment_readiness.sql`:

| Change | Purpose |
|---|---|
| `influencer_bank_accounts` columns: beneficiary, relationship (+ description), branch, address, routing, sort code, national ID, tax | Payment required + optional fields |
| `vendor_io_signed_artifacts` | Signed IO upload/link (prefer external URL) |
| `vendor_io_communications` | Manual now; channels ready for future auto-send |
| `vendor_payment_timeline_events` | Payment/IO/PO/comms chronology |

Existing reused: `vendor_ios` (revision_number / is_superseded), `campaign_headers` PO fields, `vendor_payment_batches`, `campaign_influencers.vendor_payment_status`.

## 2. API / server changes

| Change | File |
|---|---|
| `computePaymentReadiness` / bank relationship options | `lib/creators/crm/payment-readiness.ts` |
| Timeline logger | `lib/creators/crm/payment-timeline.ts` |
| Payment blocked only by readiness | `lib/services/billing/vendor-payment-service.ts` |
| Bank upsert with relationship rules | `features/vendors/actions.ts` |
| Signed IO link + communication log actions | `features/vendors/actions.ts` |
| IO generate logs timeline + revalidates vendors | `features/io/generate-vendor-io-action.ts` |
| Workspace loads IO/PO/signed/comms/timeline/readiness | `features/vendors/queries.ts` |

## 3. UI changes

- **Payments tab** = operational centre: readiness strip, payment table (creator/campaign/client/brand/amount/status/PO/IO/signed IO/bank), detail panels for PO/IO/signed IO/comms/record payment
- Bank accounts form: relationship dropdown + Other description; IBAN **or** account number
- Profile Completeness strip labeled **informational** (never blocks payment)
- Warnings for missing legal docs shown separately under readiness

## 4. Components reused

- Vendor workspace Payments tab / bank details / finance tab
- `generateVendorIosFromLinesAction`
- `recordVendorPaymentAction` / `vendor_payment_batches`
- Campaign PO fields + IO revision model
- CRM completeness (kept separate)

## 5. New components

- `PaymentReadinessStrip`
- `VendorPaymentOpsSection`
- Payment readiness scorer + tests
- Signed IO / communication / timeline tables + actions

## 6. No duplicate systems

- No new `/payments` module
- No parallel IO generator — reuses existing Vendor IO action from Payment screen
- No parallel PO system — displays campaign PO status/number
- Profile Completeness ≠ Payment Readiness (explicit separation)
- Client legal requirements remain agreement concerns; they do **not** gate `recordVendorPayment`

## Ops

Apply migration `20260727100000_commercial_crm_payment_readiness.sql` before signed IO / communication / extended bank fields persist.
