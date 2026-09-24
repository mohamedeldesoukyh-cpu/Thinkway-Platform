# Collections-only redesign verification

Scope was narrowed by the user to Collections. Vendor/client components, their stylesheets, sidebar, top bar, and auth shell remain unchanged. There is no global style extraction or source-page de-duplication.

## Styles

- Existing component declarations copied byte-for-byte into `.collections-suite` selectors. The extraction manifest records each source declaration block.
- Modifiers remain anchored to component classes. Existing standalone pill modifiers are compounded with `.tw-p` in the Collections copy.
- The fragment's own rules are copied with a Collections scope prefix to prevent leakage and to override the existing finance-suite deck specificity.
- No CSS is copied from the standalone visual reference.

## Reference update

The supplied fragment changed during this task: its latest contents contain six sections and 20 grid blocks across three track lists. The user explicitly reiterated all seven sections, including Vendor payables. The original seventh-section grid structure is preserved in `payables-grid-fixture.html`: seven campaign grids and eleven payable grids. Together these test the original 38-block/five-track-list acceptance target.

## Checks

- `node scripts/check-collections-grid.cjs`: 38 acceptance grids, five track lists, span credit, mismatch rejection, copied declaration identity, and Collections-only selector containment pass.
- Six Node regression tests pass: currency separation, paid/open amounts, empty currencies, due-date bucket boundaries, missing due dates, computed overdue percentages, date formatting, and legacy/new deep links.
- TypeScript check passes against the isolated release project.
- Browser preview at 1409px: all seven tabs show exactly one panel, update `?tab=`, and have no document overflow.
- Browser validation: 47 rendered grids in the larger fixture dataset, five track lists, no child-count failures; expanded aging child/header/footer coordinates match the parent.
- Receipt form: selecting Record from an overdue invoice preselects that invoice, overpayment disables submission, and a partial amount updates the remaining balance.
- Reminder dialog: Save is disabled until contact confirmation. Browser preview mutations are stubbed; no live payment or contact is submitted in QA.

## Data behavior

All A/R views select a single currency; statements and payables additionally group by currency. Campaign payables split mixed-currency campaigns into separate rows. Forecast uses actual future due dates, excluding past-due and undated balances without inventing recovery dates. Missing invoice dates are excluded from buckets but retained in the open balance.

Payable due dates and confirmed contacts use existing `collection_audit_logs` entries (`payable_due_date_set` and `contact_recorded`). No migration changes shared schemas. Reminder logging does not send email. Receipt value dates use the existing payment timestamp column. CSV exports and browser Print / Save PDF are available; a dedicated emailed PDF generator is not introduced.
