# Thinkway Release Workflow

Permanent dual-deployment model.

| Surface | URL | Supabase | Redis | Git |
|---|---|---|---|---|
| **Development** | https://dev.thinkwaymedia.com | `hsxrewjcbvmbkqdlzjhs` | Development `REDIS_URL` | Branch `develop` (auto-deploy Preview) |
| **Production** | https://app.thinkwaymedia.com | `ienowhwfyxoqtzbgltno` | Production `REDIS_URL` | **Manual approval only** — no auto-deploy from `main` |
| **Local** | `localhost` | Development (default) | Local Redis | — |

The in-app **environment switch** navigates between hosts. It does **not** change databases inside a single running app.

## Phase 1 – Development (default)

1. Implement and test locally against Development Supabase.
2. Merge / push to `develop`.
3. Vercel Preview build deploys to `dev.thinkwaymedia.com` automatically.
4. Verify TypeScript, Build, Operations Center, Redis, BullMQ, Worker, Release Readiness.
5. Do **not** modify Production Supabase.

## Phase 2 – Production (approval required)

**Automatic Production deployments from `main` are disabled.**

Controls:

1. `vercel.json` → `git.deploymentEnabled.main = false` (no Git deploy created for `main`)
2. `github.autoAlias = false` (merges do not auto-alias Production)
3. `ignoreCommand` → `scripts/vercel-ignored-build-step.mjs` (skips any Production Git build if re-enabled)

### Approved Production deploy workflow

1. Provide a deployment summary (commit SHA, changes, risk, rollback).
2. Obtain **explicit human approval** for Production.
3. Deploy only via:

```bash
npx vercel deploy --prod --non-interactive
```

Optional: stage with `--skip-domain`, validate, then `npx vercel promote <deployment-url-or-id>`.

Do **not** rely on pushing to `main` to release Production.

## Environment variables

- **Preview** (Development host): Development Supabase + Development Redis + `THINKWAY_ENV=development`
- **Production**: Production Supabase + Production Redis + `THINKWAY_ENV=production`

Required public vars on both:

- `NEXT_PUBLIC_THINKWAY_ENV`
- `NEXT_PUBLIC_DEVELOPMENT_APP_URL=https://dev.thinkwaymedia.com`
- `NEXT_PUBLIC_PRODUCTION_APP_URL=https://app.thinkwaymedia.com`
- `NEXT_PUBLIC_APP_URL` (the URL of **that** deployment)

## DNS

Point both subdomains at Vercel (GoDaddy / DNS host):

```
dev   CNAME   cname.vercel-dns.com
app   CNAME   cname.vercel-dns.com
```
