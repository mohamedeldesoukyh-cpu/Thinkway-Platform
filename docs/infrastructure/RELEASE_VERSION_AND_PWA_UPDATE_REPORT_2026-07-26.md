# Release Version Visibility & PWA Update Notifications

**Date:** 2026-07-26  
**Scope:** Version UI + service worker update lifecycle only — **no business logic changes**

---

## Verdict

Implemented and unit-tested locally. Deploy Preview/Production to validate installable PWA update prompts on Chrome/Edge; Safari uses limited SW support (version UI still works).

---

## 1. Files changed

### Added

| File | Purpose |
|---|---|
| `lib/release/release-info.ts` | Auto version / build / environment / deployment date |
| `lib/release/release-info.test.ts` | Environment mapping tests |
| `components/version/app-version.tsx` | Reusable `AppVersion` (menu + panel) |
| `app/(dashboard)/settings/about/page.tsx` | Settings → About |
| `app/sw.js/route.ts` | Dynamic SW (build id in body; no stale cache) |
| `components/pwa/pwa-update-prompt.tsx` | Update Now / Later modal |
| `docs/infrastructure/RELEASE_VERSION_AND_PWA_UPDATE_REPORT_2026-07-26.md` | This report |

### Modified

| File | Change |
|---|---|
| `next.config.ts` | Inject `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_GIT_SHA`, `NEXT_PUBLIC_BUILD_TIMESTAMP`, `NEXT_PUBLIC_VERCEL_ENV` from `package.json` + Vercel/Git env |
| `components/layout/user-account.tsx` | Version block + About link in profile menu |
| `components/layout/collapsible-app-sidebar.tsx` | About nav item |
| `components/layout/app-sidebar.tsx` | About nav item |
| `components/pwa/pwa-provider.tsx` | Register versioned SW URL; wire update prompt |
| `app/api/version/route.ts` | Align JSON with release info |
| `scripts/validate-pwa-branding.mjs` | Expect `app/sw.js/route.ts` instead of static `public/sw.js` |

### Removed

| File | Reason |
|---|---|
| `public/sw.js` | Replaced by dynamic route so each deploy changes SW bytes |

---

## 2. Version detection implementation

| Field | Source |
|---|---|
| **Thinkway Platform** | Constant product name in `getReleaseInfo()` |
| **Version** | `package.json` → `NEXT_PUBLIC_APP_VERSION` (via `next.config.ts`) |
| **Build** | Short Git SHA (`VERCEL_GIT_COMMIT_SHA` / `GITHUB_SHA` / `GIT_SHA`) or `local` |
| **Environment** | Mapped to `development` \| `preview` \| `production` from `NEXT_PUBLIC_THINKWAY_ENV` / `THINKWAY_ENV` / `VERCEL_ENV` |
| **Deployment Date** | `BUILD_TIMESTAMP` or build-time ISO from `next.config.ts` |

UI locations:

1. **User Profile Menu** — compact `AppVersion` + link to About  
2. **Settings → About** — full panel  

Nothing is hardcoded for version/build/env/date values.

---

## 3. Update notification flow

```text
Deploy → SW URL ?v=version.sha changes → browser updatefound
  → new worker reaches "installed" / waiting
  → if controller exists → show modal
  → Update Now → postMessage SKIP_WAITING → clients.claim → single reload
  → Later → session dismiss for this waiting scriptURL; next deploy shows again
  → First install (no controller) → auto SKIP_WAITING (no modal)
```

Guards:

- `reloadingRef` prevents infinite reload loops on `controllerchange`
- Network-only `fetch` handler (no Cache API) → no stale asset cache
- `updateViaCache: "none"` + periodic/`focus` `registration.update()`

---

## 4. Browser compatibility

| Surface | Version UI | SW update modal |
|---|---|---|
| Chrome (browser + installed PWA) | Yes | Yes |
| Edge (browser + installed PWA) | Yes | Yes |
| Safari (macOS/iOS) | Yes | Limited / often unavailable (Apple SW constraints); install still via Add to Home Screen |
| Firefox | Yes | Partial (SW supported; install UX varies) |

---

## 5. Manual testing steps

1. Deploy a Preview build; open app → confirm Profile menu shows Version / Build / Environment / Deployment Date.  
2. Open **Settings → About** — same values; match `/api/version`.  
3. Install PWA (Chrome/Edge) → standalone window; version still visible.  
4. Deploy a second build (new Git SHA). With PWA or tab still open, wait for focus/interval or reopen — expect update modal.  
5. **Later** → modal closes; no reload.  
6. Deploy again (or clear session dismiss) → modal returns.  
7. **Update Now** → one reload; new Build SHA in About; no reload loop.  
8. Confirm auth, dashboard, Discovery still function (untouched).

---

## Recommendations

- Optionally persist “Later” across sessions per build id in `localStorage` if product wants quieter prompts.  
- Run Lighthouse PWA after Production deploy of this change set.
