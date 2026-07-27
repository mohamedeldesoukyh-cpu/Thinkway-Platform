# Security Checklist — Production

Use before any Production promote. Deeper audits: `docs/security/*`, `docs/SECURITY_AUDIT.md`.

## Authentication & session

- [ ] Server paths use `getUser()` (not trusting client `getSession()` alone)
- [ ] Privileged roles enforce MFA AAL2 where configured
- [ ] Invite / IO approval tokens are hashed at rest
- [ ] Open-redirect sanitizers cover post-login `next` paths

## Authorization

- [ ] Mutating APIs use `requireApiPermission` / `requirePermission`
- [ ] Portal actors cannot obtain internal workspace permissions
- [ ] Finance / creator-intelligence RLS least-privilege still applied (FORCE RLS)
- [ ] Quotation export requires `discovery.read` + audit (stabilised 2026-07-27)

## Secrets & env

- [ ] No `NEXT_PUBLIC_*SERVICE_ROLE*`
- [ ] Production Redis ≠ Development Redis
- [ ] Production Supabase ≠ Development Supabase
- [ ] `CRON_SECRET` / `READY_API_SECRET` set on Production
- [ ] `CREATOR_CRM_WRITERS_ENABLED` **unset** on Production

## XSS / uploads / CSRF

- [ ] Portal `external_link` validated on write + `SafeExternalLink` on render
- [ ] Entity uploads reject empty / non-allowlisted MIME
- [ ] CSRF origin checks on mutating methods (proxy)
- [ ] IO HTML rendered via sanitizer / `SafeHtml`

## Rate limiting & abuse

- [ ] Note: in-memory rate limits are per-instance — plan Redis/Upstash for multi-instance (architectural)

## Dependencies

- [ ] Track `xlsx` replacement (known CVEs) — architectural decision pending

## Do not change without architecture approval

- Auth cookie `httpOnly: false` (Supabase SSR browser client)
- Admin / super_admin permission bypass model
- Portal ↔ internal isolation contract
- CSP dropping `unsafe-inline` without nonce strategy
