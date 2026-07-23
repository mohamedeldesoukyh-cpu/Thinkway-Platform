# Thinkway UI Redesign — Implementation Spec for Cursor

## How to use this doc
This describes *behavior and structure*, not a copy-paste page dump — that's what made the raw HTML files hard for Cursor to place into an existing component-based codebase. Implement it section by section against your real components/routes.

Each section below names the **reference HTML file** with a full working version of that exact CSS/markup/JS if you need to check precise values (spacing, animation timing, etc). Attach that single file to Cursor's context when working on that section only — not all of them at once.

Load `thinkway-design-tokens.css` globally first. Every class/variable name below assumes those tokens exist.

Reference files (attach one at a time, as needed):
- `thinkway-campaign-outputs.html` → Outputs Center page
- `thinkway-campaign-studio.html` → Campaign Studio page
- `thinkway-quotation.html` → Quotation page
- `thinkway-campaign-requirements.html` → Campaign Requirements side panel
- `thinkway-campaign-intelligence.html` → Campaign Intelligence side panel
- `thinkway-intelligence.html` → Thinkway Intelligence chat home

---

## 0. Global rules (apply everywhere)

1. **Font**: Geist for UI text, Geist Mono for anything numeric — IDs, versions (`v21`), prices (`EGP 1,235,560`), dates, sizes (`96.4 KB`), percentages in data tables.
2. **Brand gradient** (`--brand-gradient`) is reserved for: primary CTA buttons, the Copilot avatar, hero banners (e.g. budget total), progress rings. It is never a background for a whole page or panel.
3. **Status colors are separate from brand color.** Green/amber/red/purple communicate state (complete, pending, risk, AI-reasoning). Blue communicates "this is brand / primary action." Don't reuse blue for "success."
4. **One floating assistant per page, not one per card.** See §1.4 — this was a bug in the original app (a Copilot bubble duplicated next to almost every card). There must be exactly one `<CopilotFab />` instance mounted at the app-shell level, never inside a card/list item component.
5. **Topnav background is white**, not dark navy — only the logo *mark* (the small icon square) is navy. This was corrected after the initial pass; don't regress it.

---

## 1. Shared chrome (build these as shared components first — everything else composes them)

### 1.1 Topnav (`<AppTopnav />`)
- Height 56px, white background, `border-bottom: 1px solid var(--border)`, `padding: 0 16px`.
- Left: logo mark (30×30, `border-radius:9px`, `background:var(--navy)`) containing a white circle (top-left, ~37% of box size) and a small blue-400 circle (bottom-right, ~20% of box size) — this is the real Thinkway mark, not a generic icon. Wordmark next to it: "THINK" in `--ink`, "WAY" in `--blue`.
- Right: Help link (icon+label), a sun/toggle/moon theme switch (three elements: sun icon, pill toggle, moon icon), user avatar (brand-gradient circle with initials), username text.

### 1.2 Subnav (`<AppSubnav />`)
- Height 46px, white, `border-bottom`, sticky under the topnav (`top: 56px`).
- Left: tab group (Studio / Outputs / Director), active tab gets `border-bottom: 2px solid var(--blue)` and darker text.
- Right: primary button **"New chat"** (brand-gradient, icon+label) + secondary **"History"** button (outlined). *Keep this exact label — "New chat," not "New Campaign." This was tried and reverted; don't rename it again.*

### 1.3 Section-jump nav pattern (reuse on any long page with 3+ logical groups)
Used on Outputs Center (Sections: Strategy/Planning/Client/Internal) and Campaign Studio (Step bar: 1–6).
- A horizontal, sticky bar of chips/pills, one per section, each showing a count badge.
- Clicking a chip smooth-scrolls the content so that section's start aligns just under the sticky chrome.
- The chip for whichever section is currently in view gets the brand-gradient fill (`.active` state); everything else is neutral/outlined.
- Implement the "currently in view" detection with `IntersectionObserver` watching each section wrapper, `rootMargin` pulled up by the sticky-chrome height so a section counts as "active" as soon as it reaches the top of the scrollable area, not when it's merely visible.

### 1.4 Copilot FAB (`<CopilotFab />` — mount once, globally)
- Fixed position, bottom:22px right:24px, `z-index:200`.
- **Default state**: a 52px circle only (icon + pulsing "ping" dot in the corner). No label text visible.
- **Hover (desktop) or tap-to-pin (touch)**: animates width to ~220–230px, revealing the label ("Campaign Copilot" / subtitle) with a short opacity-delayed transition so the icon doesn't feel like it's being stretched.
- On wide viewports (≥1300–1700px depending on page), reserve a right-side gutter in the content grid (~70–100px) so the FAB never sits on top of the last column of cards even mid-scroll, since it's `position: fixed` and will otherwise overlap whatever's in that screen corner at any scroll position.
- **There is exactly one of these per page.** If you're tempted to render it inside a card/list-item component, stop — lift it to the page/layout level instead.

---

## 2. Outputs Center page
Reference: `thinkway-campaign-outputs.html`

**Layout, top to bottom:**
1. Topnav, Subnav (§1.1–1.2)
2. Alert banner (amber) — one-line readiness nudge
3. Two "up next" action cards side by side — each shows a checklist of requirements with a check icon (done, green) or hollow circle (pending), plus a primary "Generate" button
4. Outputs Center header — icon, title, and a stat row: `● N generated · ● N need update · ● N available`
5. Settings list — 2 rows (Media Plan Presentation mode, Market Intelligence on/off), icon + title + description + control on the right
6. Section-jump nav (§1.3): Strategy / Planning / Client / Internal, each with a count
7. Card grid grouped by those same 4 sections, 3 columns desktop / 2 tablet / 1 mobile (4 columns only above ~1700px)

**Output card anatomy** (`<OutputCard />`, one component, driven by data — don't hand-build 18 near-identical card variants):
```
props: {
  title, description,
  status: 'up-to-date' | 'not-generated',
  version?: string,           // only when status === 'up-to-date'
  badge?: { type: 'active'|'soon'|'media', text },
  meta?: { updated, generator, generatedBy, estTime, size },
  sourceTags?: string[],
  variant?: 'default' | 'brief' | 'media-plan',
}
```
- `status-line`: green dot + "Up to date" + version chip (mono), OR grey dot + "Not Generated" — no version chip.
- Actions:
  - `variant: 'brief'` → "View brief" / "Edit brief" only, no meta/source/generate.
  - `variant: 'media-plan'` → single full-width "Open in Media Plan" button.
  - `status: 'up-to-date'` → row 1: Open (primary), Preview, Regenerate, Export, Share. Row 2 (ghost, smaller): Compare, History.
  - `status: 'not-generated'` → single full-width "Generate" button (brand-gradient); if `badge.type === 'soon'`, render disabled/muted instead.

---

## 3. Campaign Studio page
Reference: `thinkway-campaign-studio.html`

This is the dense, multi-section planning document. Build it as **data-driven sections**, not hand-authored markup per card — the reference file's `SECTION_HTML` map and `STEPS` array show the intended shape; port that pattern to whatever your data layer actually returns (likely an API response per section).

**Chrome stack, top to bottom, all `position: sticky`/fixed in this order:**
1. Topnav (56px)
2. Subnav (46px) — tabs are Studio/Outputs/Director; Studio active here
3. Meta bar — breadcrumb (`Campaign Studio / Campaign Summary`), campaign title, Presentation/Decision-Mode segmented toggle, and a **real** progress ring (don't ship a hardcoded "0%" if all sections are marked complete — compute it)
4. Agent row — small pills for active AI agents (Campaign Planner, Strategist, Scout, Analyst), each avatar has a green "active" dot
5. **Step bar** — this is the fix for the earlier "headers disappearing" bug. All 6 phase headers (`1 The Brief … 6 Sign-off`) are **permanently collected here**, not scattered through the scrolling content. Do not reintroduce per-section sticky headers that stack/replace as you scroll — that was tried and explicitly reverted in favor of this permanent bar.

**Body layout:** left navigator (fixed ~236px, own scroll region, `overflow-y:auto` — this must be scoped to its own column; the earlier bug was a black background bleeding down the whole page because the sidebar wasn't height/overflow-contained) + main scrollable content area, `max-width: 100%`, small (16px) side padding — don't cap it at a narrow centered column, the client explicitly asked for edge-to-edge use of the screen.

**The 6 phases and their subsections** (drives both the navigator tree and the step bar):
1. **The Brief** — Campaign Summary (brief text, budget/duration/type/platform stat tiles, client/brand/reach/objective/audience/product/market/deliverables fields)
2. **The Strategy** — Executive Strategy (paired insight cards: Business Challenge, Marketing Challenge, Audience Challenge, Strategic Insight, Chosen Strategy, Why This Wins, Director Conclusion, Rejected Alternatives, Tradeoffs, Success Conditions — each with a confidence % chip), Creative Concepts (3 concept cards: big idea / hook / CTA / hashtags), Director Decision Minutes (decision list with confidence badges)
3. **The Creators** — Vendor Discovery (funnel of filter-stage counts → final approved count), Vendor Recommendations (creator cards: avatar, tier, fit score, AI score, why-matched reasoning, evidence chips, Approve/Reject/Shortlist/View actions), Creator Mix (donut chart + tier bars)
4. **The Plan** — Budget Planner (brand-gradient hero banner with the total), Content Plan (table: platform/type/tier/qty/week/objective), Timeline (week-by-week cards)
5. **The Forecast** — KPI Forecast, Success Probability (big % + strengths/weaknesses/risks/how-to-improve in a 2×2), Industry Benchmark (expected-vs-industry comparison cards), Risk Analysis (severity-tagged risk cards), Strategic Opportunities (impact-tagged opportunity cards)
6. **Sign-off** — Executive Summary (decisions/actions/next-steps lists), Presentation Status (readiness checklist, version/lifecycle/status meta tiles, Submit/Export/Share/Duplicate actions)

**Card anatomy** — every card in every section shares one shell: icon chip (colored by section family — blue for brief/creators, purple for strategy, amber for plan, green for forecast, red only for risk), title, optional subtitle, a "Complete" badge top-right, then body content specific to that card type.

---

## 4. Quotation page
Reference: `thinkway-quotation.html`

Single scrolling document, sections top to bottom:
1. **Lifecycle rail** — a 3-node horizontal stepper: Shortlist (done, linked) → Quotation (current) → Campaign (pending/not linked), plus a live-sync pulse indicator.
2. **Client & brand card** — legal entity / brand / campaign selects, a "temporary client" checkbox that reveals extra scoping copy.
3. **Creators table** — search + filter toolbar, a KPI strip (base cost / client total / GP margin / margin %) that **recalculates live** as rate or margin-% inputs change (`total = cost / (1 - marginPct/100)`), then the creator rows themselves (avatar, platform badge, followers, rate input, calc-method pill, computed total/margin, editable margin%/fee% inputs).
4. **Document details** — issue/validity dates, status, version, department, prepared/reviewed/signatory fields, change-summary textarea, revision history list.
5. **Quotation notes** — plain textarea.
6. **Terms & conditions** — accordion list, 8 standard clauses.

---

## 5. Campaign Requirements side panel
Reference: `thinkway-campaign-requirements.html`

- **This is a right-docked sidebar** (slide-in from the right, `width: ~720px`, `height: 100vh`), not a centered modal — that distinction matters, it was corrected once already.
- Fixed header (title + close), fixed footer (Close / Run AI creator search), independently scrollable middle region.
- Middle region: source-file chip + extraction-issues flag, tabs for **Requirements** vs **Pipeline inspector** (the debug/technical trail — keep these separated; a business user reviewing requirements and an engineer debugging extraction are different audiences and shouldn't share one long scroll).
- Requirements tab: 2-column grid of requirement category cards (Brand & Market, Platforms & Audience, Creator & Keywords), each field showing extracted value + confidence %, or an "Add" affordance if empty. Ends with a green "Thinkway will search for" summary strip of the resolved filter chips.
- Pipeline inspector tab: horizontal clickable stepper (Structured parser output → LLM prompt → Raw JSON → Extracted profile → Normalized object → Validation changes → Final validated intelligence → Discovery mapping), each step opens its detail (prompt/JSON/diff) in a panel below on click — not all 8 expanded at once.

---

## 6. Campaign Intelligence side panel
Reference: `thinkway-campaign-intelligence.html`

Same right-docked sidebar shell as §5. Content:
- Legend bar explaining Extracted / Normalized / Inferred.
- "Field evidence review" — 2-up cards (Primary market, Audience countries), each with a large value, a confidence badge, and a confidence progress bar.
- "Commercial intelligence" — icon-led rows (Objectives, Deliverables, Duration); Deliverables renders as individual tag chips, not a run-on sentence.
- Footer: Close + primary "Edit intelligence."

---

## 7. Thinkway Intelligence (chat home)
Reference: `thinkway-intelligence.html`

- Left: conversation sidebar — "New chat" button (brand-gradient), search, date-grouped conversation list (Today/Yesterday/This week), each item has a small type icon (chat/campaign/vendor/budget), collapsible to an icon rail.
- Right: chat head (icon + title/subtitle + Help/Settings icons) → empty state → composer.
- **Empty state is not a spinner and not static suggestion cards** (both were tried and rejected). It's:
  - The real logo mark, correctly proportioned (see §1.1's ratio notes — don't eyeball a bigger version, scale every dimension from the 30px reference), centered inside a spinning conic-gradient ring.
  - A "Studio pulse — Live" label with a pulsing dot.
  - **No stat numbers and no boxed card around any of this** — those were both explicitly removed. If you're adding live stats back in per a future request, ask before reintroducing the box.
  - A lightweight, unboxed recent-activity feed below (optional, currently 3 items).
- Composer: pill-shaped input, attach button, auto-growing textarea, gradient send button. Placeholder text rotates through example queries every ~3s when the field is unfocused — small detail but intentional, don't remove it for a static placeholder.

---

## 8. Things that were tried and explicitly reverted (don't redo them)
- Dark/navy topnav → now white (§1.1).
- "New Campaign" button label → reverted to "New chat."
- Per-card duplicate Copilot bubbles → one shared FAB (§1.4).
- Centered 1120px content column with big side margins on Campaign Studio → now full-width with 16px padding.
- Per-section sticky headers that stack/replace as you scroll on Campaign Studio → now a single permanent step bar (§3).
- Suggestion-card grid and a boxed stats card in the Intelligence chat empty state → removed twice, now just the orb + label + unboxed feed (§7).

---

## 9. Codebase integration (Jul 2026)

### Token file
- **Location:** `app/thinkway-design-tokens.css`
- **Global import:** `app/globals.css` (`@import "./thinkway-design-tokens.css";`)
- **Geist fonts:** loaded once from the token file (removed duplicate `@import` from ref CSS).

### Scoped ref modules aligned
| Module | Scope class | CSS | TS constants |
|--------|-------------|-----|--------------|
| Outputs Center | `.outputs-center-ref` | `features/campaign-outputs/styles/outputs-center-ref.css` | `features/campaign-outputs/constants/outputs-center-tokens.ts` |
| Campaign Studio | `.campaign-studio-ref` | `features/campaign-studio/styles/campaign-studio-ref.css` | `features/campaign-studio/constants/campaign-studio-ref-tokens.ts` |
| Intelligence chat | `.studio-chat-ref` | `features/ai-workspace/styles/studio-chat-ref.css` | `features/ai-workspace/constants/studio-chat-tokens.ts` |
| Copilot FAB | `.copilot-ref` | `features/ai-workspace/styles/copilot-ref.css` | — |

Each scoped root defines `--oc-*`, `--cs-*`, `--sc-*`, or `--cp-*` aliases that point at canonical `:root` tokens (e.g. `--oc-blue: var(--blue)`). TypeScript color maps use `var(--token)` strings for inline styles.

### Shadcn / legacy shell coexistence
`app/globals.css` retains its own `--muted`, `--border`, `--radius`, and `--brand-gradient` for the existing dashboard shell (Tailwind/shadcn). Those names overlap the redesign spec but serve different purposes. Product UI ref modules should use:

- `--tw-border`, `--tw-radius`, `--tw-muted-text`, `--tw-brand-gradient` when they need **official** values inside the legacy shell, or the un-prefixed names (`--blue`, `--navy`, `--text-3`, etc.) which do not conflict.

### Ref vs spec conflicts resolved
| Token | Pre-integration ref value | Official spec | Resolution |
|-------|----------------------------|---------------|------------|
| Page canvas (Outputs) | `#eef2fb` | `--lavender` `#e8effe` | Canvas uses `var(--lavender)` |
| `--surface` (Outputs cards/tables) | `#e8effe` (lavender) | `#f3f6fc` | Uses official `--surface` |
| `--border` (Outputs) | `#dfe4ee` | `#e3e8f2` | Uses `--tw-border` |
| `--blue-light` (Outputs) | `#e8effe` | `#eef3ff` | Uses official `--blue-light` |
| Radii (Outputs) | 6 / 8 / 12px | 8 / 10 / 16px | Uses `--tw-radius`, `--radius-md`, `--radius-lg` |
| Copilot panel radius | 12px | 16px (`--radius-lg`) | Uses `var(--radius-lg)` |
| `--brand-gradient` (platform) | Cyan/purple/pink marketing gradient | Blue product gradient | Both kept: shadcn utilities use platform gradient; ref modules use `--tw-brand-gradient` |

Layout-specific tokens (section nav height, group label step, chat composer height, etc.) remain module-local — they are not part of the brand kit.
