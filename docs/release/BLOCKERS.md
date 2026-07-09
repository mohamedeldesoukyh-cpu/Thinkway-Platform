# Blockers — Release 1.0 RC (Phase 0.4)

**Date:** 2026-07-04  
**Purpose:** Items that must be resolved or explicitly waived before promoting RC to internal production.

---

## Release blockers (must resolve or waive)

### B-001: Staging environment not validated — **P0**
| Field | Value |
|-------|-------|
| **Description** | Phase 0.4 goal requires proving readiness on real staging. No staging URL reachable; all live tests on localhost:3000. |
| **Evidence** | `ENVIRONMENT_MATRIX.md` lists staging as "Vercel Preview / staging project" — not configured in `.env.local` |
| **Mitigation** | Local dev + thinkway-dev Supabase provides partial parity |
| **Owner** | DevOps / Platform |
| **Waiver** | Accept for **internal dev pilot only** with documented risk |

### B-002: Campaign object DB persistence not end-to-end verified — **P0**
| Field | Value |
|-------|-------|
| **Description** | `campaign_objects` table has 0 rows after full BabyJoy runtime test |
| **Evidence** | UAT DB probe: accessible=true, count=0 |
| **Risk** | Phase 0.3 autosave may not write to DB in current runtime path |
| **Action** | Apply migration `20260712010000` if not applied; run workflow; query `campaign_objects` by conversation_id |
| **Owner** | AI Platform |

### B-003: IPL seed migration pending — **P1**
| Field | Value |
|-------|-------|
| **Description** | `ipl_refresh_policies` table/seed not present on dev DB |
| **Evidence** | `validate-ipl.ts`: 12/13 PASS, seed policies FAIL |
| **Action** | Apply IPL migration; re-run validator |
| **Owner** | Discovery / Intelligence |

---

## Operational blockers (pre-production)

### B-004: Queue failed job backlog — **P1**
| Field | Value |
|-------|-------|
| **Description** | 23 failed BullMQ jobs visible in `/api/ready` |
| **Breakdown** | discovery-run: 16 failed; publication-metrics: 7 failed |
| **Action** | Root-cause failed jobs; clean or retry before cutover |
| **Owner** | Platform / Discovery |

### B-005: Windows TLS for automation — **P1**
| Field | Value |
|-------|-------|
| **Description** | Node CLI cannot verify Supabase TLS without bypass on this workstation |
| **Action** | Install org root CA; use `NODE_OPTIONS=--use-system-ca` in CI |
| **Owner** | DevOps |

### B-006: Phase 0.1 / 0.2 validator conflict — **P2**
| Field | Value |
|-------|-------|
| **Description** | Security validator fails RC on public health routes that infra validator requires public |
| **Action** | Align validators before automated RC gate |
| **Owner** | Security / Platform |

---

## Sign-off blockers (process)

### B-007: Manual QA UAT not executed — **P1**
| Field | Value |
|-------|-------|
| **Description** | 68-case business UAT checklist not signed off |
| **Reference** | `docs/UAT_CHECKLIST.md`, `docs/UAT_EXECUTION_REPORT.md` |
| **Owner** | QA / Product |

### B-008: Production infrastructure not provisioned — **P0 for GA**
| Field | Value |
|-------|-------|
| **Description** | Dedicated prod Supabase, Redis HA, Sentry, cron secrets on Vercel prod |
| **Reference** | `docs/infrastructure/PRODUCTION_DEPLOYMENT_CHECKLIST.md` |
| **Owner** | DevOps |
| **Note** | Blocker for GA, not internal RC pilot |

---

## Blocker summary

| ID | Severity | Blocks internal RC? | Blocks GA? |
|----|----------|---------------------|------------|
| B-001 | P0 | Waivable | Yes |
| B-002 | P0 | Yes | Yes |
| B-003 | P1 | Waivable | Yes |
| B-004 | P1 | Waivable | Yes |
| B-005 | P1 | No (workaround exists) | Yes (CI) |
| B-006 | P2 | No | No |
| B-007 | P1 | Waivable | Yes |
| B-008 | P0 | No | Yes |

---

## Recommended resolution order

1. **B-002** — Verify campaign_objects write path (highest technical risk)
2. **B-001** — Stand up staging Vercel preview + staging Supabase; re-run Phase 0.4
3. **B-003** — Apply IPL migration
4. **B-004** — Clear failed queue jobs
5. **B-007** — Execute critical-path manual UAT (13 tests minimum)
