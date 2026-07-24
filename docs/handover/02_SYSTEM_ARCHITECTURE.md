# 02 — System Architecture

## Stack

- Next.js App Router (TypeScript)
- Supabase (Postgres + Auth + Storage + RLS)
- Redis + BullMQ (`services/discovery-worker`)
- Vercel (app hosting)
- Feature modules under `features/*`

## Runtime entry points

| Layer | Path |
|-------|------|
| Edge/proxy | `proxy.ts` → request guard + session |
| Session | `lib/supabase/middleware.ts` |
| Server clients | `lib/supabase/server.ts`, `admin.ts` |
| Ops Center | `features/operations-center` |
| Worker | `services/discovery-worker/src/index.ts` |

## Domain modules

Campaigns, Discovery, Quotations, IO, Finance, Billing, Collections, Planning, AI workspace, Portals (client/creator), Settings, Operations Center.

## Canonical references

- `docs/THINKWAY_SYSTEM_REFERENCE.md`
- `docs/ARCHITECTURE_ALIGNMENT.md`
- `docs/REPO_ARCHITECTURE_SUMMARY.md`
- `docs/handover/DIAGRAMS.md`

