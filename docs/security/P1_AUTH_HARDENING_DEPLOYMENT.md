# P1 Auth Hardening — Deployment Guide

**Scope:** Invite token hashing, `/api/ready` lockdown, auth callback redirect sanitization, TOTP MFA for privileged roles.  
**Date:** 24 Jul 2026

---

## Artifacts

| Area | Paths |
|------|--------|
| Invite hashing | `lib/auth/invite-token.ts`, `features/settings/actions.ts` |
| Invite invalidation migration | `supabase/migrations/20260724170000_invalidate_plaintext_invites.sql` |
| Ready API | `app/api/ready/route.ts`, `lib/auth/ready-auth.ts` |
| Callback / `next` | `app/auth/callback/route.ts`, `lib/auth/routes.ts` |
| MFA | `lib/auth/mfa.ts`, `lib/auth/mfa-session.ts`, `features/auth/mfa-actions.ts`, `app/auth/mfa/*`, `app/(dashboard)/settings/security` |
| AAL2 enforcement | `lib/auth/permissions-server.ts` |
| Tests | `lib/auth/*.test.ts` |

---

## 1. Environment variables

Set on Vercel (and local `.env`):

```bash
READY_API_SECRET=<long-random-secret>
INVITE_TOKEN_SECRET=<long-random-secret>   # recommended
NEXT_PUBLIC_APP_URL=https://your-app.example
```

Supabase Dashboard → Authentication → Providers / MFA:

1. Enable **Multi-factor authentication** (TOTP).
2. Ensure email/password provider remains enabled.
3. Optional: set max factors per user as needed.

---

## 2. Database

```bash
supabase db push
# or apply migration 20260724170000_invalidate_plaintext_invites.sql
```

This **revokes all outstanding `invited` rows**. Admins must re-invite users.

---

## 3. Deploy application

Deploy the app build containing P1 changes **with** the migration.

### Verify invites

1. Invite a user from Settings → Users.
2. Confirm UI shows invite link once (copy).
3. Confirm server logs do **not** contain the raw token or full invite URL.
4. Confirm DB `user_invites.token_hash` is 64-char hex (not the raw token).

### Verify `/api/ready`

```bash
# Anonymous — must be exactly status ok
curl -sS https://<host>/api/ready
# {"status":"ok"}

# Detailed — secret
curl -sS -H "x-ready-api-secret: $READY_API_SECRET" https://<host>/api/ready
# full readiness report

# Detailed — admin browser session also works when signed in as admin/super_admin
```

### Verify callback

```text
/auth/callback?code=...&next=//evil.com     → redirects to /
/auth/callback?code=...&next=/campaigns   → /campaigns
```

### Verify MFA

1. Sign in as `admin` / `super_admin` / `finance` without TOTP → redirected to `/auth/mfa/enroll`.
2. Enroll authenticator and verify code → AAL2 session.
3. Privileged server actions fail with MFA error until AAL2.
4. Settings → Security for re-enroll / re-verify.

---

## 4. Tests

```bash
npm run test:auth-p1
```

Covers `sanitizeNextPath`, invite hashing, ready auth helpers, MFA role routing helpers.

---

## 5. Backward compatibility

| Change | Compatibility |
|--------|----------------|
| Invite hashes | New invites only; old invites revoked by migration |
| `/api/ready` public shape | Load balancers using body fields beyond `status` must switch to secret/admin |
| Callback | Safer redirects; valid relative `next` unchanged |
| MFA | Privileged roles must enroll; other roles unaffected |

---

## 6. Rollback notes

- Do **not** edit applied migrations.
- Rolling back app without re-opening ready details is safer than restoring plaintext invites.
- To temporarily relax MFA: remove AAL2 checks in `permissions-server.ts` via a new forward PR (not recommended in production).
