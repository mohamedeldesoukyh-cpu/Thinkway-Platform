# Backlog — Fix Development schema validation environment credentials

**Status:** Open  
**Priority:** P2 (ops reliability)  
**Created:** 2026-07-28  
**Owner:** Platform / DevOps  
**Independent of:** Release 2.0 Campaign Lifecycle (do not block R2.0 on this item)

---

## Title

Fix Development schema validation environment credentials

---

## Problem

Automated / background schema validation against the linked Development Supabase project can fail with:

```text
LegacyDbConfigConnectTempRoleError
failed to connect as temp role
suggestion: SUPABASE_DB_PASSWORD
```

This is an **infrastructure/connectivity** failure, not evidence that migrations failed. Release 2.0 Phase 1 confirmed schema objects via a subsequent successful Dev query after the transient failure.

---

## Acceptance criteria

- [ ] Background schema validation connects successfully to Development (`hsxrewjcbvmbkqdlzjhs`)
- [ ] `SUPABASE_DB_PASSWORD` (or equivalent Supabase CLI DB auth) configured correctly for local/CI validation environments
- [ ] Automated schema validation restored (reliable `supabase db query --linked` / migration verify path)
- [ ] Documented in `docs/infrastructure/SECRETS_CHECKLIST.md` (or successor) without committing secrets
- [ ] Workstream remains **independent of Release 2.0 deployment**

---

## Non-goals

- Do not re-run or amend Release 2.0 migrations as part of this task
- Do not change Production credentials or Production schema
- Do not block Phase 1 Dev soak on this backlog item

---

## Suggested approach

1. Confirm Supabase CLI login + linked project ref  
2. Configure DB password for the login role / pooler path used by `supabase db query`  
3. Re-run a no-op schema probe (`information_schema` / `campaign_commercial_snapshots` exists)  
4. Optionally add a CI/ops smoke script that fails clearly on auth errors vs schema missing  

---

## Related

- Incident note: `docs/release/2.0/PHASE_1_VALIDATION.md` § Background schema validation  
- Project ref (Development): `hsxrewjcbvmbkqdlzjhs`  
