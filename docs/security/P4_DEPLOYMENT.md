# P4 Deployment Notes

## Pre-deploy checklist

1. Confirm P0–P3 controls already deployed (auth, RLS finance/FX, rate limit, headers, CSRF).
2. Run locally: `npm run test:appsec-p4`
3. Review registry if new APIs/pages were added on the branch.

## Migrations (required for full certification)

Apply in order (if not already applied):

| Migration | Purpose |
|-----------|---------|
| `20260724150000_finance_fx_rls_least_privilege.sql` | Close finance/FX `USING (true)` |
| Related P0 FX follow-ups (`20260724160000*` if present) | Finance isolation |
| `20260724180000_p4_campaign_publication_media_select.sql` | Storage SELECT least privilege |

```bash
npx supabase db push
# or your environment’s migration pipeline
```

## Application deploy

1. Deploy Next.js app (includes middleware workspace checks + dashboard gate).
2. Ensure env vars present (unchanged from P1–P3):
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `CRON_SECRET`
   - `READY_API_SECRET` (optional detail)
   - Invite / CSRF secrets as previously documented
3. Restart discovery-worker after deploy if queue payload types changed (no breaking change in P4).

## Smoke tests (staging)

1. **Portal client** session:
   - `GET /finance` → redirect to `/client-portal`
   - `GET /api/ai/chat` → 403
   - `GET /api/reports/pnl/document` → 403
2. **Internal staff** session:
   - `/finance`, `/discovery` load with normal permissions
3. **Cron**: `GET /api/cron/publication-metrics` without secret → 401
4. **Unclassified** (staging only): temporary route without registry entry → 403

## Rollback

- App rollback removes middleware/gate; restore previous deployment.
- Storage migration: re-introduce prior SELECT policy only if emergency; prefer forward-fix.
- Classification registry is fail-closed — removing an API from the registry blocks it until re-added.

## Certification after deploy

Mark **PASS** when:

- [ ] `test:appsec-p4` green in CI  
- [ ] P4 storage migration applied  
- [ ] P0 finance/FX RLS applied  
- [ ] Staging smoke tests above pass  

Until migrations apply: **CONDITIONAL PASS** (app-layer isolation active; DB/storage residual remains).
