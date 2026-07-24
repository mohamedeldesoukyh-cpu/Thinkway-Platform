# P4 – Workspace & Tenant Isolation Certification Report

**Date:** 2026-07-24  
**Scope:** Certify that client-facing Discovery / portal compromise cannot reach Thinkway internal Finance, Operations, Billing, Administration, or another client’s data.  
**Constraint:** Architectural certification — no platform redesign.

---

## Certification status

| Verdict | Status |
|--------|--------|
| **Workspace certification** | **CONDITIONAL PASS** |
| Automated suite | `npm run test:appsec-p4` — pass |
| Residual risk score (post-P3 baseline ~22) | **~14 / 100** after P4 controls + migrations |

**Conditional** on applying migrations listed in `P4_DEPLOYMENT.md` (especially P0 finance/FX RLS + P4 storage SELECT).

---

## What was certified

1. **Workspace classification registry** — every App Router page, API `route.ts`, Server Action module, worker, and cron resolves to exactly one class: `public | authenticated | client_workspace | internal_workspace | admin_only | service_only`. Unclassified APIs fail closed (403).
2. **Route isolation** — middleware + dashboard `InternalWorkspaceGate` block portal actors from internal/admin paths; UI hiding is not the sole control.
3. **Server Action isolation** — `requirePermission` rejects portal actors for any non-portal permission.
4. **AI isolation** — portal actors cannot use AI tools; billing report type denied; finance-shaped tool names blocked.
5. **Storage** — migration tightens `campaign-publication-media` SELECT to internal staff + permission.
6. **Service role** — `createSupabaseAdminClient` marked `server-only`; static test prevents Client Component imports.
7. **Workers / cron** — classified `service_only`; cron requires `CRON_SECRET`; enrichment jobs entity-scoped (`influencerId`).

---

## Architectural model

```
Public ──► Authenticated
              ├── Client Workspace (client-portal / creator-portal)
              └── Internal Workspace (staff Discovery, Campaigns, Finance, Ops, …)
                     └── Admin Only (system, admin APIs)
Service Only (cron, BullMQ workers) ──► never user JWT
```

**Tenancy note:** Thinkway is a single-agency internal platform. Staff may legitimately see multiple legal entities. Certification focus is:

- Portal / client-facing actor ↛ Finance / Ops / Admin / Discovery internals  
- Client A portal scope ↛ Client B data  
- AI / workers ↛ ambient cross-tenant or finance retrieval  

---

## Controls added (P4)

| Control | Location |
|--------|----------|
| Classification registry | `lib/security/workspace-classification-registry.ts` |
| Classify + fail-closed | `lib/security/workspace-classify.ts` |
| Actor resolution | `lib/security/workspace-actor.ts` |
| Path authorization | `lib/security/workspace-auth.ts` |
| Middleware enforcement | `lib/supabase/middleware.ts` |
| Dashboard hard edge | `components/layout/internal-workspace-gate.tsx` |
| Permission hard edge | `lib/auth/permissions-server.ts` |
| Post-login `next=` sanitization | `sanitizeNextPathForActor` in `lib/auth/routes.ts` |
| AI deny rules | `lib/security/ai-workspace-isolation.ts` |
| Storage RLS | `supabase/migrations/20260724180000_p4_campaign_publication_media_select.sql` |

---

## Discovered vulnerabilities (addressed or residual)

| Severity | Finding | Disposition |
|----------|---------|-------------|
| **High** | Finance/FX RLS `USING (true)` if P0 migrations not applied | Residual until `20260724150000` / `20260724160000` applied in target env |
| **Medium** | `campaign-publication-media` SELECT any authenticated | **Fixed** by P4 migration |
| **Medium** | Portal users could land on `/` (internal home) via failed scope / `?next=` | **Fixed** — middleware redirect + login sanitization + dashboard gate |
| **Medium** | Misconfigured role granting finance.* to portal user | **Mitigated** — portal actor check in `requirePermission` before permission matrix |
| **Low** | Admin client missing `server-only` | **Fixed** |
| **Low** | AI `generateReport` stub accepted `billing` + mock GP | **Mitigated** — billing denied; GP removed from stub |
| **Info** | Internal staff cross-client by design | Accepted — not a portal isolation defect |
| **Info** | Quotations/discovery-import SELECT by permission not owner-only | Residual — staff-side least privilege, not portal→internal |

---

## Boundary penetration (automated)

| Attempt | Expected | Covered by |
|---------|----------|------------|
| Client → Finance pages | Deny | `workspace-auth.test.ts` |
| Client → Operations | Deny | same |
| Client → Billing | Deny | same |
| Client → Admin APIs | Deny | same |
| Discovery APIs as portal | Deny | same |
| Unclassified API | Deny | classification + middleware |
| AI → billing report | Deny | `ai-workspace-isolation.test.ts` |
| Service role in Client Components | Deny | `service-role-guard.test.ts` |
| Storage open SELECT | Deny | migration + `storage-isolation.test.ts` |
| Worker without entity scope | Deny | `worker-tenant-isolation.test.ts` |

Live Tenant A→B RLS tests remain environment-backed (see residual risk).

---

## Related documents

- `TENANT_ISOLATION_MATRIX.md`
- `API_CLASSIFICATION_MATRIX.md`
- `SERVICE_ROLE_AUDIT.md`
- `STORAGE_SECURITY_REVIEW.md`
- `BACKGROUND_WORKER_SECURITY_REVIEW.md`
- `P4_DEPLOYMENT.md`
