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

**Automatic Production deployments from `main` are skipped by default.**

Controls:

1. `ignoreCommand` → `scripts/vercel-ignored-build-step.mjs`  
   - Vercel convention: **exit 0 = ignore build**, **exit 1 = continue build**
   - Production Git pushes without an override → ignored (canceled)
   - Preview / `develop` → always builds
2. `github.autoAlias = false` (merges do not auto-alias Production)
3. Approved CLI path remains available (not gated by the Git ignore step)

### Why a normal `main` push may show no Production deploy

Pushes such as `8084ca7` do not go live automatically: the ignored-build step
exits `0` for Production unless an explicit override is present. (Older
`git.deploymentEnabled.main = false` also prevented any Git deploy job from
being created at all.)

### Manual override — deploy a specific `main` commit via Git

Include one of these tokens in the **commit message**:

- `[deploy-production]`
- `[force-deploy]`

Example:

```bash
git commit -m "release: ship Media Plan start-date messaging [deploy-production]"
git push origin main
```

Emergency project env (remove after use):

```text
THINKWAY_FORCE_PRODUCTION_GIT_DEPLOY=1
```

### Approved Production deploy workflow (CLI)

1. Provide a deployment summary (commit SHA, changes, risk, rollback).
2. Obtain **explicit human approval** for Production.
3. Deploy via:

```bash
npx vercel deploy --prod --non-interactive
```

Optional: stage with `--skip-domain`, validate, then `npx vercel promote <deployment-url-or-id>`.

Prefer CLI for Production releases; use `[deploy-production]` only when a Git-triggered Production build is deliberately requested.

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
