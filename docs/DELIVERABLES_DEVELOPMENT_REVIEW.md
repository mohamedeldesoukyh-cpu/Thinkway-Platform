# Deliverables development review

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
| Default missing; satisfied creators hidden/collapsed | Implemented; status/search intersection tested. **Real campaign browser verification pending.** |
| Scrim / Back / Escape / dismiss close routes | PASS all four in browser fixture harness: hidden/display:none and body padding restored. Back, dismiss and Escape also verified focus returned to Open. |
| Checkbox does not open sheet | PASS browser: selected one missing slot; selection bar showed 1 selected / 1 need a file / 0 ready, sheet stayed hidden. |
| Inside sheet does not reopen it | PASS browser: caption field edited without navigation/reopening; Minimise measured 84px. No data was saved. |
| Hidden guard | Exact `.sh[hidden],.dv [hidden]{display:none!important}` retained. |
| Four platform marks at 22px inline | Fragment rules and existing brand styles retained; **browser check pending**. |
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

Not yet signed off on real campaign data. Development currently requires sign-in. The implemented React component was tested in a separate read-only local browser harness (six deliverables, two creators; all writes disabled). Default missing showed four cards across two creators. Collapse all retained both compact creator headers and removed their cards; Expand all restored them. This does not satisfy the requested real 30+ creator campaign check.

The three specifically requested browser checks (four close routes, checkbox guard, widths/scroll breakpoint) passed in that harness. Real server-action integration, all four platform marks, and real-campaign performance remain unverified in the authenticated development app. The standalone preview file URL was blocked by browser URL policy; it was not served through another route.

Development deployment `dpl_5Ug52jEkAZ41yeQQHY6yJc3rEQ7P` is Ready (Preview) and has the `dev.thinkwaymedia.com` alias. Application revision: `dcdb098c`. Production was not deployed or aliased.
