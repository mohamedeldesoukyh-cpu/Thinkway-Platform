# Deliverables development review

## Release gate (supersedes earlier wiring notes)

Single and bulk Release in this new panel are now unconditionally disabled, with no handler and no release-action import/call. Uploads remain internal. The disabled controls explain that confirmation and retraction are pending. Future enablement requires exact count/client confirmation, single/bulk distinction, and a retract path.

Release was previously wired only; no real release was exercised. Read-only throwaway fixture testing with uploaded content confirmed both buttons disabled. This is a gate test, not a successful backend release test. No real client record was used for release testing. Upload and Save remain wired to existing actions.

The reproducible full-page warning and exact console output are retained in [DELIVERABLES_HYDRATION_ISSUE.md](DELIVERABLES_HYDRATION_ISSUE.md), still open. User has authorized production UI deployment with Release held behind this gate.

Scope: `/campaigns/:slug?tab=deliverables` only. Production remains on `a7e5bb63`.

## CSS decision

Found option **2**, private section sheets, not a shared campaign sheet. A promotion would change unrelated sections, so this implementation uses the explicitly permitted temporary scoped copy. Each copied block is tagged `DUPLICATED from vendor-detail-suite.css; consolidate into a shared campaign sheet`.

Copied roots: `tw-av tw-b tw-c tw-ch tw-ck tw-cr tw-cs tw-ct tw-ft tw-g tw-hint tw-in tw-lbl tw-miss tw-ms2 tw-p tw-sc tw-selbar tw-sp tw-t`, plus the consumed `tw-pf` and the extended `tw-hr tw-r tw-seg`. Their existing modifiers and design tokens are included. The fragment's new rules follow these dependencies. No preview CSS was copied. All 96 fragment classes resolved in the class audit.

## §9 acceptance status

| Item | Evidence / state |
|---|---|
| 8 grid blocks × 8 children, one `--cols` | PASS supplied six-deliverable fixture. Runtime template checks header + N rows + footer, eight cells each and one inherited declaration. |
| Empty final header span | PASS source and grid check. |
| Fills 1050 / 1450 / 1800px | PASS browser: real component in isolated fixture harness; grid and scroller measured exactly 1050 / 1450 / 1800px. |
| Horizontal scrolling below 1030px | PASS browser: 1000px container, 1030px grid/scrollWidth. |
| Upload inside section, no duplicate | New panel replaces both old conditional surfaces in the campaign workspace. Only its second tab exposes uploads. |
| Default missing; satisfied creators hidden/collapsed | PASS real development campaign: 84 missing deliverables across 32 creators. Collapse all retained 32 headers and hid all cards; Expand all restored 84. This campaign has no satisfied creators; mixed-status coverage remains fixture-based. |
| Scrim / Back / Escape / dismiss close routes | PASS all four in browser fixture harness: hidden/display:none and body padding restored. Back, dismiss and Escape also verified focus returned to Open. |
| Checkbox does not open sheet | PASS browser: selected one missing slot; selection bar showed 1 selected / 1 need a file / 0 ready, sheet stayed hidden. |
| Inside sheet does not reopen it | PASS browser: caption field edited without navigation/reopening; Minimise measured 84px. No data was saved. |
| Hidden guard | Exact `.sh[hidden],.dv [hidden]{display:none!important}` retained. |
| Four platform marks at 22px inline | Instagram, TikTok and YouTube measured 22×22px on real campaign. Snapchat is absent from this campaign and remains unverified in browser. |
| No bare global element selectors | All added dependencies scoped under `.dv`; new fragment roots retained. |
| Count matches each chip | PASS browser fixture: missing 4, uploaded 1, with client 1, approved 0, all 6; rendered visible-slot count matched each. |

## Grid output

```
PASS fixture: 8 blocks × 8 children; one shared --cols value (span-aware).
PASS implementation: header + N rows + footer × 8 cells; one inherited --cols declaration.
```

The check is wired into `.github/workflows/validate.yml` along with the data-model regression tests.

## §8 additions

- `aria-pressed` for the two surface buttons and status filters.
- Named modal dialog, title focus on opening, focus returned on closing, Tab/Shift+Tab focus containment.
- Labels for previous/next, Back, dismiss, selection checkboxes, clear selection, search, and editable fields.
- Real keyboard-operable Browse buttons for drop zones.
- Group `aria-expanded`, live filtered count, upload status announcements and error alerts.
- Visible focus outlines, reduced-motion rules, and body-padding restoration on close/unmount or campaign tab change.

## Data and actions

The panel loads saved assets, latest client decisions, scripts and review dates in batches. Script presence is independent of content status. New panel uploads and links remain internal until Release; existing upload surfaces retain their prior behavior. Upload type and 150 MB limits are validated on the server as well as the client. Existing script editor, preview, upload transport, review-date concurrency checks, creator attribution and publication actions are reused.

TypeScript and the Next.js build passed. Eighteen model/documentation/attribution tests passed. Local build had the existing project-root tracing warning.

## Real campaign / browser gate

After user sign-in, tested the real development campaign **Campaign — Quotation — TUNA DOLPHIN – DELTA CAMPAIGN (V2)** (`TW-2026-0005`, slug `campaign-quotation-tuna-dolphin-delta-campaign-v2-8265ff15`). It contains 32 creators and 84 deliverables. Default missing rendered 84 cards across 32 creators. Collapse all left 32 compact creator headers, no visible cards, with the count unchanged; Expand all restored them. Panel height reduced from about 14,331px to 1,727px at the current browser width. Thus collapse-all works, but the initial all-missing campaign is still a long list, as specified.

Real chip/manual counts: Missing 84, Uploaded 0, With client 0, Approved 0, All 84. Searching Reham within Missing showed three deliverables for one creator. All four sheet-close routes passed again in the authenticated application. Selecting a checkbox showed the selection bar without opening the sheet. Detail data loaded; the saved go-live date was visible. Nothing was uploaded, released, edited or saved to campaign records.

The live Schedule rendered 86 grid blocks (84 rows + header + footer), and at a 908px scroller width its 1030px grid remained horizontally scrollable. Exact 1050/1450/1800px checks remain covered by the real-component browser harness. Mixed-status checks also used that six-deliverable fixture because this real campaign has no received files.

Remaining limitations: no write-path integration test against real records; Snapchat mark absent from the real campaign; browser console recorded React error #418 (hydration text mismatch) during campaign navigation. Its source is not established, so full page-level console sign-off is not claimed. The standalone preview file URL was blocked by browser URL policy; it was not served through another route.

Development deployment `dpl_5Ug52jEkAZ41yeQQHY6yJc3rEQ7P` is Ready (Preview) and has the `dev.thinkwaymedia.com` alias. Application revision: `dcdb098c`. Production was not deployed or aliased.

## Follow-up: hydration, mixed statuses and Snapchat

The React port already owns filter/query in state; visible rows, count, hidden, is-shut and aria-pressed come from JSX. No fragment apply() or effect patches these DOM values, and no suppressHydrationWarning was added. Hidden empty groups now also report aria-expanded=false. The async snapshot fetch updates data state normally; SSR and the initial client render both show the same nonempty loading count until data arrives.

`scripts/build-deliverables-review-harness.cjs` bundles the actual panel into an isolated read-only SSR/hydrateRoot harness using `tests/fixtures/deliverables-mixed-84.json`. Server HTML assertions passed for a nonempty dvCount, aria-pressed=true on Missing, and hidden on the inactive section. Browser hydration reported no recoverable errors and no console errors. This verifies the panel; it does not establish the cause of the earlier full-page React #418 warning.

Browser chip counts and rendered cards matched: Missing 30, Uploaded 24, With client 18, Approved 12, All 84. Creator 28 has three approved items: hidden in Missing, present in Approved and All. The same fixture has an automated model regression test (all five tests passed).

Snapchat browser computed style: background rgb(245,217,10) (#F5D90A), text rgb(11,15,26) (#0B0F1A), mark and wrapper both 22×22px, no cropping. The text color is explicit, not inherited.

Upload/Save are wired, not mock stubs: signed file upload with progress, caption/link/note/review-date saves, script editor and publication URL action. Release calls the existing release action; uploads remain internal until release. Bulk review-date save and release are also wired. Fixture write handlers throw rather than modify records. No real upload/save/release was executed during these checks.
