# API Audit — Thinkway Platform

**Release:** 1.0 Phase 0.1 Security Foundation  
**Scope:** All `app/api/**/route.ts` (37 routes)  
**Date:** Jul 2026

---

## Summary

| Metric | Count |
|--------|------:|
| Total routes | 37 |
| Public (intentional) | 1 |
| Cron (CRON_SECRET) | 2 |
| Permission-checked | 34 |
| Auth-only (deprecated) | 0 |

**Phase 0.1 result:** All non-public routes require authentication; write/export/search routes require explicit permission slugs.

---

## Route matrix

| Route | Methods | Auth | Permission | RLS | Phase 0.1 |
|-------|---------|------|------------|-----|-----------|
| `/api/build-info` | GET | Public | — | N/A | Documented |
| `/api/cron/publication-metrics` | GET | CRON_SECRET | — | Admin client | ✅ |
| `/api/cron/campaign-performance-monitor` | GET | CRON_SECRET | — | Admin client | ✅ |
| `/api/admin/campaign-performance/dashboard` | GET | Session | `operations.read` | ✅ | ✅ |
| `/api/admin/campaign-performance/health` | GET | Session | `operations.read` | ✅ | ✅ |
| `/api/ai/chat` | POST | Session | `ai.write` | ✅ | ✅ |
| `/api/ai/conversations` | GET, POST | Session | `ai.read` / `ai.write` | ✅ | ✅ |
| `/api/ai/conversations/[id]` | GET, PATCH, DELETE | Session | `ai.read` / `ai.write` | ✅ | ✅ |
| `/api/campaigns/influencers` | GET, POST | Session | `influencers.read` | ✅ | **Fixed** |
| `/api/campaigns/[id]/publications-bundle` | GET | Session | `campaigns.read` | ✅ | **Fixed** |
| `/api/campaigns/[id]/performance/document` | GET | Session | `analytics.read` | ✅ | **Fixed** |
| `/api/clients/[clientId]/documents` | POST | Session | `clients.write` | ✅ | **Fixed** |
| `/api/client-ios/[id]/document` | GET | Session | `client_ios.read` | ✅ | **Fixed** |
| `/api/vendor-ios/[id]/document` | GET | Session | `vendor_ios.read` | ✅ | **Fixed** |
| `/api/invoices/[id]/document` | GET | Session | `invoices.read` | ✅ | **Fixed** |
| `/api/creators/avatar` | GET | Session | `influencers.read` | ✅ | **Fixed** |
| `/api/creators/publication-preview` | GET | Session | `publications.read` | ✅ | **Fixed** |
| `/api/discovery/search` | GET | Session | `discovery.read` | ✅ | **Fixed** |
| `/api/discovery/jobs` | GET | Session | `discovery.read` | ✅ | **Fixed** |
| `/api/discovery/jobs/[id]` | GET | Session | `discovery.read` | ✅ | **Fixed** |
| `/api/discovery/import/files` | GET | Session | `discovery.write` | ✅ | **Fixed** |
| `/api/discovery/compare/document` | GET | Session | `discovery.read` | ✅ | **Fixed** |
| `/api/operations/campaigns` | GET | Session | `operations.read` | ✅ | **Fixed** |
| `/api/operations/vendors/[id]/assignments` | GET | Session | `operations.read` | ✅ | **Fixed** |
| `/api/quotations/[id]/export` | GET | Session | `discovery.read` | ✅ | **Fixed** |
| `/api/shortlists/[id]/export` | GET | Session | `discovery.read` | ✅ | **Fixed** |
| `/api/vendors/platform-accounts/enrich` | POST | Session | `influencers.write` | ✅ | ✅ (prior) |
| `/api/reports/client-profitability/document` | GET | Session | `analytics.read` | ✅ | **Fixed** |
| `/api/reports/daily/drilldown` | GET | Session | `analytics.read` | ✅ | **Fixed** |
| `/api/reports/pnl/document` | GET | Session | `analytics.read` | ✅ | **Fixed** |
| `/api/reports/revenue-by-function/document` | GET | Session | `analytics.read` | ✅ | **Fixed** |
| `/api/reports/spending-by-category/document` | GET | Session | `analytics.read` | ✅ | **Fixed** |
| `/api/reports/statements/document` | GET | Session | `analytics.read` | ✅ | **Fixed** |
| `/api/reports/top-clients/document` | GET | Session | `analytics.read` | ✅ | **Fixed** |
| `/api/reports/top-influencers/document` | GET | Session | `analytics.read` | ✅ | **Fixed** |
| `/api/reports/unsettled/document` | GET | Session | `analytics.read` | ✅ | **Fixed** |
| `/api/reports/vr/document` | GET | Session | `analytics.read` | ✅ | **Fixed** |

---

## Middleware behavior (updated)

| Request type | Unauthenticated response |
|--------------|-------------------------|
| `/api/*` | JSON `{ error: "Unauthorized" }` HTTP 401 |
| `/api/cron/*` + valid Bearer | Pass through to route handler |
| Page routes | 302 redirect to `/login?next=...` |

Implementation: `lib/supabase/middleware.ts`, `lib/auth/routes.ts`

---

## Helpers

| Helper | Purpose |
|--------|---------|
| `requireApiPermission(supabase, slug)` | Auth + permission → 401/403 JSON |
| `requirePermission(supabase, slug)` | Server actions / shared logic |
| `logAuditEvent()` | Audit trail for exports/writes |

---

## Phase B recommendations

| ID | Item | Priority |
|----|------|----------|
| API-B01 | Rate limiting on PDF/Puppeteer routes | P1 |
| API-B02 | Explicit audit on all report exports | P2 |
| API-B03 | `requirePermission()` on remaining server actions | P1 |
| API-B04 | API key auth for programmatic integrations | P3 |

---

## Cross-references

- Prior audit: `docs/API_SECURITY_AUDIT.md`
- Permission slugs: `docs/security/PERMISSION_MATRIX.md`
