# Intelligence Environment Checklist

> **Purpose:** Validate local `.env` before running Intelligence ETL (read-only / dry-run only on this checklist).  
> **Validated:** 2026-06-15 (automated run against workspace `.env`)  
> **Related:** [`INTELLIGENCE_ETL.md`](./INTELLIGENCE_ETL.md) · [`INTELLIGENCE_GO_LIVE_CHECKLIST.md`](./INTELLIGENCE_GO_LIVE_CHECKLIST.md)

---

## Validation summary (2026-06-15)

| Check | Result |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` present | **PASS** |
| Key starts with `eyJ` (JWT format) | **PASS** |
| JWT `role` claim = `service_role` | **FAIL** — claim is `anon` |
| Key ≠ `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **PASS** (values differ) |
| ETL dry-run (`npm run intelligence:etl:dry-run`) | **PASS** (exit 0; entity resolution degraded — see below) |
| `intelligence.historical_campaigns_raw` head count | **PASS** (accessible; count **0**) |
| `intelligence.int_benchmarks` head count | **PASS** (accessible; count **0**) |

**Action required:** Replace `SUPABASE_SERVICE_ROLE_KEY` with the real **service_role** JWT from Supabase Dashboard → **Project Settings → API → `service_role` secret** (not the `anon` / publishable key). Until fixed, full ETL loads and live master reads for entity resolution will not work correctly.

**Dry-run note:** Run completed with 27,364 estimated campaigns and **no database writes**. Log included `Dry-run: Supabase unavailable — entity resolution uses empty masters` because `loadLiveMasters` reads operational `public` tables that require service-role bypass; the misconfigured anon JWT cannot read them.

---

## Pre-flight checklist

Copy results into the checkboxes after each run.

### 1. Supabase URL

- [x] **PASS** — `NEXT_PUBLIC_SUPABASE_URL` is set

```powershell
Set-Location c:\thinkway-platform
node -e "require('dotenv').config({path:'.env'}); console.log('present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())"
```

### 2. Service role key (JWT, not anon)

- [x] **PASS** — `SUPABASE_SERVICE_ROLE_KEY` is present
- [x] **PASS** — value starts with `eyJ`
- [ ] **FAIL** — JWT payload `role` claim is `service_role` (actual: **`anon`**)

```powershell
Set-Location c:\thinkway-platform
npx tsx scripts/intelligence-etl/env-check.ts
```

The helper script prints **presence / eyJ / role claim only** — never key values.

**Manual JWT role decode (no secret printed):**

```powershell
Set-Location c:\thinkway-platform
node -e @"
require('dotenv').config({ path: '.env' });
const k = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!k) { console.log('present: false'); process.exit(1); }
console.log('present: true');
console.log('eyJ_prefix:', k.startsWith('eyJ'));
try {
  const payload = JSON.parse(Buffer.from(k.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString());
  console.log('role_claim:', payload.role ?? '(missing)');
} catch { console.log('role_claim: (decode failed)'); }
"@
```

Expected: `role_claim: service_role`

### 3. Service key is not the anon key

- [x] **PASS** — `SUPABASE_SERVICE_ROLE_KEY` ≠ `NEXT_PUBLIC_SUPABASE_ANON_KEY`

```powershell
Set-Location c:\thinkway-platform
node -e @"
require('dotenv').config({ path: '.env' });
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
console.log('both_present:', !!(svc && anon));
console.log('NOT_same_as_anon:', !!(svc && anon && svc !== anon));
"@
```

> Even when keys differ, verify **§2 role claim**. A distinct key with `role: anon` still blocks ETL writes and master hydration.

### 4. Fix if `.env` has the wrong key

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings → API**.
2. Under **Project API keys**, copy **`service_role`** (`secret`) — JWT starting with `eyJ…`, **not** `anon` / publishable.
3. In `c:\thinkway-platform\.env`, set:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service_role JWT only
   ```
4. Do **not** commit `.env`. Re-run §2 and §5–§6 below.
5. Never use the service role key in client-side code or `NEXT_PUBLIC_*` variables.

### 5. ETL dry-run (no CLI key injection)

Uses **only** `.env` — do not set `$env:SUPABASE_SERVICE_ROLE_KEY` from `supabase status` or CLI output for this test.

- [x] **PASS** — `npm run intelligence:etl:dry-run` exits 0

```powershell
Set-Location c:\thinkway-platform
# Clear any session overrides first
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue

npm run intelligence:etl:dry-run
```

**2026-06-15 observed output (headline):**

| Metric | Value |
| --- | ---: |
| Filtered data rows | 35,743 |
| Estimated campaigns | 27,364 |
| Estimated influencers | 15,509 |
| Database writes | NONE |

**Warning on current `.env`:** entity resolution used empty masters (see summary above). After fixing service role, re-run and confirm that message **does not** appear.

Optional env flag (same behavior as `--dry-run`):

```powershell
$env:INTELLIGENCE_ETL_DRY_RUN = "1"
npm run intelligence:etl
Remove-Item Env:INTELLIGENCE_ETL_DRY_RUN -ErrorAction SilentlyContinue
```

### 6. Intelligence schema readable (.env credentials only)

- [x] **PASS** — `historical_campaigns_raw` head count succeeded (count **0**)
- [x] **PASS** — `int_benchmarks` head count succeeded (count **0**)

```powershell
Set-Location c:\thinkway-platform
npx tsx scripts/intelligence-etl/env-check.ts
```

Or one-off (read-only):

```powershell
Set-Location c:\thinkway-platform
node -e @"
require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) { console.log('SKIP: missing url or key'); process.exit(1); }
  const db = createClient(url, key, { auth: { persistSession: false } }).schema('intelligence');
  for (const t of ['historical_campaigns_raw', 'int_benchmarks']) {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true });
    console.log(t + ':', error ? 'FAIL ' + error.message : 'count=' + count);
  }
})();
"@
```

Empty counts are expected before first full load. See expected post-load counts in [`INTELLIGENCE_GO_LIVE_CHECKLIST.md`](./INTELLIGENCE_GO_LIVE_CHECKLIST.md).

### 7. Excel path

- [x] **PASS** — default workbook path used (`INTELLIGENCE_EXCEL_PATH` unset)

```powershell
Set-Location c:\thinkway-platform
node -e "require('dotenv').config({path:'.env'}); const p=process.env.INTELLIGENCE_EXCEL_PATH?.trim(); console.log(p ? 'custom path set' : 'using default path');"
Test-Path "c:\Users\X13 Yoga G3\Documents\Thinway\Thinkway Intelligence Engine\data 2023 - 2026.xlsx"
```

---

## Environment variables by script

Audit of `scripts/intelligence-etl/*.ts` (2026-06-15).

| Variable | `run.ts` | `preload-audit.ts` | `audit-2023-sheet.ts` | `final-reconciliation.ts` |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Required** (DB + entity resolution) | — | — | — |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** for load / masters (JWT `eyJ…`, `role: service_role`) | — | — | — |
| `INTELLIGENCE_EXCEL_PATH` | Optional (default workbook) | Optional | Optional | Optional |
| `INTELLIGENCE_ETL_DRY_RUN` | Optional (`1` or `--dry-run`; no writes) | — | — | Optional (documented in report header) |
| `INTELLIGENCE_ETL_TRUNCATE` | Optional (`1` = truncate before load; **never** in validation) | — | — | — |

### Script reference

| npm script | Entry | DB access |
| --- | --- | --- |
| `intelligence:etl` | `run.ts` | Writes (unless dry-run) |
| `intelligence:etl:dry-run` | `run.ts --dry-run` | Read-only attempt for masters; no warehouse writes |
| `intelligence:preload-audit` | `preload-audit.ts` | None (Excel only) |
| `intelligence:audit-2023` | `audit-2023-sheet.ts` | None (Excel only) |
| `intelligence:final-reconciliation` | `final-reconciliation.ts` | None (Excel only) |

---

## Recommended order before go-live

1. Fix **§2** / **§4** if service role claim is not `service_role`.
2. Re-run **§5** dry-run — confirm no “Supabase unavailable” warning.
3. Re-run **§6** — schema head counts (optional baseline snapshot).
4. Complete [`INTELLIGENCE_GO_LIVE_CHECKLIST.md`](./INTELLIGENCE_GO_LIVE_CHECKLIST.md) pre-flight items (migration, preload audit, parser tests).
5. Full load only when signed off: `INTELLIGENCE_ETL_TRUNCATE=1 npm run intelligence:etl` (see [`INTELLIGENCE_ETL.md`](./INTELLIGENCE_ETL.md)).

---

## Constraints (this checklist)

- No production / operational data modified during validation.
- Dry-run and `head: true` count queries only.
- No secrets logged or committed.
- Re-validate after any `.env` change; update the **Validation summary** date and checkboxes.
