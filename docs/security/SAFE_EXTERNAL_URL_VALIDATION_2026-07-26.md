# Safe External URL Validation — Validation Report

**Date:** 26 July 2026  
**Environment:** Development (code + unit tests). No Production deployment.  
**Related:** SEC-002 (portal `external_link` XSS / open redirect)

---

## Summary

Introduced a single shared URL validator (`lib/security/safe-external-url.ts`) and wired it into portal writes, IO attachments, client/vendor schemas, campaign publication URLs, discovery-import contact/avatar normalization, and key render paths via `SafeExternalLink` / `toSafeHref`.

---

## Inventory (high-value fields)

| Field | Write path | Validation now |
|-------|------------|----------------|
| `portal_uploads.external_link` | Portal creator/client actions | https-only `parseOptionalSafeExternalUrl` |
| `deliverables.content_url` (portal) | Same (external) or `storage://` | External branch validated; storage unchanged |
| `client_ios.attachment_url` | `updateClientIoAction` | https-only |
| `vendor_ios.attachment_url` | `httpsUrlSchema` (hardened) | https-only |
| `clients.website` | Client schemas | http(s) + bare-domain promote |
| Vendor `profile_url` / `influencer_url` / `profile_picture_url` | Vendor schemas | http(s) + promote |
| `campaign_publications.content_url` / `thumbnail_url` | Publication + performance actions/service | http(s) allowed |
| Import `contact_links` | `normalizeContactLink` | http(s)+mailto + promote; unsafe dropped |
| Import `profile_picture_url` | `discovery-import/normalize.ts` | http(s); unsafe dropped |
| Media proxy query URLs | `httpsUrlSchema` | https-only |

---

## Shared utility API

| Export | Role |
|--------|------|
| `parseSafeExternalUrl` | Validate + normalize absolute URL |
| `parseOptionalSafeExternalUrl` | Empty → `null`; else validate |
| `toSafeHref` | Render-time guard |
| `safeExternalUrlZod` / `optionalSafeExternalUrlZod` | Zod integration |
| `SafeExternalLink` | UI component using `toSafeHref` |

**Allowed schemes:** `https:` (default); `http:` / `mailto:` only when opted in.  
**Rejected:** `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, `about:`, `chrome:`, `chrome-extension:`, relatives, protocol-relative `//…`, encoded scheme bypasses.

---

## Automated tests

```bash
npx tsx --test lib/security/safe-external-url.test.ts
```

**Result:** 10/10 PASS — valid HTTPS; unsafe schemes; encoded javascript; relatives; http opt-in; bare-domain promote; optional empty; `toSafeHref`; mailto opt-in.

**Typecheck:** `npx tsc --noEmit` — clean.

---

## Behaviour preserved

- Portal file uploads + `storage://` content URLs still work (render shows “Stored file” when not http(s)).
- Staff can still save http publication/profile URLs where `allowHttp: true`.
- Contact mailto + bare domains still accepted via import/contact normalize.
- Discovery worker / SSRF allowlists unchanged (`ssrf.ts`).

---

## Production

Not deployed. Ship with next Development → approved Production app release (no DB migration required).

---

## Residual / follow-up

- Some older UI `href={profile_url}` sites still rely on write-time validation; prefer gradual `SafeExternalLink` adoption.
- Historical DB rows with unsafe schemes are neutralized at **render** via `toSafeHref` on updated surfaces; optional one-time cleanup script out of scope.
