# Prompt Summary — Current Sprint

**Branch focus:** `develop` (Development default).  
**Last dual-deploy commit:** `61783a8` (banner + release workflow).

## Done this sprint

- Migrated live Dev Supabase → empty Prod project `ienowhwfyxoqtzbgltno` (dump/restore; storage via APIs). Dev remains `hsxrewjcbvmbkqdlzjhs`.
- Ops Center: explainable health, environment-aware local messaging, Release Readiness card, Redis/worker diagnostics.
- Dual hosted deployments: `develop` → Dev Supabase; Production gated; env banner + cross-host switch.
- Engineering continuity: Prompt / Summary / Prompt Summary under `.cursor/continuity/`.

## Open / blocked

1. **Restore Production `REDIS_URL`** on Vercel (accidentally removed during Preview split).
2. **Add dedicated Development Redis** for Preview/`develop` (not Production Redis).
3. **DNS:** `app` / `dev.thinkwaymedia.com` → Vercel (`A 76.76.21.21` or CNAME).
4. Production deploy of banner/workflow commit — **only after explicit approval**.

## Working agreement

Development first; Production only with approval. Prefer Ops Center + `/api/build-info` for deploy verification.
