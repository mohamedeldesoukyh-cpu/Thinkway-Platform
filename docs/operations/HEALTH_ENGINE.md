# Health Engine

## Purpose

Evaluate every registered monitoring adapter and produce:

- per-component status: `healthy | warning | critical | offline | unknown`
- `overallHealthScore` (0–100)
- `overallStatus`

## Score calculation

Weighted average of component scores:

| Status | Score |
|--------|------:|
| healthy | 100 |
| warning | 70 |
| critical | 35 |
| unknown | 50 |
| offline | 0 |

Weights live on each `HealthProvider` (e.g. Supabase 1.5, Redis 1.3).

Implementation: `features/operations-center/health/score.ts` + `engine.ts`.

## Execution

```ts
const report = await runHealthEngine({ supabase });
```

Providers run in parallel. A thrown provider becomes `critical` with score `0`.

## Overall status rules

1. Any `offline` → overall `offline`
2. Else any `critical` → `critical`
3. Else any `warning` → `warning` (or `critical` if score &lt; 60)
4. Else derive from score bands (≥85 healthy, ≥65 warning, else critical)
