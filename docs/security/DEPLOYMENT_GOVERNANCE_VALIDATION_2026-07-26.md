# Deployment Governance Validation Report

**Date:** 2026-07-26  
**Control:** P0-2 — Production Deployment Governance  
**Verdict:** **PASS**

## Objective

Disable automatic Production deployments from `main`, require explicit manual approval before Production goes live, and prove a push to `main` does not create a Production deployment.

## Controls applied

| Control | Mechanism | Evidence |
|---|---|---|
| No Git auto-deploy from `main` | `vercel.json` → `git.deploymentEnabled.main = false` | Commit `1a10c8b` on `main` |
| No auto Production alias on GitHub merge | `vercel.json` → `github.autoAlias = false` | Same commit |
| Defense-in-depth ignore step | `ignoreCommand` → always skip Production Git builds | `scripts/vercel-ignored-build-step.mjs` |
| Project-level ignore command | Vercel API `commandForIgnoringBuildStep` | Set on project |
| No auto domain attach | Vercel API `autoAssignCustomDomains = false` | Staged Production requires promote even if a Prod build appears |

## Approved Production workflow (documented)

1. Ship and validate on `develop` → `dev.thinkwaymedia.com`.
2. Prepare deployment summary (SHA, changes, risk, rollback).
3. Obtain **explicit human approval**.
4. Deploy Production only via:

```bash
npx vercel deploy --prod --non-interactive
```

Optional staged path: `vercel deploy --prod --skip-domain` → validate → `vercel promote <id>`.

Do **not** use a push to `main` as a Production release mechanism.

Canonical doc: `docs/RELEASE_WORKFLOW.md` (updated).

## Push-to-main validation

| Step | Result |
|---|---|
| Commit on `main` | `1a10c8b` — *Disable automatic Production deployments from main.* |
| Push | `101ad5d..1a10c8b` → `origin/main` at ~2026-07-26T03:39:49Z |
| Deployments created after push | **0** |
| Production deployments for `1a10c8b` | **0** |
| Production Ready without approval | **Did not occur** |

Poll window: ~65 seconds after push (immediate + follow-up). Latest Production Ready remains prior deployment `dpl_EQFDAW6LW9LiMQAp8SuCxU8yELUE` (unrelated older commit).

Result: **P0_2_PUSH_TEST_PASS**

## Validation matrix

| Requirement | Status |
|---|---|
| Disable automatic Production deployments from `main` | **PASS** |
| Require explicit manual approval before Production deployment | **PASS** (CLI-only approved path) |
| Production cannot become Ready without approval | **PASS** for Git path (no deploy created) |
| Document deployment workflow | **PASS** (`docs/RELEASE_WORKFLOW.md`) |

## Residual notes

- CLI `vercel deploy --prod` remains the intentional Production path and is not blocked by the Git ignore step (by design).
- `autoAssignCustomDomains=false` means any future Production build (CLI) should be promoted deliberately if domains are not assigned at deploy time; operators must confirm domain assignment when using `--prod`.
- `develop` Preview auto-deploy remains enabled.

## Deliverable status

P0-2 complete. Safe to proceed to **P0-3 — Development Redis**.
