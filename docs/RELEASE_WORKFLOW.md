# Thinkway Release Workflow

Permanent dual-deployment model.

| Surface | URL | Supabase | Redis | Git |
|---|---|---|---|---|
| **Development** | https://dev.thinkwaymedia.com | `hsxrewjcbvmbkqdlzjhs` | Development `REDIS_URL` | Branch `develop` (auto-deploy) |
| **Production** | https://app.thinkwaymedia.com | `ienowhwfyxoqtzbgltno` | Production `REDIS_URL` | Git Production only after approval |
| **Local** | `localhost` | Development (default) | Local Redis | — |

The in-app **environment switch** navigates between hosts. It does **not** change databases inside a single running app.

## Phase 1 – Development (default)

1. Implement and test locally against Development Supabase.
2. Merge / push to `develop`.
3. Vercel Preview build deploys to `dev.thinkwaymedia.com` automatically.
4. Verify TypeScript, Build, Operations Center, Redis, BullMQ, Worker, Release Readiness.
5. Do **not** modify Production Supabase.

## Phase 2 – Production (approval required)

Before any Production action, provide a deployment summary and wait for explicit approval.

Then deploy Production **only** via one of:

- `npx vercel deploy --prod --non-interactive` (approved CLI deploy), or
- Git commit to the Production branch whose message contains `[deploy-production]`

Unapproved pushes that would target Vercel Production are skipped by
`scripts/vercel-ignored-build-step.mjs`.

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
