# Country flag runtime trace

## Purpose

Compare a live “missing flag” Discovery Search row against the successful Puppeteer probe (`flag-render-probe-full-chain`), and find the **first divergence**.

Static CSS was already validated — this trace does not re-inspect CSS.

## Captures (per row)

1. Creator ID  
2. `countryFlagCodes` (ViewModel-equivalent)  
3. `country_codes`  
4. `country_code`  
5. `audience_country` (per platform)  
6. `CountryFlagsStack` props (from React fiber when live)  
7. Rendered DOM (flag slot / img / tree)  
8. React key  
9. Virtual row index (`data-index`)  
10. Virtual item key  

## Classification

| Category | Meaning |
|---|---|
| `empty_props` | No country on creator → conditional skips flag (expected DOM: no slot) |
| `stale_props` | Creator has codes but stack received `[]` |
| `virtualization_reuse_mismatch` | Virtual key ≠ creator unified_id |
| `different_component_tree` | Not `.discovery-search-exact-row` |
| `stale_props_or_conditional_skip` | Codes present, flag DOM missing |
| `props_and_dom_ok` | Matches probe path |

## How to run

### A) Offline preflight (payload → expected props)

```bash
npm run trace:discovery-flag-runtime
```

Writes `flag-runtime-trace-offline.json`.

### B) Live row (required for virtualization / DOM)

1. Open authenticated `/discovery/search` with results visible.  
2. DevTools console → paste entire `scripts/trace-discovery-flag-runtime.browser.js`.  
3. Either:
   - `await __TW_FLAG_TRACE__.traceVisibleRows()`
   - `await __TW_FLAG_TRACE__.traceRowAtPoint()` then click the avatar of the bad row  
4. Save JSON: `copy(await __TW_FLAG_TRACE__.traceVisibleRows())`

Optional Puppeteer: `node scripts/trace-discovery-flag-runtime.mjs --url http://localhost:3000/discovery/search`

## Offline result (page 1, 50 creators)

See `flag-runtime-trace-offline.json` → `firstDivergenceVsPuppeteerProbe`.

First divergence vs probe (`countryFlagCodes: ["EG"]` + flag DOM) for empty-country creators is at:

**`3.countryFlagCodes_non_empty` → category `empty_props`**

Those rows receive empty country fields end-to-end; Search correctly omits `.discovery-search-exact-flag`. That is **not** a virtualization or CSS failure.

For rows classified `expect_flag_dom`, live browser trace is still required to prove DOM/fiber match the probe.
