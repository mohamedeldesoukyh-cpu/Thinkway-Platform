# 12 — Deployment Guide

## Standard path

1. Merge to main / release branch  
2. Apply Supabase migrations to **production** project (`supabase db push` or CI)  
3. Deploy Vercel Production  
4. Restart/redeploy discovery-worker with prod `REDIS_URL` + service role  
5. Smoke: `/api/health`, ready detail, login+MFA, `/operations`, Discovery search, Finance read  

## Checklists

- `docs/infrastructure/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `docs/infrastructure/MIGRATION_CHECKLIST.md`
- `docs/infrastructure/ROLLBACK_CHECKLIST.md`
- `docs/handover/24_GO_LIVE_CHECKLIST.md`

## Rollback

Vercel instant rollback to previous deployment; DB forward-fix preferred (see recovery doc).

