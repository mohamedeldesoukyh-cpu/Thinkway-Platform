# Quotation redesign verification — 2026-10-08

Reference: user-supplied `quotation-redesign.html` and ZIP `FEATURE-MAP.md`.
The HTML's final blue-header rules take precedence over the older white-header description in the notes.

## Verification completed

- Production build and TypeScript pass.
- Quotation pricing-calculator tests, quotation row-math assertions, and Discovery UI contract tests pass.
- Desktop workspace inspected at 1280px; phone cards inspected at 390px and 375px. Document width equals viewport width at both phone sizes.
- English/Arabic switch changes the redesigned workspace labels and layout direction; 390px RTL has no horizontal overflow.
- Creator identity opens the existing full profile; closing it returns to the quotation.
- Expanded line exposes existing quantity/type/duration and cost-detail controls.
- Selection bar opens the existing calculator. Cancel returns without applying prices.
- Add creator opens with Discovery, Shortlist, Campaign, and Manual sources; Manual form and closing verified on phone.
- Export menu retains PDF, PowerPoint, Word, Excel, and HTML.
- Detailed preview opens with selected creators. Back to quotation returns to the workspace.
- Preview creator selection now uses one interactive button per option instead of nesting a checkbox button inside a button. Toggling one option changes the selection once.
- Reference preview-only state-switcher controls are excluded. New visual rules are scoped to `.tq-redesign`.

## Feature-map reconciliation

| Reference area | Integration |
| --- | --- |
| Navigation and identity | Existing register/neighbor navigation, serial, title, status, version, distinct creator/line counts, lifecycle links, validity and real warnings retained. |
| Main actions | Existing save, template preview, five exports, link/send, Studio, lifecycle/activity/output actions and display-setting persistence retained. |
| Commercial summary | Internal and client-facing metric bands; AF visible; existing pricing and FX calculation sources retained. |
| Client review | Existing approval decisions, filters, bulk approval and conversion callbacks retained; checkbox/approval distinction explained. |
| Creator lines | Compact rows / mobile cards, linked-platform tiers, quoted-platform cluster, alternative counts, service text, deliverable chips, expanded editors, profile, duplicate/add-option/remove actions retained. |
| Selection and calculator | Existing selected-line scope, AF figures, calculator methods, validation and apply callbacks retained. |
| Dialogs | Existing functional dialogs retained instead of the reference's demonstration forms. Add-creator container scoped to the redesign. |
| Document details | All existing metadata, revision history, notes and eight terms retained. |
| Mobile | Cards below 900px, wrapping actions, visible mobile row actions, safe-area spacing, 16px form text and larger touch targets. |
| States | Real loading/error boundaries, save status, read-only controls, expiration, conflict, empty filter and selection state used; no fake state switcher. |

## Deliberate integration limits

- Direct browser access to the local reference HTML is blocked by browser security. Source inspection and implemented-page verification follow the user's approved fallback. This is not a pixel-diff certification.
- The reference has demonstration controls and proposed fields that the existing application does not store. The actual shared profile, calculator, preview/export and commercial dialogs retain their functional UI; they are not identical to the mock dialogs.
- The database has one existing quotation notes field and the current line-status presentation; this change does not invent separate stored internal/client notes or new line-status persistence.
- Real quotation FX and pricing semantics are preserved. The reference's sample mixed-currency exclusions and supplied calculator results do not replace existing commercial rules.
- Arabic applies to the redesigned labels and layout. Shared platform tools retain their existing localization; user-entered names, descriptions, notes and contractual text are not machine-translated.
- No destructive action, client message, quotation save, fee change or pricing application was performed during browser verification.

Production release requires successful dev deployment verification first.
