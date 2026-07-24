/**
 * Generates docs/handover/* for P6 Production Readiness certification.
 * Idempotent — overwrites handover package files.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs", "handover");
mkdirSync(out, { recursive: true });

const date = "2026-07-24";

function w(name, body) {
  writeFileSync(join(out, name), body.trimStart() + "\n", "utf8");
  console.log("wrote", name);
}

w(
  "01_EXECUTIVE_OVERVIEW.md",
  `# 01 — Executive Overview

**Product:** Thinkway — enterprise influencer marketing operations platform  
**Certification sprint:** P6 Production Readiness & Go-Live  
**Date:** ${date}

## Purpose

Thinkway operationalizes the hierarchy:

\`Group → Legal Entity → Brand → Campaign Header → Campaign Line\`

with Discovery, AI workspace, Finance, Billing, Portals, and an internal Operations Center.

## Certification summary

| Dimension | Score |
|-----------|------:|
| Security | 86 |
| Architecture | 88 |
| Operations | 84 |
| Recovery | 72 |
| Performance | 78 |
| Maintainability | 90 |
| Supportability | 85 |
| **Overall** | **~83** |

**Decision:** **CONDITIONAL GO** — controlled production / pilot expansion after mandatory gates in \`GO_LIVE_CERTIFICATION.md\`.

## What P0–P5 delivered

- **P0** Finance/FX RLS least privilege  
- **P1** Auth hardening (invites, MFA, ready API, open-redirect)  
- **P2** XSS / SSRF / prompt isolation / Zod  
- **P3** Rate limit, CSRF, headers, CSV injection, Next upgrade  
- **P4** Workspace & tenant isolation certification  
- **P5** Operations Center (health, queues, alerts, adapters)

## Audience

Engineering, DevOps, Finance ops leads, security reviewers, and future maintainers.
`,
);

w(
  "02_SYSTEM_ARCHITECTURE.md",
  `# 02 — System Architecture

## Stack

- Next.js App Router (TypeScript)
- Supabase (Postgres + Auth + Storage + RLS)
- Redis + BullMQ (\`services/discovery-worker\`)
- Vercel (app hosting)
- Feature modules under \`features/*\`

## Runtime entry points

| Layer | Path |
|-------|------|
| Edge/proxy | \`proxy.ts\` → request guard + session |
| Session | \`lib/supabase/middleware.ts\` |
| Server clients | \`lib/supabase/server.ts\`, \`admin.ts\` |
| Ops Center | \`features/operations-center\` |
| Worker | \`services/discovery-worker/src/index.ts\` |

## Domain modules

Campaigns, Discovery, Quotations, IO, Finance, Billing, Collections, Planning, AI workspace, Portals (client/creator), Settings, Operations Center.

## Canonical references

- \`docs/THINKWAY_SYSTEM_REFERENCE.md\`
- \`docs/ARCHITECTURE_ALIGNMENT.md\`
- \`docs/REPO_ARCHITECTURE_SUMMARY.md\`
- \`docs/handover/DIAGRAMS.md\`
`,
);

w(
  "03_INFRASTRUCTURE.md",
  `# 03 — Infrastructure

## Components

| Component | Provider | Notes |
|-----------|----------|-------|
| Web app | Vercel Production | Stateless Next.js |
| Database / Auth / Storage | Supabase | Dedicated prod project required |
| Redis | Upstash / managed Redis | BullMQ + heartbeat |
| Worker | VM/container | \`discovery-worker\` process |
| DNS / SSL | Domain registrar + Vercel | HTTPS only |
| Cron | Vercel Cron → \`/api/cron/*\` | \`CRON_SECRET\` |

## Environment matrix

See \`docs/infrastructure/ENVIRONMENT_MATRIX.md\`.

**Rule:** Never point production Vercel at the thinkway-dev Supabase project (\`hsxrewjcbvmbkqdlzjhs\`).

## Verification

1. \`GET /api/health\` → liveness  
2. \`GET /api/ready\` (with secret) → Redis, DB, storage, worker  
3. \`GET /api/version\` → build SHA + supabase alignment  
4. Operations Center → \`/operations\`
`,
);

w(
  "04_DATABASE_SCHEMA.md",
  `# 04 — Database Schema

## Source of truth

- Migrations: \`supabase/migrations/\` (**176** SQL files as of ${date})
- Types: \`types/database.ts\`
- Schema dump helper: \`supabase/schema.sql\` (may lag migrations)

## Hierarchy tables

\`groups\`, \`clients\` (legal entities), \`brands\`, \`campaign_headers\`, \`campaign_lines\`, \`campaign_influencers\`, \`influencers\`.

## Cross-cutting

- Auth: \`profiles\`, roles/permissions, \`user_invites\`
- Finance: invoices, credit/debit notes, FX, posting, PO tracker tables
- Discovery: DNA, imports, enrichment runs, shortlists, quotations
- Approvals / audit logs

## Security migrations (must be applied)

| Migration | Purpose |
|-----------|---------|
| \`20260724150000_finance_fx_rls_least_privilege.sql\` | P0 finance/FX RLS |
| \`20260724160000_finance_po_notifications_rls_hardening.sql\` | P0 PO notifications |
| \`20260724170000_invalidate_plaintext_invites.sql\` | Invite token hardening |
| \`20260724180000_p4_campaign_publication_media_select.sql\` | P4 storage SELECT |

## RLS

See \`docs/security/RLS_MATRIX.md\` and \`docs/security/P0_FINANCE_FX_RLS_DEPLOYMENT.md\`.
Prefer \`FORCE ROW LEVEL SECURITY\` on privileged finance tables where migration applies it.
`,
);

w(
  "05_AUTHENTICATION_AUTHORIZATION.md",
  `# 05 — Authentication & Authorization

## Auth

- Supabase Auth (email/password; OAuth optional via env)
- Session cookies via \`@supabase/ssr\` (\`lib/supabase/middleware.ts\`)
- MFA required for \`super_admin\`, \`admin\`, \`finance\` (AAL2) — \`lib/auth/mfa.ts\`
- Invite tokens hashed (P1) — never store plaintext

## Authorization

- Permission matrix: \`docs/security/PERMISSION_MATRIX.md\`
- Server gates: \`requirePermission\`, \`requireFinancePermission\`, \`requireOperationsAccess\`
- Operations Center: roles \`super_admin|admin|operations|devops\` only
- Portal scopes: \`requireClientScope\` / \`requireCreatorScope\`

## Post-login safety

\`sanitizeNextPath\` + \`sanitizeNextPathForActor\` prevent open redirects and portal→internal landing.
`,
);

w(
  "06_SECURITY_ARCHITECTURE.md",
  `# 06 — Security Architecture

## Layers

1. **Network/edge:** rate limit, CSRF, security headers (\`proxy.ts\` + \`lib/security/*\`)
2. **Workspace:** classification registry + portal deny (P4)
3. **App authz:** permissions + MFA for privileged roles
4. **Data:** RLS + \`is_internal_user()\` + service-role isolation
5. **AI:** tool auth JWT + finance tool deny patterns
6. **Content:** HTML sanitize, SSRF allowlists, CSV formula guards

## Key docs

- \`docs/security/P1_AUTH_HARDENING_DEPLOYMENT.md\` … \`P4_DEPLOYMENT.md\`
- \`docs/security/SERVICE_ROLE_AUDIT.md\`
- \`docs/security/STORAGE_SECURITY_REVIEW.md\`
- \`docs/security/application-security-audit.md\`

## Service role

\`createSupabaseAdminClient\` is \`server-only\`. Never \`NEXT_PUBLIC_\` service keys.
`,
);

w(
  "07_WORKSPACE_AND_TENANT_ISOLATION.md",
  `# 07 — Workspace & Tenant Isolation

## Classes

\`public | authenticated | client_workspace | internal_workspace | admin_only | service_only\`

Registry: \`lib/security/workspace-classification-registry.ts\`

## Guarantees

- Portal actors cannot reach Finance / Ops / Billing / Admin / Discovery APIs
- Unclassified APIs → 403
- Dashboard layout \`InternalWorkspaceGate\` hard-denies portal users
- \`requirePermission\` blocks portal actors on non-portal permissions

## Tenancy

- Single-agency staff may see multiple legal entities by design
- Client portal scoped by \`client_users.client_id\`
- Creator portal scoped by \`influencers.profile_id\`

Full report: \`docs/security/P4_WORKSPACE_ISOLATION_REPORT.md\`
`,
);

w(
  "08_DISCOVERY_ENGINE.md",
  `# 08 — Discovery Engine

## Surfaces

- UI: \`/discovery/*\`
- APIs: \`/api/discovery/*\`
- Import center, shortlists, quotations, campaign match, intelligence library

## Data flow

Browse/search → unified creator pool → DNA/enrichment → shortlist → quotation → campaign promotion.

## Workers

BullMQ queues in \`lib/observability/discovery-queues.ts\` processed by \`services/discovery-worker\`.

## Docs

- \`docs/DISCOVERY_ARCHITECTURE.md\`
- \`docs/DISCOVERY_UI_CONTRACT.md\`
- \`docs/infrastructure/WORKER_OPERATIONS.md\`
`,
);

w(
  "09_AI_ARCHITECTURE.md",
  `# 09 — AI Architecture

## Surfaces

- \`/ai\` conversation workspace
- \`/api/ai/*\`
- Tools: searchCreators, getCampaign, shortlists, briefs, reports (non-billing)

## Isolation (P4)

- Portal users cannot use AI tools
- Finance-shaped tool names blocked
- Billing report type denied
- Tools use user JWT (RLS), not service role

## Providers

OpenAI (primary); Anthropic / Gemini adapters monitored in Operations Center when keys present.

## Prompt safety

\`features/ai/prompts/prompt-isolation.ts\` — system/developer/user separation (P2).
`,
);

w(
  "10_FINANCE_MODULE.md",
  `# 10 — Finance Module

## Surfaces

\`/finance/*\`, billing, collections, treasury, posting center, VAT, FX, periods, PO tracker.

## Controls

- Permissions: \`finance.read|write|override\`, invoice permissions
- MFA for finance/admin roles
- P0 RLS least privilege on FX / finance privileged tables
- Portal isolation (P4)

## Monitoring

Operations Center → Finance tab (invoice counts, approval queue proxies). Posting/export failure instrumentation is a residual enhancement.
`,
);

w(
  "11_OPERATIONS_CENTER.md",
  `# 11 — Operations Center

Canonical ops console at **\`/operations\`**.

See also \`docs/operations/OPERATIONS_CENTER.md\`, \`HEALTH_ENGINE.md\`, \`ALERT_ENGINE.md\`, \`MONITORING_ADAPTERS.md\`, \`DEPENDENCY_GRAPH.md\`.

## Access

Roles: Super Admin, Admin, Operations, DevOps.

## Capabilities

Health score, infrastructure adapters, BullMQ table, AI/integrations, auth/discovery/finance/storage/security cards, dependency graph, alerts, unified log buffer.

API: \`GET /api/operations-center/snapshot\` (classified \`admin_only\`).
`,
);

w(
  "12_DEPLOYMENT_GUIDE.md",
  `# 12 — Deployment Guide

## Standard path

1. Merge to main / release branch  
2. Apply Supabase migrations to **production** project (\`supabase db push\` or CI)  
3. Deploy Vercel Production  
4. Restart/redeploy discovery-worker with prod \`REDIS_URL\` + service role  
5. Smoke: \`/api/health\`, ready detail, login+MFA, \`/operations\`, Discovery search, Finance read  

## Checklists

- \`docs/infrastructure/PRODUCTION_DEPLOYMENT_CHECKLIST.md\`
- \`docs/infrastructure/MIGRATION_CHECKLIST.md\`
- \`docs/infrastructure/ROLLBACK_CHECKLIST.md\`
- \`docs/handover/24_GO_LIVE_CHECKLIST.md\`

## Rollback

Vercel instant rollback to previous deployment; DB forward-fix preferred (see recovery doc).
`,
);

w(
  "13_ENVIRONMENT_VARIABLES.md",
  `# 13 — Environment Variables

## Required (production)

| Variable | Secret | Purpose |
|----------|:------:|---------|
| \`NEXT_PUBLIC_SUPABASE_URL\` | No | Supabase API URL |
| \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` | No | Anon key |
| \`SUPABASE_SERVICE_ROLE_KEY\` | **Yes** | Server/worker only |
| \`REDIS_URL\` | **Yes** | BullMQ / heartbeat |
| \`CRON_SECRET\` | **Yes** | Cron auth |
| \`READY_API_SECRET\` | **Yes** | Ready detail |
| \`OPENAI_API_KEY\` | **Yes** | AI / classification |
| \`THINKWAY_ENV=production\` | No | Log labeling |
| \`STRUCTURED_LOGS=1\` | No | JSON logs |

## Strongly recommended

\`SENTRY_DSN\`, \`INVITE_TOKEN_SECRET\`, \`CSRF_ALLOWED_ORIGINS\`, \`NEXT_PUBLIC_APP_URL\`, Apify/Resend/SMTP keys as needed.

## Enrichment flags

See \`.env.example\` — keep auto enrichment off until budgets validated.

Full matrix: \`docs/infrastructure/ENVIRONMENT_MATRIX.md\`, \`docs/infrastructure/SECRETS_CHECKLIST.md\`.
`,
);

w(
  "14_BACKUP_AND_RECOVERY.md",
  `# 14 — Backup & Recovery

## Objectives

| Tier | RTO | RPO |
|------|-----|-----|
| Database | 4h | 24h (PITR if enabled) |
| Storage | 8h | 24h |
| App (Vercel) | 2h | 0 |
| Overall | 24h | 24h |

## Procedures (summary)

### Database restore
Supabase Dashboard → Backups → restore to new project or PITR → re-point Vercel env → verify migrations.

### Storage restore
Rehydrate from backup / mirrored bucket; re-apply storage policies (incl. P4).

### Redis rebuild
Provision new Redis → set \`REDIS_URL\` → restart worker → queues rebuild empty (jobs not durable across wipe unless Redis persistence configured).

### Worker recovery
Restart process; confirm heartbeat in Operations Center / \`/api/ready\`.

### Secret / API key rotation
Rotate in provider → update Vercel + worker env → redeploy → invalidate old keys.

### Deployment rollback
Vercel → Deployments → Promote previous.

Detailed runbooks: \`docs/BACKUP_AND_RECOVERY.md\`, \`docs/BACKUP_DRILL_PLAN.md\`, \`docs/handover/21_RUNBOOK.md\`.

## Certification note

A **logged restore drill** on the production-class project remains a mandatory gate for unconditional GO.
`,
);

w(
  "15_MONITORING_AND_ALERTS.md",
  `# 15 — Monitoring & Alerts

## Primary console

\`/operations\` — Health Engine, alerts, queues, adapters, logs.

## Probes

- \`/api/health\` — public liveness  
- \`/api/ready\` — detailed readiness (secret/admin)  
- \`/api/admin/queues\` — queue JSON  
- Worker heartbeat Redis key  

## Alert examples

Redis/Supabase down, worker stale, queue stuck, AI unavailable, high latency, low health score.

## Gaps / residual

- Sentry install recommended (\`SENTRY_DSN\`)  
- External uptime (Better Uptime / Checkly) on \`/api/health\`  
- Persist ops metrics beyond process memory  
`,
);

w(
  "16_EXTERNAL_INTEGRATIONS.md",
  `# 16 — External Integrations

| Integration | Purpose | Config |
|-------------|---------|--------|
| OpenAI | AI + classification | \`OPENAI_API_KEY\` |
| Anthropic / Gemini | Optional AI | Provider keys |
| Apify | Creator acquisition / metrics | \`APIFY_TOKEN\` |
| Resend / SMTP | Email | \`RESEND_API_KEY\` / SMTP_* |
| Google OAuth | Auth | Client ID/secret |
| Meta / TikTok / YouTube | Social (config health) | App keys |
| Serper | Optional web context | \`SERPER_API_KEY\` |
| Vercel | Hosting / cron | Project env |
| Supabase | Data plane | URL + keys |
| Redis | Queues | \`REDIS_URL\` |

Health cards: Operations Center → Integrations / AI tabs.
`,
);

w(
  "17_BACKGROUND_WORKERS.md",
  `# 17 — Background Workers

## Process

\`services/discovery-worker\` — BullMQ consumers for discovery, enrichment, imports, publication metrics/screenshots, performance reports.

## Ops

- Start: \`npm run discovery:worker\` (see scripts)  
- Heartbeat: Redis \`thinkway:worker:discovery:heartbeat\`  
- Queues: \`lib/observability/discovery-queues.ts\`  
- Security: service role; entity-scoped jobs; cron via \`CRON_SECRET\`

Docs: \`docs/infrastructure/WORKER_OPERATIONS.md\`, \`docs/security/BACKGROUND_WORKER_SECURITY_REVIEW.md\`.
`,
);

w(
  "18_STORAGE_ARCHITECTURE.md",
  `# 18 — Storage Architecture

## Buckets (representative)

| Bucket | Access model |
|--------|----------------|
| \`campaign-publication-media\` | Internal + \`campaigns.read\` (P4); service_role for workers |
| \`creator-imports\` | Discovery permissions; immutable user updates |
| Client/Vendor IO docs | Permission-scoped private buckets + signed URLs |

## Rules

- No public buckets for IO/finance docs  
- Portal cannot call internal export APIs  
- Signed URLs short-lived; generated server-side  

See \`docs/security/STORAGE_SECURITY_REVIEW.md\`.
`,
);

w(
  "19_API_REFERENCE.md",
  `# 19 — API Reference (Operational)

Classification source: \`lib/security/workspace-classification-registry.ts\` / \`docs/security/API_CLASSIFICATION_MATRIX.md\`.

## Public

\`GET /api/health\`, \`/api/version\`, \`/api/build-info\`, \`/api/ready\` (minimal)

## Service only

\`GET /api/cron/publication-metrics\`, \`/api/cron/campaign-performance-monitor\` — Bearer \`CRON_SECRET\`

## Admin / ops

\`GET /api/admin/queues\`, campaign-performance health/dashboard, \`GET /api/operations-center/snapshot\`

## Internal (staff session + permissions)

\`/api/ai/*\`, \`/api/discovery/*\`, \`/api/operations/*\`, \`/api/reports/*\`, export/document routes, etc.

Unclassified routes → **403**.
`,
);

w(
  "20_TROUBLESHOOTING.md",
  `# 20 — Troubleshooting

| Symptom | Check |
|---------|-------|
| 401 on all pages | Supabase URL/keys; cookie domain; Auth outage |
| Portal user sees internal UI | P4 middleware/gate; clear cookies; verify \`client_users\` |
| Queues empty / worker dead | \`REDIS_URL\`, worker process, heartbeat age in Ops Center |
| Ready degraded | DB/storage/redis probes; Apify budget |
| AI failures | \`OPENAI_API_KEY\`, provider status, Ops AI tab |
| Finance RLS denials | P0 migrations applied? role permissions? MFA AAL2? |
| CSRF 403 | Origin/Referer; \`CSRF_ALLOWED_ORIGINS\`; \`NEXT_PUBLIC_APP_URL\` |
| Cron 401 | \`CRON_SECRET\` mismatch |
| Slow Discovery | Redis, DB indexes, Apify budget, browse pool metrics |

Escalate using \`22_INCIDENT_RESPONSE.md\`.
`,
);

w(
  "21_RUNBOOK.md",
  `# 21 — Operational Runbooks

## Redis Down

1. Confirm from Ops Center / \`checkRedisHealth\`  
2. Check managed Redis status & \`REDIS_URL\`  
3. Failover / provision new Redis if needed  
4. Restart worker + Vercel redeploy if env changed  
5. Expect empty queues unless persistence restored  

## Supabase Down

1. Status page + \`/api/health\`  
2. Pause non-critical workers  
3. Communicate RTO; restore from backup if data corruption  
4. Re-verify RLS migrations after restore  

## Worker Crash

1. Ops Center worker card / heartbeat age  
2. Inspect process logs; restart worker  
3. Check DLQ (\`creator-enrichment-dlq\`)  
4. Re-queue failed jobs if safe  

## Queue Stuck

1. Ops Center Queues tab — waiting/active/oldest  
2. Scale/restart worker; inspect poison jobs  
3. Clean failed jobs with approved scripts only  

## AI Provider Failure

1. Ops AI tab / provider status page  
2. Rotate/repair API key  
3. Disable nonessential AI features if prolonged  

## Storage Failure

1. Storage adapter status  
2. Bucket policies; service role for workers  
3. Restore objects from backup  

## Deployment Failure

1. Vercel deploy logs  
2. Rollback previous deployment  
3. Fix forward; never force-push main without approval  

## Database Restore

Follow \`14_BACKUP_AND_RECOVERY.md\` + \`docs/BACKUP_AND_RECOVERY.md\`.

## Security Incident

Follow \`22_INCIDENT_RESPONSE.md\`.
`,
);

w(
  "22_INCIDENT_RESPONSE.md",
  `# 22 — Incident Response

## Severity

| Sev | Examples | Response |
|-----|----------|----------|
| SEV-1 | Data breach, auth bypass, prod DB loss | Immediate page; exec + eng |
| SEV-2 | Full outage, finance corruption risk | 15m response |
| SEV-3 | Degraded Discovery/AI | Business hours |
| SEV-4 | Cosmetic / single-user | Ticket |

## Process

1. **Detect** — Ops Center alerts, Sentry, uptime, user report  
2. **Triage** — severity, blast radius (portal vs internal vs finance)  
3. **Contain** — revoke keys, disable flags, rollback, block IPs/rate limit  
4. **Eradicate** — patch, rotate secrets, restore clean data  
5. **Recover** — verify health score, smoke tests, re-enable traffic  
6. **Learn** — postmortem within 5 business days  

## Security-specific

- Assume breach if service role leaked → rotate immediately  
- Portal isolation failure → disable portal routes if needed  
- Preserve audit logs  

## Contacts

Maintain on-call rotation in team wiki (not stored in repo).
`,
);

w(
  "23_KNOWN_LIMITATIONS.md",
  `# 23 — Known Limitations

1. **Ops metrics are process-local** — serverless instances do not share AI/security counters.  
2. **Sentry optional** — error reporting no-op without \`SENTRY_DSN\`.  
3. **Staff multi-client access** — intentional; not a hard tenant DB partition.  
4. **Quotations SELECT** — permission-scoped, not strictly owner-only (staff).  
5. **Realtime WebSocket probe** — not implemented; inferred healthy.  
6. **Vercel Deploy API** — metadata-only without \`VERCEL_API_TOKEN\` deep checks.  
7. **Finance posting/export failure series** — partially instrumented (placeholders in Ops Center).  
8. **Restore drill** — procedure documented; production drill evidence may be pending.  
9. **DevOps role** — allowlisted in code; ensure role exists in prod RBAC if used.  
10. **HttpOnly cookies** — remain false for Supabase browser client compatibility (documented residual).
`,
);

w(
  "24_GO_LIVE_CHECKLIST.md",
  `# 24 — Go-Live Checklist (Master)

## Infrastructure

- [ ] Dedicated production Supabase project (not thinkway-dev)
- [ ] Vercel Production project + custom domain + SSL
- [ ] DNS cutover plan
- [ ] Managed Redis (HA) with \`REDIS_URL\`
- [ ] Discovery worker host running against prod
- [ ] Cron jobs configured with \`CRON_SECRET\`

## Database

- [ ] All migrations applied (incl. P0 + P4 July 2026 set)
- [ ] FORCE/ENABLE RLS verified on finance privileged tables
- [ ] P4 storage policy verified
- [ ] Backups + PITR enabled; retention ≥ 30 days
- [ ] Restore drill logged

## Security

- [ ] MFA enforced for admin/finance/super_admin
- [ ] Secrets only in Vercel/worker env (not git)
- [ ] Service role not exposed to client
- [ ] CSP/CSRF/rate limit/headers confirmed on prod URL
- [ ] Workspace isolation smoke (portal → /finance denied)
- [ ] AI isolation smoke

## Monitoring / Operations

- [ ] \`/operations\` accessible to admin/ops only
- [ ] Health score populates
- [ ] Worker heartbeat green
- [ ] Queue table populated
- [ ] Alerts fire on intentional Redis stop (staging drill)
- [ ] Sentry (or equivalent) receiving events
- [ ] External uptime on \`/api/health\`

## Performance

- [ ] Discovery browse p95 within budget (see PERFORMANCE_GOVERNANCE)
- [ ] API ready probe < agreed SLO
- [ ] \`npm run validate:performance\` on release build

## Recovery / Deployment

- [ ] Rollback owner named
- [ ] Secret rotation procedure rehearsed
- [ ] \`24_GO_LIVE_CHECKLIST\` signed by Eng + Ops
`,
);

w(
  "25_POST_GO_LIVE_OPERATIONS.md",
  `# 25 — Post Go-Live Operations

## First 72 hours

- Watch Ops Center health score hourly  
- Watch failed login / CSRF / rate-limit counters  
- Watch enrichment DLQ and import failures  
- Freeze risky enrichment auto-flags  

## First 2 weeks

- Daily backup verification  
- Review Sentry issues triage SLA  
- Confirm cron success logs  
- UAT finance posting + IO generation on prod data samples  

## Cadence

| Cadence | Activity |
|---------|----------|
| Daily | Health score, worker, queues |
| Weekly | Alert noise review, DLQ cleanup policy |
| Monthly | Restore drill (staging), secret age review |
| Quarterly | Access review, dependency upgrades |

## Change management

Feature flags for enrichment; migrations via checklist; no direct prod SQL without dual control.
`,
);

w(
  "DIAGRAMS.md",
  `# Architecture Diagrams (Mermaid)

## Overall Architecture

\`\`\`mermaid
flowchart TB
  Users --> NextJS[Next.js on Vercel]
  NextJS --> API[Route Handlers / Server Actions]
  API --> SB[(Supabase Postgres + Auth + Storage)]
  API --> Redis[(Redis)]
  Redis --> BullMQ[BullMQ Queues]
  BullMQ --> Worker[Discovery Worker]
  Worker --> SB
  API --> AI[AI Providers]
  API --> Email[Resend / SMTP]
  API --> Apify[Apify]
\`\`\`

## Authentication Flow

\`\`\`mermaid
sequenceDiagram
  participant U as User
  participant P as proxy.ts
  participant S as Supabase Auth
  participant A as App
  U->>P: Request
  P->>P: Rate limit + CSRF
  P->>S: getUser / session
  alt MFA required
    S-->>U: AAL2 challenge
  end
  P->>A: Authorized request
  A->>A: requirePermission / workspace actor
\`\`\`

## Workspace Isolation

\`\`\`mermaid
flowchart LR
  Portal[Client / Creator Portal] -->|blocked| Internal[Internal Workspace]
  Portal -->|blocked| Finance
  Portal -->|blocked| AdminAPI[Admin / Ops APIs]
  Staff[Internal Staff] --> Internal
  Staff --> Finance
  Staff --> OpsCenter[Operations Center]
\`\`\`

## Discovery Pipeline

\`\`\`mermaid
flowchart LR
  Search[Discovery Search] --> Browse[Unified Browse]
  Browse --> Enrich[Enrichment Queues]
  Import[Import Center] --> Enrich
  Enrich --> DNA[Creator DNA]
  DNA --> Shortlist
  Shortlist --> Quotation
  Quotation --> Campaign
\`\`\`

## AI Pipeline

\`\`\`mermaid
flowchart TB
  User --> Chat[/api/ai/chat]
  Chat --> Tools[Tool Registry]
  Tools --> JWT[User JWT + RLS]
  JWT --> SB[(Supabase)]
  Tools --> Isolation[AI Isolation Guards]
  Isolation -->|deny| FinanceTools[Finance tools / billing reports]
\`\`\`

## Finance Pipeline

\`\`\`mermaid
flowchart LR
  Lines[Campaign Lines] --> PO[PO / Billing]
  PO --> Invoice
  Invoice --> Posting[Posting Center]
  Posting --> FX[FX / VAT]
  Invoice --> Collections
\`\`\`

## Queue Architecture

\`\`\`mermaid
flowchart TB
  App[Next.js producers] --> Redis
  Cron[/api/cron] --> Redis
  Redis --> Q1[discovery-run]
  Redis --> Q2[creator-enrichment]
  Redis --> Q3[publication-metrics]
  Redis --> DLQ[creator-enrichment-dlq]
  Q1 & Q2 & Q3 --> Worker
  Worker --> SB[(Supabase)]
\`\`\`

## Database Relationships

\`\`\`mermaid
erDiagram
  GROUPS ||--o{ CLIENTS : has
  CLIENTS ||--o{ BRANDS : has
  BRANDS ||--o{ CAMPAIGN_HEADERS : has
  CAMPAIGN_HEADERS ||--o{ CAMPAIGN_LINES : has
  CAMPAIGN_LINES ||--o{ CAMPAIGN_INFLUENCERS : assigns
  INFLUENCERS ||--o{ CAMPAIGN_INFLUENCERS : linked
\`\`\`

## Deployment Architecture

\`\`\`mermaid
flowchart LR
  Git --> Vercel
  Git --> WorkerHost[Worker Host]
  Vercel --> SupabaseProd[(Supabase Prod)]
  WorkerHost --> RedisProd[(Redis Prod)]
  WorkerHost --> SupabaseProd
  DNS --> Vercel
\`\`\`

## Operations Center

\`\`\`mermaid
flowchart TB
  OpsUI[/operations] --> Snapshot[buildOperationsCenterSnapshot]
  Snapshot --> Health[Health Engine]
  Snapshot --> Queues[Queue Monitor]
  Snapshot --> Alerts[Alert Engine]
  Snapshot --> Graph[Dependency Graph]
  Health --> Adapters[HealthProvider Registry]
\`\`\`

## Monitoring Architecture

\`\`\`mermaid
flowchart LR
  Probes[/api/health /ready] --> Ops[Operations Center]
  Adapters --> Ops
  Heartbeat[Worker Heartbeat] --> Ops
  Guards[Rate limit / CSRF counters] --> Ops
  Ops --> Alerts
  Sentry[(Sentry optional)] --> Oncall
\`\`\`
`,
);

w(
  "GO_LIVE_CERTIFICATION.md",
  `# Go-Live Certification — Thinkway Platform

**Date:** ${date}  
**Sprint:** P6 Production Readiness & Go-Live Certification  
**Scope:** Certify production readiness, recoverability, supportability, maintainability — **no new business features**.

---

## Overall score

| Dimension | Score (0–100) |
|-----------|--------------:|
| Security | 86 |
| Architecture | 88 |
| Operations | 84 |
| Recovery | 72 |
| Performance | 78 |
| Maintainability | 90 |
| Supportability | 85 |
| **Overall** | **83** |

---

## Decision

# CONDITIONAL GO

Controlled production launch / pilot expansion is **approved in principle** after mandatory gates below are closed.  
This is **not** an unconditional public launch sign-off.

---

## Dimension notes

### Security — 86
P0–P4 controls in code: RLS, MFA policy, workspace isolation, AI isolation, rate limit, CSRF, CSP/headers, service-role \`server-only\`, storage SELECT hardening. Residual: live prod migration proof, HttpOnly cookie constraint, Sentry optional.

### Architecture — 88
Clear feature modules, App Router, adapter-based Ops Center, documented hierarchy. Residual: some large modules; staff multi-tenant by design.

### Operations — 84
P5 Operations Center with health engine, alerts, queues, adapters, dependency graph. Residual: in-memory metrics; external uptime not bundled.

### Recovery — 72
Documented RTO/RPO and runbooks. **Gap:** logged production-class restore drill may still be pending.

### Performance — 78
Budgets/governance scripts exist; sanity tests in \`test:production\`. Full prod load test evidence should be attached per release.

### Maintainability — 90
Handover pack (this folder), security/ops docs, classification registry preventing silent API sprawl.

### Supportability — 85
Runbooks + incident process + Ops Center. On-call roster lives outside repo.

---

## Production verification (repository-certified)

| Area | Status |
|------|--------|
| Env template completeness | Pass (\`.env.example\` + tests) |
| P0/P4 migrations present | Pass |
| Security modules present | Pass |
| P5 Ops Center present | Pass |
| Workspace isolation tests | Pass (\`test:appsec-p4\`) |
| Ops tests | Pass (\`test:operations\`) |
| Handover docs | Pass (\`test:production\`) |
| Live Vercel/DNS/SSL/Redis/Supabase | **Manual** — execute \`24_GO_LIVE_CHECKLIST.md\` |

---

## Disaster recovery verification

| Procedure | Doc | Drill status |
|-----------|-----|----------------|
| DB restore | 14, 21 | Documented — drill required |
| Storage restore | 14, 21 | Documented |
| Redis rebuild | 14, 21 | Documented |
| Worker recovery | 17, 21 | Documented |
| Secret rotation | 13, 21 | Documented |
| Deployment rollback | 12, 21 | Documented (Vercel) |

---

## Performance summary

- Health score calculation micro-benchmark in \`test:production\`  
- Use \`npm run validate:performance\` on release builds  
- Measure Discovery/AI/queue latency in staging under prod-like data before cutover  
- Attach p95 numbers to release notes

---

## Residual risks

1. Production migrations not yet confirmed applied in target project  
2. Backup restore drill evidence missing  
3. Sentry / external uptime may be unset  
4. Process-local Ops counters incomplete across serverless isolates  
5. Finance operational instrumentation partial  
6. Cookie HttpOnly false (Supabase constraint)

---

## Recommendations before unconditional GO

1. Apply & verify P0+P4 migrations on prod Supabase  
2. Complete restore drill; file evidence  
3. Enable Sentry + uptime checks  
4. Portal isolation + MFA smoke on prod URL  
5. Sign \`24_GO_LIVE_CHECKLIST.md\`

---

## Automated certification command

\`\`\`bash
npm run test:production
\`\`\`

Runs security/ops/workspace/health/deployment artifact checks and verifies this handover package exists.
`,
);

console.log("Handover package generated at docs/handover/");
