# Supabase CLI Target Investigation (SEC-001)

**Date:** 26 July 2026  
**Mode:** Read-only (no relink, no config changes, no migrations, no DB writes)  
**Related:** Enterprise Security Assessment SEC-001

---

## Verdict

| Question | Answer |
|----------|--------|
| Current CLI target (`supabase/.temp/project-ref`) | `pkozxsvdyswgmcqzohqd` |
| Display name in local metadata | `thinkway-production` |
| Classification | **Legacy / deleted / unused** — not current Dev or Prod |
| In org project list today? | **No** |
| DNS for `*.supabase.co` | **NXDOMAIN** (project gone) |
| Approved Development | `hsxrewjcbvmbkqdlzjhs` (`thinkway-dev`) — ACTIVE |
| Approved Production | `ienowhwfyxoqtzbgltno` (`thinkway-production`) — ACTIVE |
| App local `.env` target | Development (`hsxrewjcbvmbkqdlzjhs`) — correct |
| Remote CLI “linked” flag | Both approved projects report `linked=false` |

---

## Root cause

Local Supabase CLI state under gitignored `supabase/.temp/` was written on **2026-07-25 18:55:57 UTC** via `supabase link` (or equivalent metadata refresh) to a project that:

1. Had org display name **`thinkway-production`**
2. Had ref **`pkozxsvdyswgmcqzohqd`**
3. Existed **before** the current Production project was created

Current Production `ienowhwfyxoqtzbgltno` was created at **2026-07-25 19:25:27 UTC** (~30 minutes *after* the local link metadata). Migration work that evening used explicit `--db-url` / `scripts/.env.migration` against approved Dev/Prod and intentionally avoided the stale link (prior session note: “old unrelated project”).

The local link was **never updated** to `ienowhwfyxoqtzbgltno` or `hsxrewjcbvmbkqdlzjhs`. The old project was subsequently removed or became unreachable (not in `supabase projects list`; hostname does not resolve).

Additionally, `supabase/.temp/pooler-url` (written 14 minutes earlier) embeds a **third** dead ref `dmcpbsripfjrzqznwtss` — local `.temp` is internally inconsistent, not a single coherent live target.

---

## Evidence matrix

| Source | Value | Overrides CLI? |
|--------|-------|----------------|
| `supabase/.temp/project-ref` | `pkozxsvdyswgmcqzohqd` | **Yes** — default for `--linked` |
| `supabase/.temp/linked-project.json` | ref `pkozx…`, name `thinkway-production`, org `xcwkdeygprjrxwcgacfx` | Yes |
| `supabase/.temp/pooler-url` | pooler host for `dmcpbsripfjrzqznwtss` (dead) | Used by some linked DB ops |
| `supabase/config.toml` | **Absent** | N/A |
| Local `.env` `NEXT_PUBLIC_SUPABASE_URL` | `https://hsxrewjcbvmbkqdlzjhs.supabase.co` | App runtime only — **not** CLI link |
| `lib/deploy/build-info.ts` | Dev `hsxrewj…` / Prod `ienow…` | App/build alignment only |
| `scripts/.env.migration` | URLs for approved Dev + Prod only | Explicit dump/restore path |
| CI (`.github/`) | No undocumented project refs | N/A |
| Docs / continuity | Canonical allow-list only (plus this investigation) | N/A |
| `npx supabase projects list` | Only `hsxrewj…` + `ienow…`; both `linked=false` | Source of truth for live projects |

---

## How undocumented project became active

1. Operator (or tooling) ran `supabase link` against a then-live project named `thinkway-production` with ref `pkozxsvdyswgmcqzohqd` (same org).
2. That wrote gitignored `supabase/.temp/*` (not committed; not visible in PR review).
3. Same day, a **new** Production project `ienowhwfyxoqtzbgltno` was created and used for Dev→Prod migration via **connection strings**, not via refreshing the CLI link.
4. `pkozx…` left the org / DNS; local `.temp` remained stale.
5. No preflight script enforces allow-list before `db push` / `--linked`.

---

## Workflow risk (if someone runs CLI now)

| Command class | Likely outcome with current `.temp` |
|---------------|-------------------------------------|
| `supabase db push` / `db pull` / `db query --linked` / `gen types --linked` | Targets dead ref → **fail** (DNS / API), not silent write to approved Prod |
| Scripts using `--linked` (`setup-local-discovery.ps1`, `capture-validation-snapshot.ps1`, `verify-campaign-performance-schema.ts`) | Same failure mode |
| Explicit `--db-url` / Dashboard / Vercel env | Independent of `.temp`; can still hit Dev or Prod correctly if URL is correct |
| Name confusion (`thinkway-production`) | High — local metadata name matches **current** Prod display name but wrong ref |

**Residual risk:** Operator “fixes” by linking to the wrong project without allow-list check; or assumes `.temp` name means current Prod.

---

## Recommended correction (do not execute until approved)

1. **Classify `pkozxsvdyswgmcqzohqd` as retired** — no restore needed unless Dashboard recycle bin shows recoverable data (out of scope here).
2. **Clear or overwrite local link** (when approved):  
   - Default day-to-day: `npx supabase link --project-ref hsxrewjcbvmbkqdlzjhs`  
   - Production ops only with explicit approval: `npx supabase link --project-ref ienowhwfyxoqtzbgltno`
3. **Delete inconsistent `.temp/pooler-url`** by re-linking (link regenerates files) — do not hand-edit secrets into repo.
4. **Add `scripts/verify-supabase-link.mjs`** (allow-list: Dev + Prod only); gate docs/scripts that use `--linked` / `db push`.
5. **Prefer `--db-url` + project-ref assert** for any Production migration (pattern already used Jul 25).
6. **Optional:** commit a thin `supabase/config.toml` with project_id unset + comment pointing at allow-list (CLI still uses link for remote).

---

## Required changes (when remediation approved)

| Change | Env | Type |
|--------|-----|------|
| Relink CLI to Development | Local | Config (operator) |
| Allow-list verify script + docs | Repo | Code/docs |
| Update scripts that assume `--linked` | Repo | Code |
| Do **not** keep Production as default local link | Local | Policy |

---

## Risk assessment

| Risk | Severity | Notes |
|------|----------|-------|
| Accidental write to `pkozx…` | Low now | Project unreachable |
| Accidental write to wrong **live** project after naive relink | High | Name `thinkway-production` collision |
| Operator false confidence from `.temp` name | Medium | Metadata looks “production” |
| App pointing at wrong DB | Low (local) | `.env` correctly on Dev |
| CI targeting undocumented project | None found | |

**Overall:** Stale local CLI link is a **process/control failure**, not an active write into a live undocumented database. Treat as **P0 hygiene** before any further `supabase db *` work.
