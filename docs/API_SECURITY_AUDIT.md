# API Security Audit — Critical / High Only

**Scope:** `app/api/**` routes  
**Date:** Jun 2026  
**Phase:** Go-Live Phase A

---

## Summary

| ID | Route | Severity | Auth | Permission | Status |
|----|-------|----------|------|------------|--------|
| API-01 | `POST /api/vendors/platform-accounts/enrich` | **High** | Was session-only via middleware | None | **Fixed** |
| API-02 | `GET /api/build-info` | Low | Public (intentional) | N/A | Documented — not Phase A |
| API-03 | `GET /api/reports/*/document` | Medium | `getUser()` | RLS/query layer only | Documented — not Phase A |
| API-04 | PDF routes DoS surface | Medium | `getUser()` | RLS | Documented — not Phase A |

---

## Critical / High findings

### API-01 — Platform account enrich (FIXED)

**File:** `app/api/vendors/platform-accounts/enrich/route.ts`

**Before:** Any authenticated user could POST enrichment requests (Meta/social lookups). Middleware only ensured a session existed.

**After:** Route calls `requirePermission(supabase, 'influencers.write')` before processing.

**Impact if unpatched:** Unauthorized users could trigger external API usage, scrape influencer data, or probe platform integration.

---

## High-context routes (auth present — no Phase A code change)

These routes require `getUser()` and rely on RLS. Listed for pilot awareness:

| Route | Auth | Notes |
|-------|------|-------|
| `/api/vendor-ios/[id]/document` | Yes | RLS on `vendor_ios`; now signed storage URLs |
| `/api/client-ios/[id]/document` | Yes | Same |
| `/api/invoices/[id]/document` | Yes | Invoice RLS hardening |
| `/api/reports/*/document` (8 routes) | Yes | Finance reports — consider explicit `analytics.read` in Phase B |
| `/api/discovery/search`, `/api/discovery/jobs` | Yes | Discovery RLS |
| `/api/campaigns/influencers` | Partial | Browse mode creates server client; search delegates to queries with RLS |
| `/api/operations/campaigns` | Via query | `getCampaignsForMovement()` → `requireUser()` |
| `/api/operations/vendors/[id]/assignments` | Via query | `getVendorAssignmentsForMovement()` → `requireUser()` |

---

## Public endpoints (documented)

| Route | Purpose | Risk |
|-------|---------|------|
| `/api/build-info` | Deploy/schema probe | Low info disclosure (git SHA, Supabase ref) |

Middleware public allowlist: `/login`, `/auth/*`, `/io-approval/*`, `/api/build-info` (`lib/auth/routes.ts`).

---

## Middleware behavior

Unauthenticated API requests receive **302 redirect to `/login`**, not JSON 401. Acceptable for browser use; programmatic clients should follow redirects or send session cookies.

---

## Phase A fixes applied

1. `app/api/vendors/platform-accounts/enrich/route.ts` — auth + `influencers.write`

---

## Phase B recommendations (not implemented)

- Explicit permission checks on report export routes (`analytics.read` / finance permissions)
- Rate limiting on Puppeteer PDF routes (`maxDuration: 60`, 1GB memory in `vercel.json`)
- JSON 401 branch in middleware for `/api/*` when `Accept: application/json`

---

## Cross-references

- `docs/SECURITY_AUDIT.md` §5
- `docs/PHASE_A_SECURITY_SIGNOFF.md`
