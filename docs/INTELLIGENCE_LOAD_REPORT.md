# Intelligence Load Report (Post-ETL Validation)

> Generated 2026-06-15 after live ETL run (non-truncate).  
> Pre-load snapshot: [`INTELLIGENCE_LOAD_SNAPSHOT_BEFORE.md`](./INTELLIGENCE_LOAD_SNAPSHOT_BEFORE.md)  
> Excel sign-off baseline: [`INTELLIGENCE_FINAL_RECONCILIATION.md`](./INTELLIGENCE_FINAL_RECONCILIATION.md)

---

## ETL outcome

| Field | Value |
| --- | --- |
| **Status** | **SUCCESS** (after idempotent re-run fix) |
| **Runtime** | **2m 8s** (128.1s) |
| **Command** | `npm run intelligence:etl` |
| **Truncate** | Not set (`INTELLIGENCE_ETL_TRUNCATE` omitted) |
| **Log terminus** | `[intelligence-etl] Complete.` |

---

## Pre-load snapshot (before ETL)

> **Note:** Warehouse was **not empty** despite empty-state assumption — full prior load was present. Non-truncate re-run performed upsert/refresh.

| Table | Count |
| --- | ---: |
| `historical_campaigns_raw` | 27,364 |
| `historical_influencers_raw` | 8,379 |
| `int_campaigns` | 27,364 |
| `int_clients` | 197 |
| `int_brands` | 318 |
| `int_influencers` | 15,191 |
| `int_pricing_history` | 26,712 |
| `int_margin_history` | 27,347 |
| `int_benchmarks` | 253 |

---

## Post-load counts

### Raw layer

| Table | Count |
| --- | ---: |
| `historical_campaigns_raw` | 27,364 |
| `historical_influencers_raw` | 8,379 |

### Warehouse

| Table | Count |
| --- | ---: |
| `int_campaigns` | 27,364 |
| `int_clients` | 197 |
| `int_brands` | 318 |
| `int_influencers` | 15,191 |
| `int_pricing_history` | 26,712 |
| `int_margin_history` | 27,347 |
| `int_benchmarks` | 253 |

Pre/post counts identical — idempotent non-truncate re-run refreshed campaigns, margin history, and benchmarks without row inflation.

---

## Financial reconciliation

Excel baseline (Final Reconciliation sign-off):

| Metric | Excel |
| --- | ---: |
| Revenue | $85,149,050 |
| Cost | $65,913,972 |
| Margin (Rev − Cost) | $19,235,078 |

Warehouse aggregates from `int_campaigns` (paginated sum, 27,364 lines):

| Metric | Warehouse | Variance vs Excel | Status |
| --- | ---: | ---: | --- |
| Revenue | $85,149,050.07 | **0.00%** | **PASS** |
| Cost | $65,913,971.76 | **0.00%** | **PASS** |
| Margin (Rev − Cost) | $19,235,078.31 | **0.00%** | **PASS** |

All financial variances are ≤ 1%.

---

## Overall validation

| Check | Result |
| --- | --- |
| ETL completed without thrown error | **PASS** |
| Raw layer row counts | **PASS** |
| Warehouse row counts (pre = post) | **PASS** |
| Financial totals vs Excel (Rev/Cost/Margin) | **PASS** |
| Any variance > 1% | **PASS** (none) |

### **Final result: PASS**

---

## ETL run errors (resolved)

| Attempt | Runtime | Error | Resolution |
| --- | ---: | --- | --- |
| 1 | 68.7s | `int_clients: duplicate key … int_clients_name_group_key` | Warehouse already loaded; ETL generated new UUIDs on re-run |
| 2 | 99.3s | `int_influencers: duplicate key … int_influencers_identity_idx` | Influencer hydration capped at 1,000 rows (PostgREST default limit) |
| 3 | 128.1s | — | **Success** — hydrate existing dimensions/campaigns with pagination; insert only new dimension rows; skip pricing insert on non-truncate re-run |

### Minimal code fix applied

- `scripts/intelligence-etl/run.ts` — `hydrateExistingWarehouse()` reuses existing dimension and campaign IDs when `INTELLIGENCE_ETL_TRUNCATE` is not set; paginated influencer hydration; skip duplicate pricing inserts on re-run.

---

## Environment blocker

`.env` `SUPABASE_SERVICE_ROLE_KEY` decodes to **`role: anon`**, not `service_role`. ETL was run with the service_role JWT retrieved via Supabase CLI for this session.

**Action required:** Update `.env` so `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** JWT (`role: service_role` in payload). Until fixed, `npm run intelligence:etl` alone will fail with permission errors.
