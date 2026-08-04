# Performance Baseline Report — Release 2.3

**Status:** ✅ Accepted · Baseline reset authorized  
**Date:** 2026-08-04  
**Branch tip (baseline commit):** `8eebce9c` on `develop`  
**Measured build tip:** `43de8065` (R2.3 Stabilization Production close / tag `v2.3.1`)  
**Prior baseline:** 2026-07-21 · `phase-performance-governance`  
**Canonical files:** [`performance/baseline.json`](../performance/baseline.json) · [`performance/budgets.json`](../performance/budgets.json)  
**Governance:** [`docs/PERFORMANCE_GOVERNANCE.md`](./PERFORMANCE_GOVERNANCE.md) · [`docs/PERFORMANCE_TECHNICAL_DEBT.md`](./PERFORMANCE_TECHNICAL_DEBT.md)

---

### Infrastructure Assumptions

- Measurement from local `npm run build` (Next.js 16 / Turbopack production output) on tip `43de8065`
- CI gate: `.github/workflows/validate.yml` → `npm run check:performance-budgets` after build
- No Production app redeploy required for baseline JSON alone (CI / governance artifact)
- Railway / Dev worker limitations not applicable to this bundle measurement

---

## 1. Why the baseline was updated

CI hard-failed on **`regression.totalJsKbGrowthPct: 18.1%`** (soft 8 · hard **15**) when comparing a fresh R2.3 Stabilization production bundle against the **2026-07-21** baseline.

| Finding | Detail |
|---|---|
| Root cause | **Stale baseline** relative to intentional Release 2.3 client surface growth |
| Accidental heavy imports | **Not found** — top chunks lack pptxgen / xlsx / exceljs / ECI engine client leakage |
| Absolute hard budgets | **Still green** at measurement (see §4) |
| Product decision | Update baseline; **keep** gate; **do not** raise hard limits; **do not** disable checks |

Classification (accepted):

1. **Expected growth from Release 2.3 features** — primary  
2. Real accidental-import regression — no  
3. Dead code requiring immediate tree-shake — soft debt only  
4. Duplicate npm dependency crisis — no (Turbopack same-size twins are not byte-identical)  
5. **Stale performance baseline** — yes  

---

## 2. What changed in Release 2.3 (bundle-relevant)

Release 2.3 intentionally expanded client-facing planning and campaign operational surfaces after the Jul 21 governance baseline:

| Area | Bundle relevance |
|---|---|
| Campaign Studio (S2/S3 · Planning Package · slate / narrative) | Large client chunks; zod + studio fingerprints in top JS |
| Campaign Workspace Lifecycle OS depth | Decision Center / process presentation growth |
| Client IO · Vendor IO lifecycle chrome | Frequent fingerprints across many top-40 chunks |
| Enterprise Creator Intelligence | Consume-only; **server-side** — not present in top client chunks |
| Document Lifecycle · Change Impact | Platform engines — not top client chunk drivers |
| Stabilization STAB-032…040 | Lifecycle / Generate / VIO / line-suffix fixes — modest incremental client JS |

Growth was concentrated in **campaign-studio** and **CIO/VIO workspace** client surfaces — consistent with shipped product scope, not a runaway dependency import.

---

## 3. Measured deltas (Jul 21 → Aug 4)

| Metric | Prior baseline | New baseline | Δ |
|---|---:|---:|---:|
| Largest JS (KB) | 554.9 | 568.6 | +2.5% |
| Largest CSS (KB) | 328.8 | 337.5 | +2.6% |
| **Total JS (KB)** | **12,016.6** | **14,195** | **+18.1%** |
| Total CSS (KB) | 623.5 | 699 | +12.1% |
| Assets ≥100 KB | 18 | 26 | +8 |
| JS file count | 270 | 290 | +20 |
| Client modules | 726 | 807 | +81 |
| Largest client source (KB) | 72.5 | 77.4 | creator-search-workspace |

### Largest JS contributors (post–R2.3 measure)

| Approx KB | Notes |
|---:|---|
| 568.6 × 2 | Next/framework-style chunks (same size, not byte-identical) |
| 475.3 | zod + campaign-studio |
| 309.7 | campaign-studio · Decision Center · CIO/VIO |
| 203.9 | campaign-studio · CIO/VIO |
| 222.1 | react-dom |

---

## 4. Headroom against hard limits (new floor)

Hard limits in [`performance/budgets.json`](../performance/budgets.json) are **unchanged**.

| Metric | New baseline | Soft | Hard | Headroom to hard |
|---|---:|---:|---:|---:|
| largestJsKb | 568.6 | 560 | **620** | **~51 KB** (~8%) |
| largestCssKb | 337.5 | 350 | **400** | **~62 KB** |
| totalJsKb | 14,195 | 13,000 | **15,000** | **~805 KB** (~5.4%) |
| totalCssKb | 699 | 700 | **850** | **~151 KB** |
| assetsOver100kb | 26 | 20 | **28** | **2 assets** |
| jsFileCount | 290 | 320 | **400** | **110 files** |
| clientModuleCount | 807 | 780 | **900** | **93 modules** |
| largestClientSourceKb | 77.4 | 85 | **120** | **~43 KB** |
| regression.*GrowthPct | 0% (reset) | 5–8 | **12–15** | Full band |

**Soft warns retained on purpose** (largest JS, total JS, assets ≥100 KB, client modules). Soft = engineering pressure; hard = merge blocker. Soft floors were **not** raised.

Post-reset local check: **Score 87/100 · fail=0 · warn=4 · EXIT 0**.

---

## 5. Governance invariants (mandatory)

| Rule | Status |
|---|---|
| Performance budget CI check enabled | ✅ Kept |
| Hard limits relaxed | ❌ Not done |
| Budget checks disabled | ❌ Not done |
| New R2.3 baseline is comparison SSOT | ✅ `performance/baseline.json` |
| Soft-warn debt tracked | ✅ `docs/PERFORMANCE_TECHNICAL_DEBT.md` |

Update baseline again only after intentional, reviewed gains or another authorized release floor:

```bash
npm run build
npm run report:performance -- --write-baseline
npm run check:performance-budgets
```

---

## 6. Easy optimizations (deferred · not required for this reset)

| Action | Est. JS reduction | Priority |
|---|---|---|
| Dynamic-import remaining Studio / CIO / VIO chrome | ~100–300 KB route-initial | Medium |
| Split `creator-search-workspace.tsx` | ~15–40 KB | Medium |
| `date-fns` import hygiene / share | ~20–80 KB (uncertain) | Low |

Do **not** treat these as blockers for R2.3 closure. Prefer them before any future soft-floor increase.

---

## 7. Release linkage

| Item | Ref |
|---|---|
| R2.3 Stabilization Production report | [`RELEASE_2_3_STABILIZATION_PRODUCTION_REPORT.md`](./architecture/RELEASE_2_3_STABILIZATION_PRODUCTION_REPORT.md) |
| Production tag | `v2.3.1` |
| Production deploy | `dpl_9YTfXFj2gDDZFs85NGhgknEHj3dd` |
| Baseline commit | `8eebce9c` |
| R2.4 | Baseline branch only — **no implementation** in this report |

---

## 8. Verdict

**Baseline update: APPROVED and applied.**  
CI hard failure explained by stale pre–R2.3 baseline + expected feature growth. Absolute hard budgets remain the product contract. Soft warns continue as debt pressure under Release 2.3 Maintenance Mode.
