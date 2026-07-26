# Preview Isolation Validation Report

**Date:** 2026-07-26  
**Control:** P0-1 — Preview Environment Isolation  
**Verdict:** **PASS**

## Objective

Ensure Preview deployments cannot use Production Supabase public credentials, and that Production remains on Production Supabase only.

## Actions taken

1. Removed shared `Production + Preview` association for:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Restored **Production-only** public Supabase URL + anon (project `ienowhwfyxoqtzbgltno`).
3. Configured **Preview (all branches)** public Supabase URL + anon → Development (`hsxrewjcbvmbkqdlzjhs`).
4. Configured **Preview (`develop`)** explicit overrides → same Development project.
5. Hardened `scripts/configure-dual-deployment-env.mjs` to use Vercel REST upserts (avoids `vercel env rm … preview` deleting Production when targets were shared).

### Operational note

`vercel env rm <name> preview` on a multi-target `Production, Preview` variable deletes the entire entry (including Production). During remediation this briefly removed Production public vars; they were restored immediately from Supabase project API keys and re-verified. Prefer the updated configure script / REST upserts going forward.

## Evidence

### Vercel env targets (post-change)

| Variable | Target | Git branch | Supabase ref (decrypted) |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | — | `ienowhwfyxoqtzbgltno` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | — | JWT `ref=ienowhwfyxoqtzbgltno` |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview | — (all) | `hsxrewjcbvmbkqdlzjhs` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview | — (all) | JWT `ref=hsxrewjcbvmbkqdlzjhs` |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview | `develop` | `hsxrewjcbvmbkqdlzjhs` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview | `develop` | JWT `ref=hsxrewjcbvmbkqdlzjhs` |

No remaining `Production, Preview` shared rows for these keys.

### Live host check

| Host | Endpoint | Result |
|---|---|---|
| `app.thinkwaymedia.com` | `/api/build-info` | `environment=production`, `supabaseProjectRef=ienowhwfyxoqtzbgltno`, `supabaseAligned=true` |

### Automated checks

Scripted decrypt/verify of all six env rows:

- `prod_url` / `prod_anon` → Production ref  
- `preview_url` / `preview_anon` → Development ref  
- `develop_url` / `develop_anon` → Development ref  
- `no_shared_prod_preview` → true  

Result: **P0_1_PASS**

## Validation matrix

| Requirement | Status |
|---|---|
| Production host → Production Supabase | **PASS** (live build-info + Production env decrypt) |
| Development host / Preview `develop` → Development Supabase | **PASS** (Preview `develop` env decrypt) |
| Any Preview deployment → Development Supabase | **PASS** (Preview all-branches env decrypt) |
| No Preview can communicate with Production via shared public Supabase env | **PASS** (no shared Production+Preview public keys) |

## Residual notes

- `SUPABASE_SERVICE_ROLE_KEY` remains **Production-only** (not attached to Preview). Preview/develop still needs a dedicated Development service role for server paths that require it (tracked under broader env isolation; not a public-key Preview→Prod leak).
- `REDIS_URL` remains Production-only until P0-3.
- Secret values are not recorded in this report. API key material briefly appeared in a local CLI session during recovery; rotate Production anon/service_role if that session log is considered exposed beyond operator control.

## Deliverable status

P0-1 complete. Safe to proceed to **P0-2 — Production Deployment Governance**.
