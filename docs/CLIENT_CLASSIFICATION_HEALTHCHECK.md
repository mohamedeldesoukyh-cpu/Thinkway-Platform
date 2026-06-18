# Client Classification Health Check

SQL queries for monitoring client auto-classification quality in production.

## Total classified clients

```sql
SELECT COUNT(*) AS total_classified
FROM public.clients
WHERE client_category IS NOT NULL
  AND client_subcategory IS NOT NULL;
```

## Classified by source

```sql
SELECT
  COALESCE(classification_source, 'unset') AS source,
  COUNT(*) AS client_count,
  ROUND(AVG(classification_confidence)::numeric, 1) AS avg_confidence
FROM public.clients
WHERE client_category IS NOT NULL
GROUP BY 1
ORDER BY client_count DESC;
```

## Low confidence (< 80%)

```sql
SELECT
  id,
  name,
  client_category,
  client_subcategory,
  classification_confidence,
  classification_source,
  needs_review
FROM public.clients
WHERE client_category IS NOT NULL
  AND classification_confidence < 80
ORDER BY classification_confidence ASC NULLS FIRST, name;
```

## Unclassified clients

```sql
SELECT
  id,
  name,
  status,
  created_at
FROM public.clients
WHERE client_category IS NULL
   OR client_subcategory IS NULL
ORDER BY created_at DESC;
```

## Needs review queue count

```sql
SELECT COUNT(*) AS needs_review_count
FROM public.clients
WHERE needs_review = true;
```

## Needs review detail

```sql
SELECT
  name,
  client_category,
  client_subcategory,
  classification_confidence,
  classification_source,
  classification_reason,
  classified_at
FROM public.clients
WHERE needs_review = true
ORDER BY classified_at DESC NULLS LAST, name;
```

## Classification cache stats

```sql
SELECT
  COUNT(*) AS cache_entries,
  COUNT(*) FILTER (WHERE verified_at IS NOT NULL) AS verified_entries,
  ROUND(AVG(confidence)::numeric, 1) AS avg_confidence
FROM public.client_classification_cache;
```

## Cache by source

```sql
SELECT source, COUNT(*) AS entries
FROM public.client_classification_cache
GROUP BY source
ORDER BY entries DESC;
```

## AI search volume (last 30 days)

```sql
SELECT COUNT(*) AS ai_classified_last_30d
FROM public.clients
WHERE classification_source = 'ai_search'
  AND classified_at >= NOW() - INTERVAL '30 days';
```

## Approval coverage

```sql
SELECT
  COUNT(*) FILTER (WHERE approved_by_user IS NOT NULL) AS approved,
  COUNT(*) FILTER (WHERE approved_by_user IS NULL AND client_category IS NOT NULL) AS unapproved_with_category,
  COUNT(*) AS total
FROM public.clients;
```
