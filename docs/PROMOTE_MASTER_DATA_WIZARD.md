# Promote to Master Data Wizard

Enterprise onboarding flow for converting quotation-scoped temporary client/brand values into Thinkway master data (Group → Legal entity → Brand).

## UI entry

- **Path:** `/discovery/quotations/[id]` → Commercial lifecycle panel → **Promote to master data**
- **Dialog:** ~960px multi-step wizard (5 steps)

## Steps

| Step | Purpose |
|------|---------|
| 1 Client | Create new legal entity (default) or link existing (searchable by name, legal name, code) |
| 2 Brand | Create / link / skip — depends on client mode |
| 3 Group & ownership | Optional group; client owner, country manager, commercial owner (account manager) |
| 4 Onboarding | Mandatory “I understand…” acknowledgement |
| 5 Review | Summary + duplicate warnings + Promote |

## Promotion cases

| Case | Server action |
|------|----------------|
| New client + new brand | `insertClientWithClassificationAudit` + brand insert (`prospect`) |
| New client, no brand | Client only; quotation `brand_id` null |
| Existing client + existing brand | Link quotation; optional ownership patch |
| Existing client + new brand | Brand insert under client |

Post-promotion: clears `is_temporary_*` and temporary name fields; syncs linked shortlist; audit log `quotation.client_promoted` with old/new payload.

## Permissions

- Quotation write (or admin) + **`clients.write`** (Admin / Director / Manager)

## Database

Migration `20260706020000_client_onboarding_ownership.sql`:

- `clients.client_owner_id`
- `clients.country_manager_id`
- Commercial owner → existing `clients.account_manager_id`

Draft status maps to **`prospect`** (existing `client_status` enum).

## Key files

- `features/quotations/components/promote-master-data-wizard.tsx` — UI
- `features/quotations/promote-master-data-schema.ts` — validation & step gates
- `features/quotations/promote-master-data.ts` — execute promotion
- `features/quotations/lifecycle-actions.ts` — server entry + audit
- `features/quotations/queries.ts` — `getPromoteWizardOptions`
- `supabase/migrations/20260706020000_client_onboarding_ownership.sql`

## Tests

```bash
npx tsx features/quotations/promote-master-data.test.ts
```
