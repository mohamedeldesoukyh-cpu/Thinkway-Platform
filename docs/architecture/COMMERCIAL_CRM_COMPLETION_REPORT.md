# Commercial CRM Completion — Delivery Report

**Date:** 2026-07-27  
**Constraint honored:** Vendors module IS Commercial CRM. No parallel CRM. Discovery never auto-activates CRM.

## 1. Architecture changes

- Vendors list defaults to **commercial CRM members only** (`has_commercial_profile`), with `?inventory=all` for legacy identity inventory.
- CRM writers default **ON** (explicit env disable for rollback).
- Vendor workspace expanded into the operational Commercial CRM profile (tabs + completeness strip + timeline merge).
- Client Legal tab hosts **commercial requirements** (additive).
- Vendor IO generation composes Thinkway + client + brand terms when available, and activates CRM via existing `ensureCommercialCreatorFromVendorIo`.

## 2. Reused components

| Capability | Reused |
|---|---|
| CRM membership | `ensureCommercialCreator`, `creator_crm_profiles`, activation events |
| Manual create | `createVendorAction` + URL enrich path in `NewVendorDialog` |
| Discovery convert | Identity search + `convertInfluencerToCommercialCrmAction` |
| Quote→campaign / assignment | Existing Phase 2B wiring |
| Payments / billing / docs / contracts | Existing Vendor workspace tabs |
| Agreements | `VENDOR_IO_DEFAULT_TERMS` + Vendor IO `terms_text` |
| Audit / timeline | `audit_logs` + `creator_crm_activation_events` |

## 3. New components

- `CrmCompletenessStrip`
- `VendorCommercialTab`, `VendorQuotationsTab`, `VendorBankAccountsSection`
- `AddFromDiscoveryToCrmDialog` + `/api/vendors/crm-import-search`
- `ClientCommercialRequirementsSection`
- `lib/creators/crm/completeness.ts`, `agreement-compose.ts`
- Migration `20260727090000_commercial_crm_completion.sql`

## 4. Database changes (additive)

Migration adds:

- Lifecycle enum values: `draft`, `pending_legal`, `pending_finance`, `archived`
- `vendor_list_total_count(..., p_crm_only)`
- `influencer_bank_accounts` (+ seed from `payment_details`)
- `client_commercial_requirements`, `brand_commercial_requirements`
- `creator_agreement_templates`
- Backfill CRM for influencers with campaign / VIO / quotation activity

**Must apply migration** on Dev/Prod before multi-bank / requirements UI persists.

## 5. API changes

- `GET /api/vendors/crm-import-search?q=` — search identities not yet in CRM
- Server actions: convert to CRM, update commercial CRM fields, bank account upsert/default, client requirements upsert
- Vendor IO generate: compose agreement + CRM ensure from VIO

## 6. UI changes

- `/vendors` titled Commercial CRM; CRM status + completeness columns; New Creator + From Discovery
- Workspace tabs: Overview, Commercial, Platforms, Campaigns, Quotations, Payments, Documents, Legal & Contracts, Timeline
- Completeness strip (overall + dimensions + missing items)
- Client Legal → Commercial requirements editor

## 7. Remaining technical debt

- Shortlist / quotation pickers inside a single New Creator wizard (Discovery convert + manual exist; dedicated pickers not yet unified)
- Brand-level requirements UI (table exists; client-level UI shipped)
- Agreement template save UX on workspace (compose wired into VIO; template save helper exists, no dedicated editor UI)
- Automatic lifecycle transitions (Pending Legal → Pending Finance → Active)
- Payments hard-enforcement of verified default bank at disbursement time
- Client compliance scoring currently needs required docs passed into refresh (client requirements table ready)

## 8. Validation — no duplicate systems

- No second CRM module or `/creators` commercial route
- No duplicate influencer identity creation on Discovery→CRM
- No Discovery auto-CRM from import/Apify/shortlist-add
- Completeness / banks / requirements are additive tables or scorers on existing Vendors + Client surfaces

## Rollback

```
CREATOR_CRM_WRITERS_ENABLED=false
CREATOR_CRM_FILTER_ENABLED=false
# or NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED=false
```
