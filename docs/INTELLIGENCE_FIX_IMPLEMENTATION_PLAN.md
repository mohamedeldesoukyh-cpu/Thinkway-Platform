# Intelligence Fix Implementation Plan

> **Date:** 2026-06-16 · **Scope:** Intelligence schema, ETL, `/intelligence` UI only.  
> **Sources:** [`INTELLIGENCE_UI_DIAGNOSTIC.md`](./INTELLIGENCE_UI_DIAGNOSTIC.md), [`INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md`](./INTELLIGENCE_DATA_COMPLETENESS_AUDIT.md)

---

## Summary

| Priority | Problem | Fix | Primary files |
| --- | --- | --- | --- |
| **P1** | Campaign-path and Database-path `int_influencers` are disjoint; tab shows empty country/tier/match | Merge identities in ETL; link campaigns to enriched records; pass username to `resolveInfluencer` | `scripts/intelligence-etl/run.ts`, `lib/intelligence/entity-resolution/matchers.ts` |
| **P2** | Q1/Q2 exact head counts timeout under RLS | `intelligence.get_workspace_counts()` SECURITY DEFINER RPC | `supabase/migrations/20260624010000_intelligence_workspace_stats.sql`, `features/intelligence/queries.ts` |
| **P3** | Empty-state banner when Q1 fails but other data exists | `dataAvailable` from counts RPC, benchmarks, or influencer rows | `features/intelligence/queries.ts`, `intelligence-workspace.tsx` |
| **P4** | Hist. revenue sums first 1k rows (~$3.7M vs ~$85M) | `intelligence.get_campaign_financial_totals()` SQL aggregate RPC | Same migration + `queries.ts` |

---

## P1 — ETL entity merge

### Root cause
- Campaign ETL key: `` `${name}\|` ``
- Database ETL key: `` `${display}\|${username}` ``
- No cross-link → `int_campaigns.int_influencer_id` points at sparse campaign-only rows.

### Approach
1. **Register Database influencers first** (before campaign dimension loop).
2. **Build enrichment lookup** keyed by `normalizeName(display)`, `normalizeName(legacy)`, `normalizeHandle(username)`, and `name|platform`.
3. **Campaign registration:** if lookup hit → reuse enriched ID and append campaign source key; else create campaign-only row.
4. **Post-process merge** (`mergeInfluencerDimensions`): collapse duplicate normalized names; remap `int_campaigns` / `int_pricing_history` FKs; drop sparse duplicates; re-run `resolveInfluencer` with username for `match_confidence`.
5. **Post-ETL warehouse merge** (non-truncate re-runs): SQL batch remap for existing sparse→enriched pairs.

### Expected outcome
- Campaign-linked influencers inherit country/tier/username from Database sheet.
- Match % reflects handle resolution when username is present.
- Row count drops from ~15k toward ~8k unique identities (no data loss on attributes).

---

## P2 — KPI count performance

### Migration `20260624010000_intelligence_workspace_stats.sql`
```sql
intelligence.get_workspace_counts()
  → campaigns, influencers, benchmarks
```
- `SECURITY DEFINER`, `STABLE`
- Gates on `intelligence.can_read_intelligence()`
- `GRANT EXECUTE TO authenticated`

### Query change
Replace Q1 + Q5 head counts with single RPC. Keep Q2 removed (influencer count from RPC).

---

## P3 — Empty state banner

```typescript
dataAvailable =
  workspaceCountsOk ||
  (benchmarkCount > 0) ||
  (topInfluencers.length > 0) ||
  (totalRevenueUsd > 0)
```

---

## P4 — Historical revenue KPI

### Migration
```sql
intelligence.get_campaign_financial_totals()
  → total_revenue_usd, total_cost_usd, total_gp_usd
```

### Query change
Remove Q3 row fetch + JS sum; use RPC. Expected totals ~$85,149,050 / $65,913,972 / $19,235,078.

---

## UI touchpoints

| Component | Change |
| --- | --- |
| `intelligence-workspace.tsx` | KPI strip uses RPC counts/totals (via `stats` props) |
| `intelligence-influencers-tab.tsx` | No structural change — country/tier/match flow from enriched joins |
| `types/intelligence.ts` | Optional `totalCostUsd` / `totalGpUsd` on stats if surfaced later |

---

## Re-ETL requirement

| Change | Re-ETL needed? |
| --- | --- |
| Migration (RPC functions) | **No** — apply migration only |
| ETL merge logic | **Yes** — run `npm run intelligence:etl` |

### Recommended reload
```bash
# Apply migration first (supabase db push / migrate)
npm run intelligence:etl
```

- **Without truncate:** ETL hydrates existing warehouse + runs post-merge remap for sparse→enriched IDs. Safe for incremental refresh.
- **Full rebuild:** `INTELLIGENCE_ETL_TRUNCATE=1 npm run intelligence:etl` — only if duplicate `int_influencers` persist after merge.

---

## Verification

```bash
npm run intelligence:test-parsers
npm run build
```

Manual: open `/intelligence` — Campaign lines & Vendors KPIs non-zero, no false empty banner, Hist. revenue ~$85M, influencer tab shows country/tier where Database sheet has data.
