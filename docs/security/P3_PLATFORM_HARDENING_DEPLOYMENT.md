# P3 Platform Hardening — Deployment Notes

**Date:** 24 Jul 2026  
**Scope:** Rate limiting · Security headers · CSV/Excel formula injection · Dependency upgrades · Zod expansion · CSRF & cookie hardening  

---

## 1. Changed surface

| Area | Key paths |
|------|-----------|
| Rate limit | `lib/security/rate-limit.ts`, `rate-limit-policy.ts`, `request-guard.ts`, `proxy.ts` |
| Headers | `lib/security/security-headers.ts`, `next.config.ts` `headers()` |
| CSV/Excel | `lib/security/csv-formula.ts` + finance/discovery/creator/report exporters, `excel-report-builder.ts` |
| CSRF / cookies | `lib/security/csrf.ts`, `cookie-options.ts`, Supabase client/middleware/server/callback |
| Validation | `lib/validation/schemas.ts` + discovery search, operations APIs, finance posting schemas |
| Deps | `next@16.2.11`, `eslint-config-next@16.2.11` |
| Tests | `npm run test:appsec-p3` |

---

## 2. Environment

```bash
NEXT_PUBLIC_APP_URL=https://your-production-host
CSRF_ALLOWED_ORIGINS=https://your-production-host   # optional extras, comma-separated
CRON_SECRET=...   # mutating cron calls bypass CSRF via Bearer
READY_API_SECRET=...
```

Set on Vercel before deploy. `serverActions.allowedOrigins` is derived from `NEXT_PUBLIC_APP_URL` + `CSRF_ALLOWED_ORIGINS` + localhost.

---

## 3. Deploy steps

```bash
npm ci
npm run test:appsec-p3
# deploy Next app (Vercel)
```

No database migration required.

---

## 4. Verify

### Rate limiting
Burst `POST /login` or `POST /api/ai/chat` past category max → `429` with:

```json
{
  "error": "rate_limit_exceeded",
  "message": "...",
  "category": "auth|ai|...",
  "limit": 5,
  "retryAfterSec": 12
}
```

Headers: `Retry-After`, `X-RateLimit-*`.

### Security headers
```bash
curl -sI https://<host>/ | findstr /I "content-security-policy strict-transport x-frame permissions-policy cross-origin"
```

### CSV injection
Export a shortlist/aging CSV containing a notes cell `=cmd|' /C calc'!A0` → cell should appear as `'=cmd|...` in the file.

### CSRF
Cross-origin `POST /api/...` without secret → `403` `{ "error": "csrf_rejected" }`.  
Same-origin browser POSTs and cron Bearer continue to work.

### Cookies
In production DevTools → auth cookies: `Secure`, `SameSite=Lax`, **not** HttpOnly (required for Supabase browser client).

---

## 5. Compatibility notes

| Topic | Note |
|-------|------|
| Rate limit store | In-memory per instance. Fine for pilot; use Redis/Upstash for multi-region production. |
| HttpOnly cookies | **Must stay false** for `@supabase/ssr` `createBrowserClient`. Documented in `cookie-options.ts`. |
| COEP | Not applied to HTML (would break cross-origin creator media). COOP/CORP are set. |
| CSP | Allows `'unsafe-inline'` / `'unsafe-eval'` for Next + theme script. Tighten later with nonces. |
| `xlsx` | **Deferred** — community package has no clean fix; keep ExcelJS for writers; isolate `xlsx` parsers. |
| Next | Upgraded to **16.2.11** (advisory floor). |
| sanitize-html | Already at latest secure line (`2.17.x`). |
| Server Actions | `allowedOrigins` configured; CSRF Origin checks apply to mutating API + actions. |

---

## 6. Rollback

- Revert app deploy if headers/CSP break a specific integration; prefer CSP Report-Only temporary override via env in a follow-up if needed.
- Rate limiting can be relaxed by raising `RATE_LIMIT_RULES` constants (no env toggles in this sprint).

---

## 7. Residual risk (post-P3)

See `docs/security/application-security-audit.md` — residual score updated after P3.

Still open: Redis-backed rate limits, CSP nonce hardening, `xlsx` replacement, full Zod coverage, HttpOnly session migration (requires Supabase auth architecture change).
