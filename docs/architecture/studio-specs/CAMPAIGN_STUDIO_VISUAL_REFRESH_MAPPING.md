# Campaign Mode Studio — Visual Refresh Mapping

**Status:** Architecture Reopen approved (Campaign Mode Studio workspace only)  
**Prototype SSOT:** `docs/architecture/studio-specs/campaign-studio.html`  
**Constraint:** Visual/UX layer only — no parallel engines, SSOTs, or Campaign Workspace / platform-nav redesign.

## Hierarchy verdict (2026-09-08)

**APPROVED · FROZEN.** Live Campaign Mode hierarchy signed off. No further structural changes.

Frozen chrome on all four modes:

1. Campaign Mast / Context  
2. Campaign Mode tabs (Studio | Outputs | Director | Decision mode)  
3. Mode-specific body  

- Mast persists across all four modes (shared campaign context — do not duplicate in bodies).  
- Mast + tabs = one frozen Campaign Mode header (tabs below mast, not above).  
- Planning rail only on Studio / Decision — not forced into Outputs or Director.  

Live shots: `docs/architecture/studio-specs/review-shots/live-hierarchy-*.png`  
Fixture: `docs/architecture/studio-specs/campaign-studio-hierarchy-review.html`  

**Next:** visual polish implemented — awaiting Product review of polish shots before commit.

## Out of scope (do not implement from prototype)

| Prototype | Reason |
|-----------|--------|
| `.tw-app` / `.tw-nav` left product nav | Platform navigation — already owned outside Studio |
| Sample Tafareeh Tea FIND / hard-coded gaps | Demo data only — live findings come from existing Studio services |
| Parallel Campaign Object / quotation / media-plan models | Preserve ownership boundaries |

---

## Screen → live surface map

### 1. Campaign masthead + campaign context

| Prototype | Live today | Action |
|-----------|------------|--------|
| `.tw-frozen` sticky chrome | `StudioTopChrome` + `cs-chrome-stack` in `campaign-studio.tsx` | **Structural UI** — sticky frozen stack wrapping mast + mode tabs |
| `.tw-mast` / `.tw-mh` (mark, THINKWAY, campaign id, title, status, CTAs) | `studio-top-chrome.tsx` (`cs-meta-bar`, progress ring, export) | **Restyle** mast to gradient/mark treatment; **reuse** title, readiness %, export, review CTA wiring |
| Build quotation / Export buttons | `CampaignProposalExportActions` + Package / quotation flows | **Reuse** existing actions; place in mast CTA row |

**Files:** `studio-top-chrome.tsx`, `campaign-studio.tsx`, `campaign-studio-ref.css`, `campaign-studio-ref-tokens.ts`

---

### 2. Six-step Studio rail

| Prototype | Live today | Action |
|-----------|------------|--------|
| `.tw-rail4` / `.tw-stp` (Intake→Package) | `studio-workspace-nav.tsx` (navy left nav) + `studio-workspace-step-bar.tsx` (horizontal chips) | **Structural UI** — desktop: rail is primary step UI (document-side sticky); hide redundant horizontal step bar on desktop viewport; keep step bar for non-desktop |
| Step flags (attention dots) | `StudioWorkspaceStepView.status` / outdated / blocked | **Reuse** status → flag styling |
| `.tw-wrap` grid (rail + doc) | `cs-shell` / `cs-navigator` / `cs-main` | **Restyle** to wrap/rail/doc proportions |

**Files:** `studio-workspace-nav.tsx`, `studio-workspace-step-bar.tsx`, `campaign-studio.tsx`, CSS

**Engine reuse:** `resolveStudioWorkspaceSteps`, `StudioWorkspaceStepId`, Intake→Package screens unchanged.

---

### 3. Main campaign planning / document area

| Prototype | Live today | Action |
|-----------|------------|--------|
| `.tw-doc` / `.tw-sect` / `.tw-sect__h` | `StudioStepShell` + `StudioWorkspaceScreen` + step screens | **Restyle** section headers / document density; keep children |
| `.tw-band2` KPI band | Step-level KPI / stat tiles (`cs-stat-tiles`, intake/package bands) | **Restyle** band treatment where bands already exist |
| `.tw-dl2` definition lists | Field grids / brief fields | **Restyle** only |
| Intake / Strategy / Creators / Content / Commercial / Package pages | `intake-screen.tsx`, strategy/creators/content/commercial via `studio-workspace-screen.tsx`, `package-screen.tsx` | **Reuse** all screens & data paths |

**Files:** `studio-step-shell.tsx`, `studio-workspace-screen.tsx`, workspace/* screens, section cards, CSS

---

### 4. Attention / gaps / decisions / next-actions

| Prototype | Live today | Action |
|-----------|------------|--------|
| `.tw-q2` warn callouts | `StudioFreshnessBanner`, package readiness gaps, decision-impact copy | **Restyle** callout chrome; **reuse** freshness + readiness content |
| `.tw-fx` “review” flags | Links into review findings | **Structural UI** — open review drawer from flags |
| Next-action CTAs | Package readiness / step actions / Decision Center-adjacent Studio CTAs | **Reuse** existing handlers |

**Files:** `studio-freshness-banner.tsx`, `services/studio-package-readiness.ts`, `studio-decision-impact-panel.tsx`, new thin review-drawer shell

---

### 5. Outputs area

| Prototype | Live today | Action |
|-----------|------------|--------|
| Mode tab **Outputs** + `.tw-tilegrid` / `.tw-tile` | `OutputsCenter` (`features/campaign-outputs/components/outputs-center.tsx`) + Package generate CTAs | **Structural UI** — add host mode view that mounts existing `OutputsCenter`; **restyle** tile chrome to match prototype if needed via outputs-center-ref (no new registry) |
| Pin / Generate / Open Media Plan | Existing output actions | **Reuse** |

**Files:** `campaign-studio-host.tsx`, `studio-mode-toggle.tsx`, optional thin wrapper; **not** a new outputs engine

---

### 6. Campaign Director area

| Prototype | Live today | Action |
|-----------|------------|--------|
| Mode tab **Director** + `.tw-rec2` recommendation list | `runReviewCampaign` / director package (`features/campaign-outputs/director/`), Studio recommendation narrative, Campaign Director pipeline | **Structural UI** — host mode mounts existing Director review UI; **restyle** recommendation cards |
| Apply actions | Existing director / copilot apply paths | **Reuse** |

**Files:** host + director UI entry already in campaign-outputs/director; Studio narrative panels stay consumers

---

### 7. Review drawer / review experience

| Prototype | Live today | Action |
|-----------|------------|--------|
| `.tw-rev2` + `.tw-scrim3` + `.tw-fnd` findings | No dedicated drawer; findings split across freshness banner, package readiness, Director review | **Structural UI** — new presentation-only drawer aggregating existing finding sources (freshness + package readiness + director findings when available) |
| Review · N mast button | Export / package CTAs only today | **Wire** to drawer open; count from live finding list |

**Files:** new `studio-review-drawer.tsx` (UI only), wire from chrome + host; sources: `studio-facts-freshness`, `studio-package-readiness`, director review result

---

### 8. Decision / scenario presentation

| Prototype | Live today | Action |
|-----------|------------|--------|
| Mode tab **Decision mode** + `.tw-scn` scenario cards + score ring | `StudioWorkspaceMode` presentation \| decision; `ScenarioBar`, `DecisionRightPanel`, `useDecisionWorkspace`, `CampaignStudio` + `decisionMode` | **Restyle** scenario chips → cards; **reuse** promote/apply/scenario store |
| Verdict / delta copy | Decision right panel + simulation | **Restyle** presentation |

**Files:** `studio-mode-toggle.tsx`, `campaign-studio-host.tsx`, `scenario-bar.tsx`, `decision-right-panel.tsx`, CSS

---

## Mode tabs (prototype vs live)

| Prototype tab | Live mapping |
|---------------|--------------|
| Studio | `presentation` — existing `CampaignStudio` six-step workspace |
| Outputs | **New host mode** → mount existing `OutputsCenter` (same Campaign Object) |
| Director | **New host mode** → mount existing Director review surface |
| Decision mode | Existing `decision` mode — scenarios + decision overlays |

Extend `StudioWorkspaceMode`; do not fork Campaign Object or decision simulation.

---

## Classification summary

| Layer | Reuse (engines / data / actions) | Restyle (CSS / tokens / chrome) | Structural UI only |
|-------|----------------------------------|----------------------------------|--------------------|
| Campaign Object / SSOT | ✓ | | |
| Intake→Package steps & screens | ✓ | document headers, bands, callouts | rail primary on desktop; wrap/doc layout |
| ECI / Discovery / slate | ✓ | card chrome if visible in Creators | |
| Budget / Quotation / Media Plan ownership | ✓ | | |
| Outputs registry + OutputsCenter | ✓ | tiles toward prototype | host Outputs mode |
| Director / Copilot | ✓ | recommendation cards | host Director mode |
| Decision / scenarios | ✓ | scenario cards / score | mode tab chrome |
| Package readiness / approval | ✓ | | feed review drawer |
| Platform nav / Campaign Workspace OS | untouched | | |

---

## Implementation order

1. Port prototype Studio chrome CSS under `.campaign-studio-ref` (no global `.tw-nav` app shell).
2. Restyle mast + mode tabs; desktop wrap/rail/doc; demote horizontal step bar on desktop.
3. Review drawer aggregating existing findings.
4. Host Outputs + Director modes on existing components.
5. Decision scenario visual refresh.
6. Document-area section shell polish (step screens unchanged functionally).

## Regression posture

- Preserve `npm` Studio / decision / outputs / package readiness tests.
- No Campaign Workspace Lifecycle OS / BPN / platform nav changes.
- No Studio capability-contract text changes beyond this approved visual reopen.
