# Promote to Master Data Wizard

Enterprise onboarding flow for converting quotation-scoped temporary client/brand values into Thinkway master data (Group → Legal entity → Brand).

## UI entry

- **Path:** `/discovery/quotations/[id]` → Commercial lifecycle panel → **Promote to master data**
- **Dialog:** ~960px multi-step wizard (5 steps)

## Steps

| Step | Purpose |
|------|---------|
| 1 Client | Create new legal entity (default) or link existing; **debounced duplicate search** with Use existing / Continue creating |
| 2 Brand | Create / link / skip — same duplicate UX; **group not required** |
| 3 Group & ownership | **Optional** group; client owner, country manager, commercial owner |
| 4 Onboarding | Mandatory “I understand…” acknowledgement |
| 5 Review | Summary + duplicate warnings + onboarding badge + Promote |

## Promotion cases (all support no group)

| Case | Server action |
|------|----------------|
| New client + new brand | `insertClientWithClassificationAudit` + brand insert (`prospect`, optional `group_id`) |
| New client, no brand | Client only; quotation `brand_id` null |
| Existing client + existing brand | Link quotation; optional ownership patch |
| Existing client + new brand | Brand insert under client (optional group) |

Post-promotion:

- Clears `is_temporary_*` and temporary name fields
- Sets client `onboarding_status = legal_pending` (see `docs/ONBOARDING_STATUS.md`)
- Syncs linked shortlist
- Audit: `quotation.client_promoted` + client onboarding audit events

## Duplicate prevention

- Real-time debounced search (~400ms) on client/brand name fields
- Exact, case-insensitive, fuzzy, legal name, Arabic alias (`name_ar`), document code
- **Does not block** promotion — user can Continue creating (`clientDuplicateOverride` / `brandDuplicateOverride`)
- Use existing → switches wizard to link mode and pre-selects record

Server actions: `searchPromoteWizardDuplicateClients`, `searchPromoteWizardDuplicateBrands`

## Permissions

- Quotation write (or admin) + **`clients.write`** (Admin / Director / Manager)

## Database

Migrations:

- `20260706020000_client_onboarding_ownership.sql` — ownership columns
- `20260706030000_client_onboarding_hardening.sql` — optional brand group, onboarding status

## Key files

- `features/quotations/components/promote-master-data-wizard.tsx` — UI
- `features/quotations/components/duplicate-suggestion-panel.tsx` — duplicate UX
- `features/quotations/promote-master-data-schema.ts` — validation & step gates
- `features/quotations/promote-master-data.ts` — execute promotion + duplicate search
- `features/quotations/duplicate-search.ts` — scoring/ranking (unit tested)
- `features/quotations/lifecycle-actions.ts` — server entry + audit
- `lib/clients/onboarding-status.ts` — status/progress helpers
- `lib/clients/onboarding-audit.ts` — client audit events
- `features/clients/components/onboarding-progress-tracker.tsx` — reusable checklist UI

## Tests

```bash
npx tsx features/quotations/promote-master-data.test.ts
npx tsx features/quotations/duplicate-search.test.ts
npx tsx lib/clients/onboarding-status.test.ts
npx tsx lib/clients/onboarding-audit.test.ts
```

## Architecture summary

```
Quotation (temporary client/brand)
        │
        ▼
Promote wizard (5 steps, duplicate hints, optional group)
        │
        ▼
executePromoteMasterData
  ├─ create/link client (prospect + onboarding_status=legal_pending)
  ├─ create/link brand (optional group_id)
  ├─ patch quotation + shortlist
  └─ audit (quotation + client onboarding events)
        │
        ▼
Client profile onboarding tracker (Legal → Finance → Contracts → Tax)
```

See also: `docs/ONBOARDING_STATUS.md`
