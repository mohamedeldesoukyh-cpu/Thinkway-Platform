# Performance budget repair — November 2026

The Stage 3 build crossed four hard limits. This change retains the existing
budgets and frozen baseline and reduces emitted assets instead.

- Use a 47 KB unminified minimum JavaScript chunk target and favor reuse during
  navigation. This reduces duplicated code while keeping the file count below
  400. Keep on-demand imports and the existing module boundaries.
- Let 32 internal hooks/helpers inherit their importing client component's
  boundary. The existing import guard now protects 188 inherited boundaries.
- Remove duplicate Discovery rules already supplied by the frozen foundation.
  Its stylesheet is unchanged. The shared-style guard checks 383 retained rules,
  stylesheet order and explicit motion rules.
- Remove selectors requiring retired classes absent from the rendering graph.
  The retired-class manifest fails CI if a future screen reintroduces one;
  restore the matching stylesheet rules from Git when reconnecting old UI.
  Keep escaped utility selectors, pseudo-function conditions and dynamically
  constructed class prefixes. Do not use viewport-based unused-CSS coverage.
- Scan application rendering inputs for production Tailwind generation, including
  server-rendered JSX, client hooks, lazy imports and JSON class maps. Stop at
  non-rendering server action/service modules. Development retains the broad
  scan for fast iteration. Non-literal runtime imports fail the graph check
  instead of silently losing styles. No CSS class names or budget definitions
  change.

Local emitted assets (KiB, uncompressed; final hosted CI is authoritative):

| Metric | Before | After | Hard limit |
|---|---:|---:|---:|
| JavaScript | 15,353.4 | 14,696.5 | 15,000 |
| CSS | 1,721.7 | 1,540.3 | 1,550 |
| JS files | 401 | 397 | 400 |
| Explicit client modules | 922 | 890 | 900 |

Soft warnings remain. These totals cover all emitted assets, not a single-page
transfer. This is a development release; accounting posting logic, database
records, permissions and fiscal settings are unchanged.
