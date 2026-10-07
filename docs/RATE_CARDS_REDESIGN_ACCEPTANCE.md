# Rate-card redesign acceptance — 7 October 2026

Implementation: `features/rate-cards/workspace.tsx`, `register-view.tsx`, `offer-table.tsx`, and `.rx`-scoped `redesign.css`. The supplied pricing module and its 44 assertions were copied unchanged. The latest independent upload-dialog redesign was merged and retained.

The original local HTML was blocked by browser policy. The user explicitly approved source inspection and verification of the implemented app. Its markup, styles, state handlers, specification, and FEATURE-MAP were inspected. Browser state checks below used the actual React components with deterministic action fixtures; they do not claim successful writes to the live database.

## Specification §8

| Acceptance item | Result / evidence |
|---|---|
| Both pages; back preserves register filters | Passed browser scenario with a search filter, detail, and breadcrumb return. |
| Register nine columns, 25/page, updated descending | Implemented; verified DOM and existing query configuration. Currency retained under rate-card name. |
| All filters, advanced panel, chips, reset | Implemented; filter and empty-state browser scenarios passed. |
| Client-level fallback | Verified with brand-less fixture. |
| Distinct deletion confirmations | Verified version-only and entire-card wording; no destructive writes during QA. |
| Whole-version counts | Existing summary action retained; explicit caption. |
| Offers versus pricing lines | Browser selection fixture reports two offers and five underlying records. |
| Private/client bands | Verified rendered table and screenshots. |
| Optional quantities and Event Attendance | Verified labelled 2-day chip and daily rate/total of 15,000/30,000. |
| Missing, zero, incomparable | Pricing assertions, adapter/workbook tests, and UI fixtures retain all three states and tooltip reasons. |
| No FX conversion | Supplied display helpers and workbook formulas preserve currencies; mixed-currency test passes. Existing quotation-application workflow untouched. |
| Apply All scope and confirmation | Browser shows 269 creators, including hidden/other-page records; cancelling performs no write. |
| Blank uplift preserves | Existing server omission behavior retained; supplied pricing assertions pass. |
| Bulk preview invalidation | Browser verifies rule/scope change removes confirmation; stale server errors also invalidate preview. |
| Three client reports exclude private data | Existing report privacy regressions pass. New client Excel allowlist tests inspect the serialized workbook, including cost-only creators. |
| Arabic/RTL and Latin numerals | RTL screenshots inspected; numeral assertion passed. Creator names isolated with `bdi`. |
| Keyboard, drawers, menus, table | Menu Enter/Escape and drawer Tab/Escape exercised; focus styles and keyboard-scrollable table region present. |
| Responsive widths | 1920, 1440, 1280, 768 and 375px checked, with contained table scrolling and no document horizontal overflow. |
| Decorative pseudo-elements | Scoped header decoration uses `pointer-events:none`. |
| Close-selector trap | React callbacks and Radix dialogs; no bare `[data-close]` query. |
| Pricing tests | All 44 supplied assertions pass; strict compilation passes. |
| Preview switcher excluded | No `.rx-demo` controls shipped. |

## FEATURE-MAP reconciliation

Register creation, editing, duplication, activation, both deletions, upload, templates, filtering, sorting and pagination remain connected to existing actions. Version metadata, summary, add/discovery/profile-URL flows, independent prices, optional services, service-specific fees, travel uplifts, selection/removal, photo editing, audit, upload and the three existing report types remain accessible.

Integration choices preserve the existing backend: workspace pagination still loads 25 creator/platform groups; offer and record counts are separately labelled. The three offer-view tabs filter the loaded page and say so. Bulk pricing remains version-wide, rather than implying unsupported selected-offer-only mutations. Its action remains on the main rail.

## Added requests

- Client Excel: full version, including unpriced offers, with client prices, currencies, package composition, optional services, quantities, totals, individual fees and travel uplifts. Private costs, GP, markup and notes are absent from the workbook.
- Internal Excel: download menu above the pricing table; all matching pages for search/platform/currency, private columns and complete underlying records included. Workbook scope is explicit.
- Workbooks have an overview, styled headers, filters, frozen panes, numeric formats and printable sheets. Formula cached values and workbook structure were tested; no desktop Excel recalculation was claimed.
- Preview opens inside a separate dialog. Back closes only that preview; the workspace remains available. The workspace breadcrumb returns to the register.

## Validation

Production-mode Next build and TypeScript passed after integrating the latest upload work. Targeted rate-card suite: 30 tests passing, plus 44 supplied pricing assertions. The 11 workspace-classification checks also pass. Changed UI files pass ESLint. No database migration or pricing-calculation changes were introduced.

Authenticated dev verification caught and corrected a shared dialog translation that moved drawers off-screen, and a missing internal-workspace classification for the new Excel route. The corrected drawer is fully visible; clicking Preview loads the selected real report and Back returns to the export drawer with the rate card still open.

## Additional offer controls

The subsequent user request adds a clickable creator name and row-menu actions for creator details, linking another profile URL, manual creator replacement, editing a deliverable/package, adding a deliverable, and deleting the complete offer. Package edits validate quantities and linked profile ownership; replacement uses the replacement creator's matching platform accounts. Each metadata update uses one SQL update and leaves prices/fees/currencies unchanged. Existing uniqueness constraints reject conflicts. The deletion confirmation names the affected creator and underlying record count. These actions use existing authenticated permissions, creator-linking services, RLS, and audit triggers.
