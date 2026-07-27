# Prompt Summary — Current Sprint

**Branch focus:** `develop` (Development SSOT / official baseline).  
**Sync:** `0c94c99` — merged `main` → `develop` so Development contains all Production commits.  
**Ahead/behind:** `origin/main...origin/develop` = `0 4` (main not ahead).

## Done this sprint

- Restored Development-first Git workflow: merge `main` into `develop`, conflict resolved on worker provisioning plan (main/Executed).
- CI `validate.yml` now runs on `develop` (+ PRs targeting develop/main).
- Release/deployment docs updated for feature → develop → main → approved Production.
- Prior: dual-deploy, Ops Center, Dev/Prod Supabase split, continuity pack.

## Open / blocked

1. **GitHub branch protection** — configure in UI (`gh` unauthenticated locally): protect `main` (PR + CI, no direct push); protect `develop` (CI on PR).
2. **Restore Production `REDIS_URL`** on Vercel (if still missing).
3. **Dedicated Development Redis** for Preview/`develop`.
4. **DNS:** `app` / `dev.thinkwaymedia.com` → Vercel.
5. Do **not** merge develop → main or deploy Production unless explicitly approved.

## Working agreement

All implementation starts from `develop` → `feature/*` → `develop` → QA → `main` → approved Production. Never develop on `main`. Hotfixes on `main` must merge back to `develop` immediately.

**Branch gate (always):** verify current Git branch before any implementation; if not on `develop` or an approved feature branch from `develop`, stop and switch first. Rule: `.cursor/rules/thinkway-git-workflow.mdc`.
