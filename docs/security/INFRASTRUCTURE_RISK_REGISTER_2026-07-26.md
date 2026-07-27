# Infrastructure Risk Register — 26 Jul 2026

Companion to `PRODUCTION_INFRASTRUCTURE_READINESS_2026-07-26.md`.

| ID | Sev | Category | Title | Status | Priority |
|----|-----|----------|-------|--------|----------|
| INF-C01 | Critical | DR | No restore drill logged | Open | P0 |
| INF-C02 | Critical | Isolation | Preview shares Prod public Supabase | Open | P0 |
| INF-H01 | High | Release | Prod Git deploys without hard gate | Open | P0 |
| INF-H02 | High | Redis | No Dev Redis on Preview/develop | Open | P0 |
| INF-H03 | High | Abuse | In-memory rate limits on Vercel | Open | P1 |
| INF-H04 | High | Monitoring | Sentry not installed | Open | P1 |
| INF-H05 | High | Headers | CSP unsafe-inline/eval | Open | P2 |
| INF-H06 | High | CI/CD | No dependency/secret scanning | Open | P1 |
| INF-H07 | High | DR | No storage offsite mirror | Open | P1 |
| INF-H08 | High | DR | Prod PITR not verified | Open | P0 |
| INF-H09 | High | Redis | Persistence unproven | Open | P1 |
| INF-H10 | High | Workers | Railway env unverified | Open | P0 |
| INF-H11 | High | Secrets | Dev service-role missing on Preview | Open | P0 |
| INF-M01–M10 | Medium | Various | See readiness report | Open | P2 |
| SEC-001 | Critical | CLI | Stale local Supabase link | Open | P0 |
| SEC-003 | High | RLS | CI RLS on Dev only; Prod pending | Open | P0 |

**Target:** Close all P0 before external Production GO; re-score ≥ 80.
