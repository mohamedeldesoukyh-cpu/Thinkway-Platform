# Thinkway Performance Engineering Standards

Companion to [`PERFORMANCE_GOVERNANCE.md`](./PERFORMANCE_GOVERNANCE.md).  
Budgets are enforced by CI; these rules keep PRs from creating regressions.

---

## Performance standards

1. **Budget first** — Treat `performance/budgets.json` as a product contract. Soft = fix soon; hard = block merge.
2. **Measure before claiming** — Use `measure:*` / `validate:performance` scripts; do not argue from DevTools anecdotes alone.
3. **No drive-by “optimizations”** — Prefer targeted fixes under an exceeded budget. Do not re-run platform-wide perf programs without a budget breach or CTO request.
4. **Server by default** — Prefer Server Components and server actions; `"use client"` is an opt-in cost.
5. **Finance & ops correctness over micro-savings** — Never sacrifice correctness, RLS, or billing integrity for bundle size.

---

## Coding rules

- Keep route entry files thin; push heavy UI into feature modules.
- Avoid importing feature barrels that re-export large client trees into server layouts.
- Do not add new top-level CSS into `app/globals.css`; use route/layout-scoped stylesheets (`app/styles/*`).
- Prefer existing lazy wrappers (Campaign Studio sections, Discovery panels, AI/Planning/Outputs) over new eager imports.
- Cache and dedupe network at the edge of the system (see media proxy); do not re-fetch the same avatar/preview in loops.
- Discovery browse must use the recency RPC path; do not reintroduce unbounded table scans.

---

## Lazy loading rules

| Pattern | When |
|---|---|
| `next/dynamic` | Heavy panels, editors, charts, exports, studio sections, AI tools |
| Viewport / interaction mount | Below-fold or rarely opened sheets |
| Route-level code split | Natural App Router boundaries — keep them |
| Prefetch | Production nav may prefetch; never force-prefetch heavy routes in a loop |

Do **not** lazy-load trivial leaves (icons, small badges) — that adds waterfalls without savings.

---

## Client component rules

1. Add `"use client"` only when hooks, browser APIs, or event handlers require it.
2. Keep client leaves small; pass serializable props from server parents.
3. Run `npm run audit:client-components` before large UI PRs. Soft budget: ≤780 modules; hard: ≤900. Largest client source soft ≤85 KB / hard ≤120 KB.
4. Prefer extracting interactive islands over marking an entire workspace `"use client"`.
5. Providers stay high in the tree only when necessary; colocate state when possible.

---

## Bundle rules

1. After any dependency or import-graph change that could grow JS: `npm run build && npm run check:performance-budgets`.
2. Largest JS soft **560 KB** / hard **620 KB**; total JS soft **13 MB** / hard **15 MB** (catalog of emitted chunks).
3. Do not introduce duplicate major libraries (second chart/date/PDF stack) without removing the old one in the same PR.
4. Prefer tree-shakeable imports (`import { x } from "pkg"`) over namespace imports for heavy packages.
5. Update baseline only with `--write-baseline` after intentional, reviewed improvements.

---

## CSS rules

1. Root globals chain soft **40 KB** / hard **60 KB** source.
2. Largest built CSS soft **350 KB** / hard **400 KB**.
3. Scope campaign/login/chrome CSS via layouts — do not dump workspace CSS back into globals.
4. Prefer shared utility classes already in the design system over new one-off megasheets.
5. Measure with `npm run measure:css-bundle`.

---

## API / SQL / RUM checklist (PR)

- [ ] Hot API path: note expected p95; avoid >500 KB JSON payloads on browse lists  
- [ ] New SQL/RPC: `EXPLAIN (ANALYZE, BUFFERS)` on representative data; no unjustified seq scan on large tables  
- [ ] Discovery/media paths: preserve RPC + fail-fast proxy behavior  
- [ ] RUM: if adding client timers, report to the agreed sink — do not invent parallel analytics  

---

## Pre-merge performance checklist

- [ ] `npm run build` succeeds  
- [ ] `npm run check:performance-budgets` passes (no hard fails)  
- [ ] Soft warnings acknowledged in PR description if intentional  
- [ ] No new CSS in root globals without split  
- [ ] New heavy UI is `dynamic` / deferred where appropriate  
- [ ] No new unbounded Supabase `select` on list/browse paths  
- [ ] Client module / largest client source still within budgets  
- [ ] Docs updated if budgets or SLOs changed  

---

## Commands

```bash
npm run build
npm run check:performance-budgets
npm run report:performance
npm run validate:performance
npm run measure:frontend-bundle
npm run measure:css-bundle
npm run audit:client-components
npm run measure:discovery-browse-pool   # needs Supabase env
npm run measure:media-proxy
```
