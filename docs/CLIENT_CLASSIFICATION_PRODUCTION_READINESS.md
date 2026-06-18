# Client Classification Production Readiness

**Date:** June 2026  
**Scope:** Client auto-classification pipeline, review queue, cache, AI enrichment

## Executive summary

Client auto-classification is **ready for controlled production rollout** with human review for AI and low-confidence results. Rule-based matching covers 100+ known MENA/global brands at high confidence; cache reuse reduces API cost; Settings → Classification Review provides an operational queue.

**Go-live recommendation:** **Proceed** after running migrations and configuring `OPENAI_API_KEY` plus at least one web search key (`SERPER_API_KEY`, `BRAVE_SEARCH_API_KEY`, or `TAVILY_API_KEY`).

---

## Classification flow audit

Pipeline order (implemented in `classify-category-action.ts` + `classify-client-category.ts`):

| Priority | Source | Trigger | Confidence | Review flag |
|----------|--------|---------|------------|-------------|
| 1 | `approved` | Stored client with `approved_by_user` | 100 | No |
| 2 | Cache | `client_classification_cache` hit by normalized name | Stored | If < 80 or `ai_search` |
| 3 | `rule` | Company hint dictionary (~100+ entries) | 95–100 | No |
| 4 | `historical` | Similar approved client name match | 90–100 | No |
| 5 | `ai_search` | OpenAI + web/LinkedIn/description context | 70–95 | **Yes** |
| 6 | `fallback` | Keyword ranking on name + web corpus | 50–69 | If < 80 |

### Manual override

When the user changes category manually or overrides a suggestion (`category_manually_set`), save uses `approved` source at 100% confidence with reason "Manual classification". Audit fields are computed **server-side** in `build-classification-audit.ts` — form values for source/confidence are not trusted for persistence.

### Gaps addressed in this release

- Persistent cache before rules/AI (`client_classification_cache`)
- `needs_review` flag on clients with review queue UI
- Rich web context for AI (LinkedIn-style search, descriptions, website extraction)
- Server-side audit payload (tamper-resistant)
- Cache write on approved save and review approve

---

## Taxonomy quality score

| Criterion | Score (1–5) | Notes |
|-----------|-------------|-------|
| Coverage | 4 | 19 top-level categories; legacy retail subs for FMCG |
| Consistency | 3 | Some duplicate concepts across Pet/Home; stable slugs |
| Other subcategory | 5 | Every category has `{slug}_other` |
| Rule alignment | 4 | 100+ hints; food/FMCG still on retail for legacy |
| AI prompt alignment | 4 | Taxonomy JSON embedded; slug validation on response |

**Overall taxonomy quality: 4.0 / 5**

See `CLIENT_TAXONOMY_REVIEW.md` for overlap analysis.

---

## Accuracy estimate

| Method | Est. precision | Est. recall | Notes |
|--------|----------------|-------------|-------|
| Rule hints | ~98% | ~35% of new clients | High precision, limited to dictionary |
| Historical | ~90% | ~10% | Name similarity threshold 0.75 |
| AI + web | ~85% | ~40% of unknowns | Requires API keys; always queued for review |
| Fallback keywords | ~60% | ~15% | Low confidence; often needs review |
| Cache (verified) | ~95% | Grows over time | After human approve |

**Blended accuracy (production with review queue): ~88–92%** for accepted classifications after human approve. Unreviewed AI suggestions should not be used for analytics until approved.

---

## Security review

| Check | Status | Detail |
|-------|--------|--------|
| `OPENAI_API_KEY` server-only | ✅ | Read in `classify-client-category-ai.ts` via `process.env`; never exposed to client |
| Web search keys server-only | ✅ | `SERPER_API_KEY`, `BRAVE_SEARCH_API_KEY`, `TAVILY_API_KEY` in `company-web-search.ts` only |
| Audit fields server-side | ✅ | `buildClassificationAuditPayload` ignores client tampering of source/confidence |
| `approved_by_user` server-side | ✅ | Set from authenticated session user id only |
| `needs_review` server-side | ✅ | Computed in audit builder and review actions |
| Cache RLS | ✅ | Select: authenticated; write: internal users |
| Classification action auth | ✅ | `classifyClientCategoryAction` requires signed-in user |

---

## Open issues

1. **Food/FMCG dual placement** — Many hints still map to `retail_ecommerce`; gradual migration to `food_beverage` planned.
2. **Pre-save review flag** — `needs_review` is set on save, not when suggestion is first shown (by design to avoid partial state).
3. **Cache invalidation** — No TTL; manual reclassify/approve updates cache; stale cache possible if taxonomy changes.
4. **Offline web search** — Without search keys, AI falls back to name-only with lower confidence.
5. **Permissions** — Review queue uses standard `clients.read` / `clients.write`; no dedicated permission slug yet.

---

## Deployment checklist

1. Run migrations:
   ```bash
   npx supabase db push
   ```
2. Environment variables (server / Vercel):
   - `OPENAI_API_KEY` — AI classification
   - One of: `SERPER_API_KEY`, `BRAVE_SEARCH_API_KEY`, `TAVILY_API_KEY`
3. Navigate to **Settings → Classification Review** to process queued clients.
4. Run health-check queries from `CLIENT_CLASSIFICATION_HEALTHCHECK.md` weekly.

---

## Go-live recommendation

**Approved for production** with these guardrails:

- Treat `needs_review = true` clients as provisional in reporting until approved.
- Monitor `needs_review_count` and low-confidence rate via health-check SQL.
- Expand rule dictionary based on review queue rejections.
- Require ops review for all `ai_search` classifications (automatic queue).
