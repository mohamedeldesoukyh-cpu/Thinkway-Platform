# 06 — Security Architecture

## Layers

1. **Network/edge:** rate limit, CSRF, security headers (`proxy.ts` + `lib/security/*`)
2. **Workspace:** classification registry + portal deny (P4)
3. **App authz:** permissions + MFA for privileged roles
4. **Data:** RLS + `is_internal_user()` + service-role isolation
5. **AI:** tool auth JWT + finance tool deny patterns
6. **Content:** HTML sanitize, SSRF allowlists, CSV formula guards

## Key docs

- `docs/security/P1_AUTH_HARDENING_DEPLOYMENT.md` … `P4_DEPLOYMENT.md`
- `docs/security/SERVICE_ROLE_AUDIT.md`
- `docs/security/STORAGE_SECURITY_REVIEW.md`
- `docs/security/application-security-audit.md`

## Service role

`createSupabaseAdminClient` is `server-only`. Never `NEXT_PUBLIC_` service keys.

