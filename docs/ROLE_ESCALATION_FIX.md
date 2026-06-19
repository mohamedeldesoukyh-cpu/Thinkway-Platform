# Role Escalation Fix (ESC-01)

**Phase:** Go-Live Phase A — Critical Security Remediation  
**Date:** Jun 2026  
**Status:** Fixed in codebase — apply migration before production users

---

## Vulnerability

The RLS policy `profiles_update_self_or_admin` (`supabase/policies.sql`) allowed any authenticated user to update their own profile row (`id = auth.uid()`) with **no column-level restriction**. A user could call the Supabase client directly:

```typescript
supabase.from("profiles").update({ role_id: "<admin-role-uuid>" }).eq("id", userId);
```

Because RLS permitted the UPDATE, the user could escalate to `finance`, `admin`, or `super_admin`.

### Affected surfaces reviewed

| Surface | Finding |
|---------|---------|
| RLS `profiles_update_self_or_admin` | Allows self-update of all columns |
| `features/settings/actions.ts` | Admin paths use `requireSettingsWrite()` — OK |
| UI forms | Role changes only in settings admin UI — OK |
| Direct Supabase API | **Vulnerable** before fix |

---

## Fix

**Migration:** `supabase/migrations/20260629010000_profile_role_escalation_guard.sql`

A `BEFORE UPDATE` trigger `guard_profile_privileged_columns` blocks changes to:

- `role_id`
- `is_active`
- `status`

unless the caller has one of:

- `public.is_admin()` (super_admin / admin role slug)
- `public.has_permission('users.write')`
- `public.has_permission('settings.write')`

Service-role operations (`auth.uid()` IS NULL) are allowed for system flows.

### Error returned to attacker

```
Insufficient privileges to modify role or account status (SQLSTATE 42501)
```

---

## Deployment

```bash
npx supabase db push
# or apply migration 20260629010000 on production
```

### Verification (manual)

1. Sign in as a `viewer` user.
2. Attempt profile update with elevated `role_id` via Supabase SQL editor or client SDK.
3. Confirm trigger raises `42501`.
4. Sign in as admin; confirm role change via Settings → Users still works.

---

## Residual notes

- RLS policy remains permissive for non-privileged columns (name, avatar, etc.) — acceptable.
- Consider splitting policies (self vs admin) in a future hardening pass.
- Admin role assignments should continue to be logged via `access_logs` (existing behavior).

---

## Cross-references

- `docs/SECURITY_AUDIT.md` — ESC-01
- `docs/GO_LIVE_READINESS.md` — Condition 1
- `docs/PHASE_A_SECURITY_SIGNOFF.md` — sign-off status
