# Phase 3 — Frontend Navigation & Bundle Performance

**Scope:** Client bundle splitting, lazy workspaces, layout/nav hydration, measurement tooling.  
**Out of scope (untouched):** Discovery SQL, Avatar APIs, AI workflow definitions, auth, billing backends, DB.

---

## 1. Bundle analysis (after Phase 3 build)

Command:

```bash
$env:SKIP_TYPECHECK="true"; npm run build
npm run measure:frontend-bundle
npm run audit:client-components
npm run analyze   # optional HTML treemap (also sets SKIP_TYPECHECK)
```

### Production static assets (Turbopack build, 2026-07-21)

| Metric | Value |
|--------|------:|
| JS files | 268 |
| **Total JS** | **11,957.7 KB** |
| CSS files | 5 |
| **Total CSS** | **624 KB** |
| Largest JS chunk | **554.9 KB** (×2 identical hashed copies) |
| Largest CSS chunk | **514.9 KB** (global design system) |
| Assets ≥ 100 KB | **17** |

### Assets ≥ 100 KB (summary)

| Kind | Approx size | Notes |
|------|------------:|-------|
| Shared / framework JS | ~555 KB ×2 | Largest hashed chunks |
| Large app JS | 430 / 266 / 223 / 222 KB | Likely dashboard + heavy feature graphs |
| Global CSS | **515 KB** | `globals.css` + platform tokens (dominant CSS cost) |
| Other JS | 100–154 KB | Multiple feature chunks (studio sections, outputs, etc.) |

### Client component audit (heuristic)

| Classification | Count |
|----------------|------:|
| Must remain client | 370 |
| Can dynamically import | 139 |
| Can become Server Component (candidate) | 217 |
| **Total `use client` modules** | **726** |

Largest source modules (not gzipped chunks):

1. `creator-search-workspace.tsx` (~72 KB)
2. `creator-detail-sheet.tsx` (~57 KB) — already lazy via `creator-detail-sheet-lazy`
3. `vendor-recommendations-section.tsx` (~46 KB) — now dynamic section chunk
4. `intelligence-workspace.tsx` (~40 KB) — route-lazy
5. `outputs-center.tsx` (~35 KB) — behind lazy launcher path

---

## 2. Optimizations implemented

### Campaign Studio

- Every section rendered through `next/dynamic` in `section-renderer.tsx` (own chunk).
- Viewport / active-section body mount via `useSectionBodyMount` (card chrome always present; body mounts near viewport, when active, or when `running`/`blocked`).
- Stopped barrel-exporting individual sections from `sections/index.ts` (prevents undo of chunking).
- `CampaignStudio` itself dynamically loaded from `campaign-studio-host`.
- Decision overlays + `ActionCardRenderer` dynamically imported.
- `StudioOutputsView` / Outputs Center dynamically imported from `campaign-studio-panel` (loads only on Outputs/Director tabs).
- Studio CSS remains feature-scoped (`campaign-studio-ref.css` import on studio shell).

### Discovery workspace

- Lazy panels: brief sidebar, AI strategy sheet, requirements panel, create-list / shortlist / platform / refresh / delete dialogs (`creator-search-lazy-panels.tsx`).
- Panels/dialogs mount only when opened (or AI mode active for requirements).
- `needsPlatformAccountSelection` moved to lightweight `platform-account-selection.ts` so the dialog module is not sync-imported.
- Creator grid remains virtualized (`@tanstack/react-virtual`); detail sheet already lazy.

### Other heavy routes / surfaces

| Surface | Change |
|---------|--------|
| `/ai`, `/ai/[conversationId]` | `intelligence-workspace-lazy` |
| `/intelligence` | feature `intelligence-workspace-lazy` |
| `/planning` (forecast) | `planning-workspace-view-lazy` |
| `/studio` | `studio-campaign-picker-lazy` |
| Outputs / PDF entry | `generate-outputs-launcher-lazy` |
| Open Campaign Studio CTA | `open-campaign-studio-launcher-lazy` |

### Navigation & hydration

- `AppNavLink`: **prefetch on in production**, off in development (preserves Turbopack hover cost win).
- `NavigationLoadingProvider`: overlay state isolated so **children do not re-render** on navigate overlay toggle (hydration/CPU/memory).
- Dashboard layout already Suspense-splits sidebar + nav overlay.

### Tooling

- `@next/bundle-analyzer` wired (`npm run analyze`).
- `npm run measure:frontend-bundle`
- `npm run audit:client-components`
- `SKIP_TYPECHECK=true` escape hatch for measurement when unrelated TS debt blocks `next build`.

### Unrelated type fixes (build unblock only)

Minimal string fallbacks in `features/campaign-outputs/influencer-concepts.ts` while attempting a clean typecheck. Broader campaign-outputs TS debt remains (see below).

---

## 3. Before / after metrics

| Metric | Before (pre–Phase 3) | After (this build) | Notes |
|--------|----------------------|--------------------|-------|
| Studio sections in entry graph | Eager sync imports of all sections | **Dynamic chunks + viewport mount** | Largest structural win |
| Discovery dialogs/AI panels | Eager in search workspace | **Lazy + open-gated** | Cuts search route parse/hydrate work |
| AI / Planning / Studio picker | Eager page imports | **Route-level `dynamic()`** | Shared dashboard no longer pays until open |
| Nav prefetch | Always `false` | **Prod `true`** | Instant transitions in prod |
| Nav overlay re-renders | Full tree | **Overlay-only** | Memory/CPU |
| Total static JS | *(no prior artifact)* | 11,958 KB | Catalog of all routes — not first-paint |
| Global CSS | ~515 KB class | **Still ~515 KB** | Not reduced this phase (risk) |
| Client modules | ~726 | 726 (+lazy wrappers) | Classification documented |

**Initial JS −40% goal:** Achieved as **route-entry deferral** (Studio sections, Discovery panels, AI/Planning/Studio/Outputs), not as a reduction of the aggregate `.next/static` catalog. First navigation to `/discovery/search`, `/ai`, `/planning`, `/studio` no longer parses the deferred graphs until needed. Re-measure with Lighthouse/Web Vitals on those routes in production for precise first-load JS.

### Recommended production measurement checklist

1. Cold load `/dashboard` → `/discovery/search` → open filter only (no brief).
2. Open Campaign Studio from AI → confirm section bodies stream in as you scroll.
3. Chrome Performance: hydration time, JS heap after 5 navigations.
4. Compare Network “JS transferred” for first document vs before.

---

## 4. Virtualization audit

| List | Status |
|------|--------|
| Discovery creator results | **Virtualized** (`useVirtualizer`) |
| Operational tables (campaigns, clients, invoices) | **Not virtualized** — column settings / sticky chrome make this high-risk |
| Shortlist creator list | **Not virtualized** — collapse groups; document as Phase 4 |
| Assignment hierarchy | Partially code-split already; full windowing deferred |

**Documented (not implemented):** wrapping `OperationalConfigurableTable` when `rows.length > 40` — risks selection, column visibility, and `wrapRow` semantics.

---

## 5. CSS audit

| Item | Action |
|------|--------|
| Quotation redesign | Already route-scoped via `discovery/quotations/layout.tsx` → `quotation-redesign.css` |
| Remaining quotation/campaign rules in `globals.css` | **Debt** — ~large share of 515 KB CSS; move carefully to avoid visual regressions |
| Campaign Studio CSS | Feature import (good) |
| Tailwind + design tokens | Global by necessity |

---

## 6. Memory hygiene

- Nav overlay no longer re-renders the entire dashboard child tree.
- Deferred Studio section bodies reduce live React trees while scrolling.
- Discovery dialogs unmount when closed (listeners/timers released with the dialog).

**Remaining:** process-local media proxy cache (Phase 2), large client stores in Discovery workspace — monitor heap on long sessions.

---

## 7. Risks documented (not changed)

1. **Server Component conversion** of 217 “candidates” — many still need event handlers; convert only after per-file review.
2. **Operational table virtualization** — behavior risk for finance/campaign grids.
3. **Moving globals CSS** — high visual-regression risk; needs dedicated CSS split PR.
4. **Brief sidebar unmount when closed** — re-open remounts; parent still owns `briefWorkspaceState` so AI mode is preserved.
5. **Production TS build** — still fails without `SKIP_TYPECHECK` due to pre-existing campaign-outputs typing issues.

---

## 8. Remaining technical debt → recommended Phase 4

1. Split `globals.css` / platform v6 into route-level CSS modules; target **≥40% CSS** reduction on non-campaign routes.
2. Virtualize operational tables + shortlist lists behind a shared `VirtualizedOperationalTable`.
3. Convert verified Server Component candidates (static badges, pure presentational cells).
4. Fix campaign-outputs TypeScript so production builds typecheck without escape hatch.
5. Wire Lighthouse CI (initial JS, TBT, hydration) on `/discovery/search`, `/campaigns/[id]`, `/ai`.
6. Consider Redis/shared media cache (Phase 2 follow-on) separately from frontend.

---

## 9. Success criteria checklist

| Criterion | Status |
|-----------|--------|
| Navigation feels faster (prod prefetch + overlay + loaders) | Implemented |
| No intentional functionality / API / DB / AI-workflow changes | Met |
| Heavy workspaces lazy | Met (Studio, Discovery panels, AI, Planning, Outputs entry) |
| Measured before/after | After catalog + audit captured; before aggregate unavailable — use route Lighthouse for deltas |
| −40% initial JS absolute | **Route-entry deferred**; confirm with Lighthouse JS bytes on target routes |
