# Creator CRM Phase 2A — Operational Checks (pre–Phase 2B)

**Date:** 2026-07-27  
**Branch:** `develop` @ `3f31598`  
**Constraint:** No application code changes during these checks  

---

## 1. Writer gate environment verification

| Surface | Method | `CREATOR_CRM_WRITERS_ENABLED` | Result |
|---|---|---|---|
| Vercel Development env | `vercel env ls development` | Not listed (unset) | **PASS** — defaults OFF |
| Vercel Preview (incl. `develop`) | `vercel env ls preview` + `vercel env pull` | Absent from pulled Preview env | **PASS** |
| Vercel Production | `vercel env ls production` | Not listed | **PASS** (also OFF) |
| Local `.env` / `.env.local` | Grep | No `CREATOR_CRM_*` keys set | **PASS** |
| Local defaults | `.env.example` + `isCreatorCrmWritersEnabled()` | Documented commented `false`; code defaults OFF | **PASS** |
| Railway Discovery worker | `railway.toml` inspect; Railway CLI unavailable | No CRM vars in repo config; worker uses same Node default (unset → OFF) | **PASS with note** — confirm in Railway dashboard that the variable was never added manually |

**Verdict:** Writer gate remains OFF by default across Development surfaces reachable from this workspace. No env enables CRM writers.

---

## 2. Preview smoke (Browse / Shortlists / Search / Campaign Studio)

| Check | Method | Result |
|---|---|---|
| Preview build identity | `vercel curl /api/version` on develop Preview | **PASS** — `gitSha=3f31598`, `environment=preview`, Dev Supabase aligned |
| Route reachability | `vercel curl` `/discovery`, `/discovery/search`, `/discovery/shortlists`, `/studio`, `/discovery/import` | **PASS (auth gate)** — all return **307** redirect (session required); no 5xx |
| Interactive UI smoke (Browse, Shortlists, Discovery Search, Campaign Studio) | Browser automation | **BLOCKED** — Preview/Dev hosts require Vercel Deployment Protection SSO; agent cannot complete authenticated Thinkway session |

**Human follow-up (required to close this condition fully):**

While signed into the develop Preview (or `dev.thinkwaymedia.com` after SSO):

1. Open Discovery Browse / Search — confirm results load.  
2. Open Shortlists — list + open one shortlist.  
3. Open Campaign Studio (`/studio`) — picker loads.  
4. Confirm no CRM/Convert UI appeared and Vendors list behaviour unchanged.

Until that human pass is recorded, treat interactive smoke as **pending operator confirmation**.

---

## 3. Import pipeline (if active)

| Check | Result |
|---|---|
| Import Center route | `/discovery/import` returns 307 (auth) — surface exists on Preview |
| Live manual import | **Not executed** — same SSO/session blocker; no code change |

**If Import is actively used on Dev:** after login, run one offline/file import and confirm:

- Identity created/updated only (`ensureIdentityCreatorFromApifyData` / import upsert)  
- DNA staging/canonical behaviour unchanged  
- **No** `creator_crm_profiles` / activation events for the imported creator  

SQL spot-check (Dev):

```sql
SELECT count(*) FROM creator_crm_profiles;
SELECT count(*) FROM creator_crm_activation_events;
```

Expected while writers OFF: both remain `0` (or unchanged vs pre-import).

---

## 4. Summary

| Item | Status |
|---|---|
| Writers unset/false on Dev Vercel + local | **Complete / PASS** |
| Preview build healthy | **PASS** |
| Authenticated Preview UI smoke | **Needs operator (SSO)** |
| Manual import | **Needs operator if Import active** |

No Phase 2B implementation started. Next artifact: `CREATOR_CRM_PHASE2B_IMPLEMENTATION_PROPOSAL.md`.
