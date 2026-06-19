# Deployment Guide — Thinkway Production

**Scope:** Vercel + Supabase production deployment checklist. Documentation only.  
**Reviewed:** Jun 2026  
**Existing docs:** `docs/DEPLOYMENT.md`, `docs/PRODUCTION_MANDATORY_DEPLOY.md`

---

## 1. Architecture overview

```
Users → Vercel (Next.js App Router) → Supabase (PostgreSQL + Auth + Storage + RLS)
                ↓
        Optional: Discovery worker (Redis + service role)
        Optional: Intelligence ETL (scripts, service role)
```

Application is **stateless** on Vercel. All persistent state lives in Supabase.

---

## 2. Production URLs

| Purpose | Recommended URL | Current / notes |
|---------|-----------------|-----------------|
| **Primary app** | `https://app.thinkway.com` | Configure in Vercel → Domains |
| **Alternate / legacy** | `https://platform.thinkway.com` | 301 redirect to primary (recommended) |
| **Preview** | `*.vercel.app` | Auto from PR branches |
| **Documented default** | `https://thinkway-platform.vercel.app` | Used in `docs/DEPLOYMENT.md` |

### DNS setup (Vercel)

1. Vercel project → **Settings → Domains**
2. Add `app.thinkway.com` → Production
3. Add `platform.thinkway.com` → redirect to `app.thinkway.com` (Vercel redirect rule or `vercel.json`)
4. Configure DNS at registrar:
   - `CNAME app` → `cname.vercel-dns.com`
   - Or A record per Vercel instructions

### HTTPS

- Vercel provisions **automatic TLS** (Let's Encrypt) for custom domains
- Enforce HTTPS — Vercel default; no HTTP downgrade
- Supabase API always HTTPS (`*.supabase.co`)

---

## 3. Configuration files reviewed

### `vercel.json`

```json
{
  "functions": {
    "app/api/vendor-ios/[id]/document/route.ts": { "memory": 1024, "maxDuration": 60 },
    "app/api/invoices/[id]/document/route.ts": { "memory": 1024, "maxDuration": 60 }
  }
}
```

- PDF generation routes get extended timeout and memory
- **No security headers** defined here — add if needed (see §6)

### `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
};
```

- Minimal config; Puppeteer for serverless PDF on Vercel
- No `images.remotePatterns` restrictions documented — review if external images added

### `middleware.ts`

- Matches all routes except static assets
- Delegates to `lib/supabase/middleware.ts` for session refresh + auth redirect
- **Does not set security headers**

---

## 4. Environment variables

### Vercel Production — required

| Variable | Example / source | Notes |
|----------|------------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Must match linked Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon | Never use service role here |
| `NEXT_PUBLIC_APP_URL` | `https://app.thinkway.com` | Invite links, IO approval URLs |

### Vercel Production — optional

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Alternative to anon key (`lib/supabase/env.ts`) |
| `VERCEL_GIT_COMMIT_SHA` | Auto-set by Vercel git integration |
| `META_GRAPH_ACCESS_TOKEN` | Instagram enrichment |
| `REDIS_URL` | Discovery queue (if discovery enabled in prod) |
| `OPENAI_API_KEY` | Discovery worker only — **not** on Vercel if worker is separate |

### Vercel Production — must NOT be set

| Variable | Reason |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS; scripts/worker only |
| `ASSIGNMENTS_RENDER_STAGE` | Legacy debug — removed |
| `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE` | Legacy |
| `ASSIGNMENTS_ALLOW_RENDER_BISECT` | Legacy |

### Build verification

After deploy, open:

```
https://app.thinkway.com/api/build-info
```

Expected (`lib/deploy/build-info.ts`):

| Field | Production target |
|-------|-------------------|
| `environment` | `production` |
| `gitSha` | Matches deployed commit |
| `supabaseAligned` | `true` |
| `supabaseProjectRef` | Production project ref (not dev unless intentional) |
| `legacyAssignmentsEnvPresent` | `false` |
| `architecture.version` | `2026-06-clean-lifecycle-v1` |
| `productionReady` | `true` |

**Current codebase expectation:** `EXPECTED_SUPABASE_PROJECT_REF = "hsxrewjcbvmbkqdlzjhs"` (thinkway-dev). **For true production go-live, create a separate Supabase project and update this constant + Vercel env.**

---

## 5. Supabase production checklist

### Project setup

- [ ] Create **production** Supabase project (separate from thinkway-dev)
- [ ] Enable **daily backups**, 30-day retention (`docs/BACKUP_AND_RECOVERY.md`)
- [ ] Enable PITR if plan allows
- [ ] Configure Auth: email provider, password policy, optional MFA for admins
- [ ] Restrict Auth redirect URLs to production domain(s)
- [ ] Link repo: `npx supabase link --project-ref <prod-ref>`

### Migrations

```bash
npx supabase migration list    # Local vs Remote must match
npx supabase db push           # Apply pending migrations
```

**Critical migrations for billing/IO lifecycle:**

- `20260531620000_billing_invoice_rls_hardening.sql`
- `20260603001000_thinkway_io_system.sql`
- `20260605010000_vendor_io_invoice_lifecycle.sql`
- `20260614010000_vendor_io_document_generation.sql`
- `20260618010000_client_io_document_generation.sql`
- All `20260608*` – `20260609*` clean lifecycle migrations

See `docs/PRODUCTION_MANDATORY_DEPLOY.md` for ordered apply + validation.

### Storage buckets

Verify buckets exist after migrations:

- `client-documents`, `influencer-documents`, `group-documents` (private)
- `vendor-io-documents`, `client-io-documents` (currently public — see security audit)

Apply `supabase/storage.sql` policies if not fully in migrations.

### Seed / bootstrap

- **Do not** run demo seed in production
- Promote first admin manually:

```sql
UPDATE public.profiles
SET role_id = (SELECT id FROM public.roles WHERE slug = 'super_admin')
WHERE id = '<auth-user-uuid>';
```

### RLS verification

Run after deploy:

```sql
-- From supabase/debug/invoice_line_items_rls_audit.sql
```

Sign in as finance user; re-open `/api/build-info` — `schema.operationalStatusReadable` should be `true`.

---

## 6. Security headers & redirects

### Recommended `vercel.json` additions (future — not implemented)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ],
  "redirects": [
    {
      "source": "https://platform.thinkway.com/:path*",
      "destination": "https://app.thinkway.com/:path*",
      "permanent": true
    }
  ]
}
```

**Current state:** Headers not configured in repo — rely on Vercel defaults. Add before enterprise security review.

### Auth redirect URLs (Supabase Dashboard)

Add to allowed redirect URLs:

- `https://app.thinkway.com/auth/callback`
- `https://app.thinkway.com/login`
- `http://localhost:3000/**` (development only)

---

## 7. Vercel deployment workflow

### Standard (git integration)

```bash
git push origin main   # or merge PR — Vercel auto-deploys Production
```

### Verify deploy

```bash
curl -s https://app.thinkway.com/api/build-info | jq '.gitShaShort, .supabaseAligned, .productionReady'
```

Compare `gitShaShort` with:

```bash
git log -1 --format=%h
```

### Emergency CLI deploy

```bash
npx vercel --prod
```

Use only when git integration unavailable.

### Function limits

PDF routes: 60s timeout, 1024 MB — monitor Vercel usage dashboard for timeouts.

---

## 8. Post-deploy validation

| # | Check | Pass |
|---|-------|------|
| 1 | `/api/build-info` — `productionReady: true` | |
| 2 | Login with admin user | |
| 3 | Create campaign — empty assignments (no bootstrap lines) | |
| 4 | Full lifecycle: assignment → VIO → invoice (`docs/CLEAN_LIFECYCLE_VALIDATION.md`) | |
| 5 | Hard refresh / incognito — no stale JS | |
| 6 | Finance user can access billing; viewer cannot write | |

---

## 9. Discovery & intelligence (optional modules)

| Module | Deploy target | Env |
|--------|---------------|-----|
| Discovery worker | Separate Node service / Railway / Fly.io | `REDIS_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` |
| Intelligence ETL | CI cron or manual ops | Service role JWT only |

**Do not** deploy discovery worker to Vercel serverless without queue infrastructure.

See `docs/INTELLIGENCE_ENVIRONMENT_CHECKLIST.md`, `docs/DISCOVERY_ENGINE.md`.

---

## 10. Rollback procedure

| Layer | Rollback |
|-------|----------|
| **App** | Vercel → Deployments → Promote previous production deployment |
| **Database** | Supabase restore from backup (see `docs/BACKUP_AND_RECOVERY.md`) — **not** reversible via Vercel |
| **Env vars** | Revert in Vercel dashboard + redeploy |

---

## Cross-references

- `docs/DEPLOYMENT.md` — quick operational checklist
- `docs/PRODUCTION_MANDATORY_DEPLOY.md` — clean lifecycle mandatory steps
- `docs/SECURITY_AUDIT.md` — pre-production security items
- `docs/MONITORING_SETUP.md` — post-deploy observability
- `docs/GO_LIVE_READINESS.md` — final gate
