# Commercial CRM Completion Plan (Reuse First)

**Date:** 2026-07-27  
**Constraint:** Vendors module IS Commercial CRM. No parallel CRM. No Discovery auto-activation.

## Audit summary

| Layer | Status |
|---|---|
| `creator_crm_profiles` / activation events | Shipped (Dev+Prod) |
| `ensureCommercialCreator` + assignment / quote→campaign | Wired, writers were OFF |
| Vendor workspace tabs | Live operational profile |
| Completeness columns | Schema only — scorer missing |
| CRM list filter | Flag unused |
| Multi-bank / client+brand requirements / agreement compose | Missing |

## Implementation slices (this delivery)

1. **Membership** — writers default ON; filter default ON; create/convert call `ensureCommercialCreator`; commercial backfill for real activity.
2. **Completeness** — scorer + missing items + dimension scores; strip on list/profile.
3. **New Creator** — multi-source dialog reusing createVendor / Discovery search / URL enrich / shortlist+quotation pickers.
4. **Profile expansion** — CRM overview fields; quotations tab query; timeline merges activation events; commercial notes on CRM profile.
5. **Bank accounts** — additive `influencer_bank_accounts` (migrate from `payment_details` when present).
6. **Client/Brand requirements** — additive tables + compliance check against documents.
7. **Agreement** — resolve Thinkway + client + brand clause packs into Vendor IO terms text (reuse IO serializer).

## Non-goals

- No `/creators` route rename required for usability (optional later).
- No Discovery behaviour change for import/Apify/shortlist-add.
- No duplicate influencer rows.

## Delivery status

Implementation landed on this branch. See **`docs/architecture/COMMERCIAL_CRM_COMPLETION_REPORT.md`** for architecture / reused / new / DB / API / UI / debt / no-duplicates validation.

**Required ops step:** apply `supabase/migrations/20260727090000_commercial_crm_completion.sql` before multi-bank and client requirements persist in environments that have not received it.
