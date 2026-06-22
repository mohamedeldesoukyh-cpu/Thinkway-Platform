# Deployment Verification — Commit e0c77d6

**Target commit:** `e0c77d6` (`feature/campaign-client-bo-attachment`)  
**Verification date:** _______________  
**Environment:** ☐ Vercel preview ☐ Vercel production ☐ Custom domain  
**URL:** _______________________________________________

---

## 1. Build & commit verification

| # | Check | How | Pass | Result |
|---|-------|-----|:----:|--------|
| 1.1 | Correct commit deployed | Open `/api/build-info` → `gitShaShort` | ☐ | Expected: `e0c77d6` |
| 1.2 | No legacy env flags | `legacyAssignmentsEnvPresent: false` | ☐ | |
| 1.3 | Architecture version | `architecture.version` = `2026-06-clean-lifecycle-v1` | ☐ | |
| 1.4 | `npm run build` passed on Vercel | Vercel deployment log | ☐ | |
| 1.5 | `hints` array empty | `/api/build-info` → `hints: []` | ☐ | |

**Sample pass response:**

```json
{
  "gitShaShort": "e0c77d6",
  "legacyAssignmentsEnvPresent": false,
  "supabaseAligned": true,
  "productionReady": true
}
```

---

## 2. Environment variables

Verify in Vercel → Project → Settings → Environment Variables → **Production** (or Preview for pilot).

| Variable | Required | Set ☐ | Correct value ☐ | Notes |
|----------|----------|:-----:|:---------------:|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | ☐ | ☐ | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | ☐ | ☐ | Anon key only — never service role |
| `NEXT_PUBLIC_APP_URL` | Yes | ☐ | ☐ | Must match browser URL (IO approval links) |
| `OPENAI_API_KEY` | If AI classify | ☐ | ☐ | Client auto-classification |
| `SERPER_API_KEY` | If AI classify | ☐ | ☐ | Or Brave/Tavily alternative |
| Email provider key | If IO email | ☐ | ☐ | Resend/SMTP per config |
| `SUPABASE_SERVICE_ROLE_KEY` | **Must NOT be set** | ☐ N/A | ☐ Absent | Security |

**Test:** Redeploy after any env change; re-check `/api/build-info`.

---

## 3. Supabase connection

| # | Check | Steps | Pass |
|---|-------|-------|:----:|
| 3.1 | App connects to correct project | `/api/build-info` → `supabaseProjectRef` matches target | ☐ |
| 3.2 | `supabaseAligned: true` | Ref = `hsxrewjcbvmbkqdlzjhs` (pilot) or dedicated prod ref | ☐ |
| 3.3 | Login works | Sign in at `/login` → redirect to dashboard | ☐ |
| 3.4 | Session persists | Refresh page → still signed in | ☐ |
| 3.5 | Schema probes (authenticated) | Sign in → `/api/build-info` → `schema.authenticatedProbe: true` | ☐ |
| 3.6 | Operational columns readable | `schema.operationalStatusReadable: true` | ☐ |
| 3.7 | Vendor IO columns readable | `schema.vendorIoSupersededReadable: true` | ☐ |

**Fail remediation:** Apply missing migrations per `MIGRATION_VERIFICATION.md`; reload schema cache.

---

## 4. Storage buckets

Requires migration `20260629020000` applied.

| Bucket | Expected `public` | Verified ☐ | Test |
|--------|:-----------------:|:----------:|------|
| `vendor-io-documents` | `false` | ☐ | Generate VIO → PDF via app (not direct public URL) |
| `client-io-documents` | `false` | ☐ | Generate Client IO → PDF via app |
| `client-documents` | `false` | ☐ | Upload legal doc → download via paperclip |
| `influencer-documents` | `false` | ☐ | Vendor KYC upload if used |

**SQL verify:**

```sql
SELECT id, public FROM storage.buckets
WHERE id IN (
  'vendor-io-documents',
  'client-io-documents',
  'client-documents',
  'influencer-documents'
)
ORDER BY id;
```

---

## 5. Signed URLs

| # | Test | Steps | Expected | Pass |
|---|------|-------|----------|:----:|
| 5.1 | Vendor IO inline PDF | Campaign → VIO → View PDF (not download) | Redirects to `*.supabase.co/storage/v1/object/sign/...` OR serves PDF via API | ☐ |
| 5.2 | Vendor IO download | `?format=pdf&download=1` | PDF downloads; filename correct | ☐ |
| 5.3 | Client IO PDF | Client IO tab → export PDF | Same signed URL pattern | ☐ |
| 5.4 | Client legal document | Client → Legal → attach → view | Opens file; not a permanent public URL | ☐ |
| 5.5 | Unauthenticated storage URL | Paste signed URL in incognito after expiry | 403 or access denied | ☐ |

**Fail remediation:** Confirm `20260629020000` applied; confirm app deployed with `lib/io/io-document-storage.ts` (Phase A).

---

## 6. Authentication

| # | Test | Steps | Expected | Pass |
|---|------|-------|----------|:----:|
| 6.1 | Protected route redirect | Open `/campaigns` logged out | Redirect to `/login` | ☐ |
| 6.2 | Login success | Valid credentials | Dashboard loads | ☐ |
| 6.3 | Logout | Sign out | Session cleared; redirect login | ☐ |
| 6.4 | Invalid credentials | Wrong password | Error message; no access | ☐ |
| 6.5 | build-info without auth | GET `/api/build-info` | 200 JSON (no secrets) | ☐ |

---

## 7. Authorization

Test with role-specific test accounts (create in Settings → Users if missing).

| # | Test | Role | Action | Expected | Pass |
|---|------|------|--------|----------|:----:|
| 7.1 | Role escalation blocked | Account Manager | Attempt to change own role in DB/API | Error: insufficient privileges | ☐ |
| 7.2 | Viewer read-only | Viewer | Attempt create client | Denied / no UI | ☐ |
| 7.3 | Finance no campaigns | Finance | Attempt create campaign | Denied | ☐ |
| 7.4 | Finance billing access | Finance | Open billing / invoices | Allowed | ☐ |
| 7.5 | Enrich API gated | Viewer | POST `/api/vendors/platform-accounts/enrich` | 401/403 | ☐ |
| 7.6 | IO document auth | Logged out | GET `/api/vendor-ios/{id}/document` | 401 | ☐ |
| 7.7 | Client scope | AM (client A only) | Open client B workspace | Blocked by RLS | ☐ |

---

## 8. Post-deploy smoke (15 min)

Run in order after deploy of `e0c77d6`:

```
☐ 1. /api/build-info → gitShaShort = e0c77d6
☐ 2. Login as super_admin
☐ 3. /clients → list loads
☐ 4. /campaigns → list loads
☐ 5. Open campaign → Assignments tab
☐ 6. Billing tab loads (no hard refresh needed after IO)
☐ 7. Finance → one report export (HTML)
```

---

## 9. Verification summary

| Area | Status | Blocker if Fail |
|------|--------|-----------------|
| Build / commit | ☐ Pass ☐ Fail | Wrong code on server |
| Environment variables | ☐ Pass ☐ Fail | App cannot connect / wrong links |
| Supabase connection | ☐ Pass ☐ Fail | Migrations / schema cache |
| Storage buckets | ☐ Pass ☐ Fail | Phase A migration |
| Signed URLs | ☐ Pass ☐ Fail | Phase A code + migration |
| Authentication | ☐ Pass ☐ Fail | Auth config |
| Authorization | ☐ Pass ☐ Fail | RLS / role trigger |

---

## 10. Sign-off

| Role | Name | Date | Deployment verified |
|------|------|------|:-------------------:|
| Engineering | | | ☐ |
| Ops | | | ☐ |

---

## Cross-references

- `docs/MIGRATION_VERIFICATION.md`
- `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `docs/PILOT_LAUNCH_CHECKLIST.md`
