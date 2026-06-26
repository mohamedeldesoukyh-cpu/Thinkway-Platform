# Status Badge Consolidation

**Branch:** `refactor/phase2-shared-domains-ui`  
**Date:** June 2026  
**Scope:** Phase 2 UI Consolidation — Step 1

---

## Audit: All Status Badge Implementations Found

| # | Component | Path | Domain |
|---|-----------|------|--------|
| 1 | `ClientStatusBadge` | `features/clients/components/client-status-badge.tsx` | Legal entity status |
| 2 | `OnboardingStatusBadge` | `features/clients/components/onboarding-status-badge.tsx` | Client onboarding |
| 3 | `CampaignStatusBadge` | `features/campaigns/components/campaign-status-badge.tsx` | Campaign header |
| 4 | `AssignmentStatusBadge` | `features/campaigns/components/assignment-status-badge.tsx` | Campaign line assignment |
| 5 | `AssignmentOperationalStatusBadge` | `features/campaigns/components/assignment-operational-status-badge.tsx` | Line operational status |
| 6 | `LineBillingStatusBadge` / `DeliverableBillingStatusBadge` | `features/campaigns/components/assignment-hierarchy/hierarchy-billing-status-badge.tsx` | Assignment hierarchy billing |
| 7 | `BillingStatusBadge` / `CollectionStatusBadge` | `features/billing/components/billing-status-badge.tsx` | Billing queue / collections |
| 8 | `DeliverableBillingStatusBadge` | `features/billing/components/deliverable-billing-status-badge.tsx` | Deliverable billing (table) |
| 9 | `VendorStatusBadge` | `features/vendors/components/vendor-status-badge.tsx` | Vendor/influencer |
| 10 | `IoStatusBadge` | `features/io/components/io-status-badge.tsx` | Client/vendor IO |
| 11 | `InvoiceStatusBadge` | `components/finance/invoice-status-badge.tsx` | Finance invoice register |
| 12 | `AdjustmentStatusBadge` | `components/finance/adjustment-status-badge.tsx` | Finance adjustments |
| 13 | `PostingBatchStatusBadge` | `components/finance/posting-batch-status-badge.tsx` | Posting batches |
| 14 | `UserStatusBadge` | `features/settings/components/user-status-badge.tsx` | Settings users |
| 15 | `PortalStatusBadge` | `features/portals/components/portal-status-badge.tsx` | Portal rows |
| 16 | `ImportStatusBadge` | `features/discovery-import/components/import-status-badge.tsx` | Discovery import |
| 17 | `EnrichmentStatusBadge` (platform sync) | `components/forms/enrichment-status-badge.tsx` | Platform account sync |
| 18 | `EnrichmentStatusBadge` (creator) | `features/discovery/enrichment/components/enrichment-status-badge.tsx` | Creator enrichment (with icons) |

**Additional badge exports in shared files:**

| Component | Path | Notes |
|-----------|------|-------|
| `ShortlistStatusBadge`, `ShortlistItemStatusBadge`, `AssignmentStatusBadge` | `features/discovery/shortlists/components/shortlist-badges.tsx` | Shortlist domain (3 wrappers) |

**Related inline patterns (not migrated — out of badge component scope):**

- `publication-workspace.tsx` — `statusBadgeClass()` for metrics refresh logs
- `quotation-workspace.tsx` / `quotations-list.tsx` — raw `<Badge variant="secondary">` for quotation status
- `reassignment-center.tsx` — inline `STATUS_VARIANT` map
- `quotation-html.ts` — export CSS (not React)

**Prior shared infra (now consolidated):**

- `lib/ui/status-tone.ts` — thin re-export over shared status utils
- `operational-status-pill-styles.ts` — pill base class re-export; tone map moved to `status-config.ts`

---

## Shared Infrastructure Created

```
components/shared/status/
  status-badge.tsx      # Base <StatusBadge /> component
  status-config.ts      # 24 domain tone maps → SemanticStatusTone
  status-utils.ts       # Class resolution, legacy tone normalization, helpers
  status-config.test.ts # Regression tests for mapping/config
```

### Semantic tokens (only)

| Token | Usage |
|-------|-------|
| `neutral` | Draft, inactive, closed, archived |
| `success` | Active, approved, paid, collected, completed |
| `warning` | Pending, paused, partial, overdue-adjacent |
| `destructive` | Cancelled, rejected, failed, void, disputed |
| `foreground` | In-progress, sent, assigned, info-equivalent states |

Tailwind classes use `success`, `warning`, `destructive`, `foreground`, `muted-foreground` — no hardcoded palette colors in badge files.

### Appearances

| Appearance | Used by |
|------------|---------|
| `outline` | Client, campaign, vendor, onboarding, finance badges |
| `pill` | Operational, IO, hierarchy billing |
| `filled` | Billing table badges |
| `ghost` | Shortlist badges |

---

## Before / After Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Status badge component files | 18 | 18 | 0 removed (wrappers preserved) |
| Inline color map definitions in badge files | ~22 | 0 | **−100%** |
| Central tone map definitions | 1 partial (`status-tone.ts`) | 24 domains in `status-config.ts` | Consolidated |
| Duplicate `STATUS_TONE` / variant switch blocks | ~22 | 0 | **−100%** |
| Hardcoded palette classes in `*-status-badge.tsx` | ~18 files | 0 | **−100%** |
| Shared status infra files | 0 | 4 | +4 |

**Duplicate reduction:** ~22 scattered color maps → 1 config + 1 utils resolver ≈ **95% reduction** in duplicate tone logic.

---

## Files Removed

None. All 18 domain badge files remain as thin wrappers (per requirement §4). Dead inline maps removed from each wrapper.

---

## Refactored Wrappers (all use `<StatusBadge />`)

Every specialized badge now delegates to `StatusBadge` with `resolveStatusTone(domain, status)` or a config map import from `status-config.ts`.

`lib/ui/status-tone.ts` re-exports semantic classes for backward compatibility (`STATUS_TONE_CLASS`, legacy `info`/`accent`/`danger` → semantic mapping).

---

## Tests

```bash
npx tsx components/shared/status/status-config.test.ts
npx tsx lib/clients/onboarding-status.test.ts
```

Validation:

```bash
npx tsc --noEmit -p tsconfig.json   # pass
npm run build                        # pass
```

---

## Intentionally Not Merged

Per audit guidance — different semantics, similar names:

- Platform sync vs creator enrichment badges remain separate wrappers
- Quotation status uses raw `Badge` (no dedicated badge component existed)
- Export HTML/CSS badges unchanged
