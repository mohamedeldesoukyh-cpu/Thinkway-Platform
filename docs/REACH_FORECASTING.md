# Reach Forecasting

Reach forecasting fills gaps when metrics providers do not return reach, while keeping every number transparent to clients.

## Data model

Migration: `20260630130000_reach_forecasting.sql`

| Column | Purpose |
|--------|---------|
| `reach` | Effective reach used in totals, ER, and reports |
| `reach_source` | `actual`, `forecast`, or `manual` |
| `actual_reach` | Provider-reported reach |
| `forecast_reach` | Follower-based estimate (retained when actual replaces forecast) |

## Priority

1. **Manual** — user import or edit (`reach_source = manual`)
2. **Actual** — provider reach (`actual_reach` populated)
3. **Forecast** — `followers × content-type multiplier`
4. **Null**

## Forecast engine

Module: `lib/performance/reach-forecast-engine.ts`

Default multipliers:

| Content type | Multiplier |
|--------------|------------|
| Instagram Post | 0.30 |
| Instagram Reel | 0.45 |
| TikTok Video | 0.55 |
| Instagram Story | 0.12 |
| Carousel | 0.28 |

Publication types are normalized via `deliverable-taxonomy` codes (`instagram_post`, `instagram_reel`, `tiktok_video`, etc.).

## Pipeline integration

- `merge-metrics.ts` — resolves reach on every metrics merge
- `persist.ts` — writes `reach_source`, `actual_reach`, `forecast_reach`; audits changes to `publication_metric_sync_logs` (`status = reach_source_changed`)
- Followers loaded from `influencer_platform_accounts` via `loadPublicationEngagementContext`

## UI

- Performance grid: reach value + badge (Actual green, Forecast amber, Manual blue)
- Publication workspace Performance tab: method, confidence, prior forecast note when actual replaces forecast
- KPI strip: Total Reach with Actual vs Forecast subtext

## Reports

HTML/PDF, Excel, and PPTX include Reach Source per publication and a reach disclaimer on summary sections.

## Applying the migration

Migration file: `supabase/migrations/20260630130000_reach_forecasting.sql`

This repo does **not** ship a global Supabase CLI or an npm script for migrations. On Windows PowerShell, `supabase` is not on PATH unless you install it separately — use **`npx supabase`** from the project root instead (downloads the CLI on first run).

### Option A — npx Supabase CLI (preferred)

From `c:\thinkway-platform` in PowerShell:

```powershell
cd c:\thinkway-platform

# First time only: link to your Supabase project (thinkway-dev ref: hsxrewjcbvmbkqdlzjhs)
npx supabase link --project-ref hsxrewjcbvmbkqdlzjhs

# See local vs remote migration status
npx supabase migration list

# Apply pending migrations (includes reach forecasting when not yet on remote)
npx supabase db push
```

If the CLI reports drift or skipped versions, use:

```powershell
npx supabase db push --include-all
```

After applying, reload the schema cache: Supabase Dashboard → **Project Settings → API → Reload schema**.

**Verify reach columns exist:**

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'campaign_publications'
  AND column_name IN ('reach_source', 'forecast_reach', 'actual_reach');
```

Expect three rows.

### Option B — Install Supabase CLI globally (optional)

Only if you want `supabase` without `npx` each time:

```powershell
# Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Chocolatey
choco install supabase

# npm (global)
npm install -g supabase
```

Then run `supabase db push` from the repo root (same flags as Option A).

### Option C — Supabase Dashboard SQL Editor (no CLI)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Paste the full contents of `supabase/migrations/20260630130000_reach_forecasting.sql`.
3. Run the script (idempotent: safe to re-run).
4. **Project Settings → API → Reload schema**.

If you apply SQL manually, migration history may not update in `supabase_migrations.schema_migrations`. Prefer Option A when possible; see `docs/MIGRATION_VERIFICATION.md` for parity checks.

## Tests

```bash
npm run test:reach-forecast-engine
```
