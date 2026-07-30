# Quotation Commercial Workspace

**Status:** Feature freeze (2026-07-30) — Production code deploy with flag OFF  
**Type:** Quotation UX workstream — **not** Commercial SSOT Phase 5  
**Authority:** Product-approved architecture (shared draft, explicit Save, session Undo)  
**UAT:** [`QUOTATION_COMMERCIAL_WORKSPACE_UAT.md`](./QUOTATION_COMMERCIAL_WORKSPACE_UAT.md) — Pass with defects

## Principle

There is **exactly one commercial editing pipeline**:

```text
Creators grid / Commercial Workspace / Bulk (staged)
  → shared QuotationRowDraft map
  → QuotationManualSaveProvider.registerLinePending
  → updateQuotationItemCommercials
  → applyQuotationMasterSyncIfLinked
  → CommercialSynchronizationService (+ audit / finance lock / revision)
```

No alternative write paths.

## Feature flag

| Env | Default when unset |
|---|---|
| Development / Preview | **ON** |
| Production | **OFF** |

Override:

```text
NEXT_PUBLIC_QUOTATION_COMMERCIAL_WORKSPACE=true|false
```

## Locked UX decisions

1. Shared draft with Creators grid  
2. Explicit Save only (no autosave)  
3. Session Undo/Redo (cleared on Save)  
4. V1 bulk ops: revenue/cost %, GP set/±, markup, discount, currency, FX, AF %  
5. Profitability bands Healthy / Warning / Critical (defaults ≥25% / ≥15% / &lt;15%)  
6. Frozen selection + quotation KPI totals; health counts; column prefs (localStorage); quick filters  

## Key files

- `features/quotations/components/quotation-commercial-workspace-dialog.tsx`
- `features/quotations/components/quotation-commercial-entry.tsx`
- `lib/quotations/commercial-workspace/*`
- Tests: `npm run test:commercial-workspace`

## Release

Preview → UAT → Production enablement of the flag only after explicit approval (same governance as Commercial SSOT / Productivity UX).
