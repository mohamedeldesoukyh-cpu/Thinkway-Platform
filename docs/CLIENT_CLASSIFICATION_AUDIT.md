# Client Classification Audit

Template for tracking auto-classification quality and adoption.

## Metrics to track

| Metric | Query idea |
|--------|------------|
| Total classified clients | `COUNT(*) WHERE client_category IS NOT NULL` |
| By source | `GROUP BY classification_source` |
| Avg confidence by source | `AVG(classification_confidence) GROUP BY classification_source` |
| Low confidence (&lt;70) | `WHERE classification_confidence < 70` |
| Unapproved legacy | `WHERE client_category IS NOT NULL AND approved_by_user IS NULL` |
| AI usage rate | `% WHERE classification_source = 'ai_search'` |

## Example queries

### Counts by classification source

```sql
SELECT
  classification_source,
  COUNT(*) AS client_count,
  ROUND(AVG(classification_confidence), 1) AS avg_confidence
FROM public.clients
WHERE client_category IS NOT NULL
GROUP BY classification_source
ORDER BY client_count DESC;
```

### Low-confidence classifications needing review

```sql
SELECT
  id,
  name,
  client_category,
  client_subcategory,
  classification_source,
  classification_confidence,
  classification_reason,
  classified_at
FROM public.clients
WHERE classification_confidence < 70
  AND client_category IS NOT NULL
ORDER BY classified_at DESC NULLS LAST;
```

### Rule match effectiveness (top reasons)

```sql
SELECT
  classification_reason,
  COUNT(*) AS hits
FROM public.clients
WHERE classification_source = 'rule'
GROUP BY classification_reason
ORDER BY hits DESC
LIMIT 20;
```

### Historical match adoption

```sql
SELECT
  DATE_TRUNC('week', classified_at) AS week,
  COUNT(*) FILTER (WHERE classification_source = 'historical') AS historical_count,
  COUNT(*) AS total_classified
FROM public.clients
WHERE classified_at IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;
```

### Approved vs auto-suggested at save

```sql
SELECT
  classification_source,
  COUNT(*) FILTER (WHERE approved_by_user IS NOT NULL) AS user_approved,
  COUNT(*) AS total
FROM public.clients
WHERE client_category IS NOT NULL
GROUP BY classification_source;
```

## Weekly review checklist

- [ ] Run source distribution query; rule coverage &gt;60% is healthy for MENA portfolio
- [ ] Review low-confidence rows; add COMPANY_HINTS rules for repeat offenders
- [ ] Check AI+search failures (null category after suggest) from support tickets
- [ ] Validate new taxonomy slugs appear in analytics spending-by-category report
- [ ] Confirm `approved_by_user` populated on all new saves post-migration

## Reporting template

| Week | New clients | Rule % | Historical % | AI % | Fallback % | Avg confidence | Low conf count |
|------|-------------|--------|--------------|------|------------|----------------|----------------|
| YYYY-WW | | | | | | | |

## Related docs

- `docs/CLIENT_AUTO_CLASSIFICATION.md` — pipeline and UX
- `docs/CLIENT_TAXONOMY_REVIEW.md` — taxonomy structure
