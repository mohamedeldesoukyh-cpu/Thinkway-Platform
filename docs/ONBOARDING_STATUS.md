# Client Onboarding Status

Enterprise onboarding pipeline for legal entities promoted from quotations (and future direct client creation flows).

## Status enum (`client_onboarding_status`)

| Status | Meaning |
|--------|---------|
| `draft` | Pre-promotion / incomplete intake |
| `legal_pending` | **Default after promote-to-master-data** — awaiting legal docs |
| `finance_pending` | Legal complete; awaiting finance approval / client code |
| `ready` | Finance approved; contracts/tax may still be open |
| `active` | All checklist sections complete — operational for campaigns |

## Automatic transition rules

| Rule | Trigger | New status | Side effects |
|------|---------|------------|--------------|
| 1 | Promote to master data | `legal_pending` | `onboarding_updated_by`; audit `client.promoted` |
| 2 | Legal checklist checked | `finance_pending` | `legal_completed_at`, `onboarding_updated_by`; audit `client.onboarding_status_changed` |
| 3 | Finance checklist checked | `ready` | `finance_completed_at`; audit on status change |
| 4 | All four sections checked | `active` | `contracts_completed_at`, `tax_completed_at`, `activated_at`, `onboarding_completed_by`, `clients.status = active`; audit on status change |

Status is derived from checklist completion via `deriveOnboardingStatusFromCompletion()` in `lib/clients/onboarding-status.ts`. Server actions apply updates in `features/clients/onboarding-actions.ts`.

## Manual override (Rule 5)

Authorized roles may set onboarding status directly (forward transitions only):

- **Admin** → `super_admin`, `admin`
- **Director** → mapped to `admin` (no `director` slug in DB)
- **Finance** → `finance`
- **Commercial Director** → `account_manager`

Helper: `lib/clients/onboarding-permissions.ts` · action: `overrideClientOnboardingStatusAction`

Checklist edits require `clients.write` (Account Manager and above).

## Checklist sections (25% each)

Tracked via completion timestamps on `clients`:

- **Legal** → `legal_completed_at`
- **Finance** → `finance_completed_at`
- **Contracts** → `contracts_completed_at`
- **Tax** → `tax_completed_at`

Progress UI: `features/clients/components/onboarding-workspace.tsx` (editable checklist, autosave, timeline)

Read-only compact variant: `features/clients/components/onboarding-progress-tracker.tsx`

## Database

Migrations:

- `20260706030000_client_onboarding_hardening.sql` — status enum + checklist timestamps
- `20260706040000_client_onboarding_activated_at.sql` — `activated_at`

Columns on `clients`:

- `onboarding_status` (default `legal_pending`)
- `legal_completed_at`, `finance_completed_at`, `contracts_completed_at`, `tax_completed_at`
- `activated_at`
- `onboarding_completed_by`, `onboarding_updated_by`

Brands: `group_id` is **optional** (nullable) — group assignment is not required for promotion.

## Audit events

Stored in `audit_logs` (`entity_type = clients`) with `metadata.event`:

- `client.promoted`
- `client.onboarding_status_changed` — includes `previousStatus`, `newStatus`, actor, timestamp
- `client.duplicate_overridden`
- `client.existing_linked`

Helper: `lib/clients/onboarding-audit.ts`

Timeline on client profile reads these events via `features/clients/onboarding-queries.ts`.

## UI surfaces

- Promote wizard review step — onboarding badge
- Quotation workspace header — badge when master client linked
- Client list — status + onboarding badges
- Client profile Overview tab — editable checklist, status badge, progress %, timeline, manual override (privileged roles)

## Architecture

```
Promote wizard / checklist UI
        │
        ▼
features/clients/onboarding-actions.ts
        │
        ├── lib/clients/onboarding-transitions.ts  (compute payload + next status)
        ├── lib/clients/onboarding-status.ts       (derive status from completion)
        ├── lib/clients/onboarding-permissions.ts  (role gates)
        └── lib/clients/onboarding-audit.ts        (audit_logs)
```

## Tests

```bash
npx tsx lib/clients/onboarding-status.test.ts
npx tsx lib/clients/onboarding-audit.test.ts
npx tsx lib/clients/onboarding-transitions.test.ts
npx tsx features/quotations/promote-master-data.test.ts
```

Covers: automatic transitions (rules 2–4), manual override validation, permission helpers, activation flow, audit event keys.

## UI path (local dev)

`/clients/[id]` → Overview tab → **Onboarding progress** panel at top.
