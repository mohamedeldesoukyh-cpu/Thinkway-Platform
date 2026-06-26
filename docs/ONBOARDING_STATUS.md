# Client Onboarding Status

Enterprise onboarding pipeline for legal entities promoted from quotations (and future direct client creation flows).

## Status enum (`client_onboarding_status`)

| Status | Meaning |
|--------|---------|
| `draft` | Pre-promotion / incomplete intake |
| `legal_pending` | **Default after promote-to-master-data** — awaiting legal docs |
| `finance_pending` | Legal complete; awaiting finance approval / client code |
| `ready` | All checklist sections complete; not yet active for campaigns |
| `active` | Fully onboarded operational client |

## Checklist sections (25% each)

Tracked via completion timestamps on `clients`:

- **Legal** → `legal_completed_at`
- **Finance** → `finance_completed_at`
- **Contracts** → `contracts_completed_at`
- **Tax** → `tax_completed_at`

Progress UI: `features/clients/components/onboarding-progress-tracker.tsx`

## Database

Migration: `20260706030000_client_onboarding_hardening.sql`

Columns on `clients`:

- `onboarding_status` (default `legal_pending`)
- `legal_completed_at`, `finance_completed_at`, `contracts_completed_at`, `tax_completed_at`
- `onboarding_completed_by`, `onboarding_updated_by`

Brands: `group_id` is **optional** (nullable) — group assignment is not required for promotion.

## Audit events

Stored in `audit_logs` (`entity_type = clients`) with `metadata.event`:

- `client.promoted`
- `client.onboarding_status_changed`
- `client.duplicate_overridden`
- `client.existing_linked`

Helper: `lib/clients/onboarding-audit.ts`

## UI surfaces

- Promote wizard review step — onboarding badge
- Quotation workspace header — badge when master client linked
- Client list — status + onboarding badges
- Client profile — nav badge + progress tracker on Overview tab

## Tests

```bash
npx tsx lib/clients/onboarding-status.test.ts
npx tsx lib/clients/onboarding-audit.test.ts
npx tsx features/quotations/promote-master-data.test.ts
npx tsx features/quotations/duplicate-search.test.ts
```
