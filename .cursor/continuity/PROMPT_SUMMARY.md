# Prompt Summary — Current Sprint

**Updated automatically after each significant milestone or sprint.**

**Branch focus:** `develop` (Development default).  
**Continuity pack:** `101ad5d` · Dual-deploy: `61783a8`.

## Done this sprint

- Migrated live Dev Supabase → empty Prod project `ienowhwfyxoqtzbgltno` (dump/restore; storage via APIs). Dev remains `hsxrewjcbvmbkqdlzjhs`.
- Ops Center: explainable health, environment-aware local messaging, Release Readiness card, Redis/worker diagnostics.
- Dual hosted deployments: `develop` → Dev Supabase; Production gated; env banner + cross-host switch.
- Continuity pack: Prompt / Summary / Prompt Summary under `.cursor/continuity/` (auto-refresh Prompt Summary on milestones).

## Open / blocked

1. **Restore Production `REDIS_URL`** on Vercel (accidentally removed during Preview split).
2. **Add dedicated Development Redis** for Preview/`develop` (not Production Redis).
3. **DNS:** `app` / `dev.thinkwaymedia.com` → Vercel (`A 76.76.21.21` or CNAME).
4. Disable automatic Production deploys from `main` in Vercel (approval should be structural).
5. Production deploy of banner/workflow commit — **only after explicit approval**.

## Working agreement

Continue from current project state. Development first; Production only with approval. Ops Center + `/api/build-info` for deploy verification.
