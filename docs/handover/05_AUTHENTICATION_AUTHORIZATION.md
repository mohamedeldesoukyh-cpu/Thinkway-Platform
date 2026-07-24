# 05 — Authentication & Authorization

## Auth

- Supabase Auth (email/password; OAuth optional via env)
- Session cookies via `@supabase/ssr` (`lib/supabase/middleware.ts`)
- MFA required for `super_admin`, `admin`, `finance` (AAL2) — `lib/auth/mfa.ts`
- Invite tokens hashed (P1) — never store plaintext

## Authorization

- Permission matrix: `docs/security/PERMISSION_MATRIX.md`
- Server gates: `requirePermission`, `requireFinancePermission`, `requireOperationsAccess`
- Operations Center: roles `super_admin|admin|operations|devops` only
- Portal scopes: `requireClientScope` / `requireCreatorScope`

## Post-login safety

`sanitizeNextPath` + `sanitizeNextPathForActor` prevent open redirects and portal→internal landing.

