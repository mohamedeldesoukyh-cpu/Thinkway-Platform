# Migration Checklist

**Supabase migrations — staging then production**

---

## Before writing a migration

- [ ] Checked `docs/ARCHITECTURE_ALIGNMENT.md` — no duplicate entities
- [ ] RLS policies included for new tables
- [ ] Backward compatible or paired with app deploy order documented

## Staging

- [ ] `supabase db push` or CI migration job against staging project
- [ ] `supabase migration list` — local matches remote
- [ ] App deployed to staging with new code
- [ ] `/api/ready` healthy on staging
- [ ] Feature smoke test on staging

## Production

- [ ] Maintenance window communicated (if locking/long-running)
- [ ] Backup confirmed recent (Supabase dashboard)
- [ ] Apply migration to production Supabase
- [ ] Deploy app **after** migration (or same release if additive-only)
- [ ] `/api/ready` + `/api/build-info` verification
- [ ] Monitor Sentry/Vercel for 30 min post-deploy

## Rollback note

Prefer forward-fix migrations over `down` in production. See `ROLLBACK_CHECKLIST.md`.
