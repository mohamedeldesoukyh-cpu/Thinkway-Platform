# Quotation editor redesign — Cursor implementation handoff

Cursor can't "eyeball" a screenshot into a match. Give it the **actual mockup** as the reference and this spec. The mockup `quotation-redesign_5.html` is the source of truth for structure, spacing, and CSS — translate it into your components 1:1, swapping the mockup's CSS variables for your real Discovery tokens.

## 0. Attach to the Cursor chat
| File | Role |
|---|---|
| `quotation-redesign_5.html` | **Exact target** — copy its markup structure + CSS values verbatim, then re-token |
| `DISCOVERY_SHORTLISTS_REFERENCE.md` | Token names + shared components (DiscoveryPageShell, exact-row, etc.) |
| `DISCOVERY_SEARCH_REFERENCE.md` | Golden reference for tokens/CSS |

## 1. Files to edit
Locate the quotation editor (the shortlists reference points to `features/quotations/…` — actions/constants/lifecycle-actions live there, the UI sits beside them):
- `app/(dashboard)/discovery/quotations/[id]/page.tsx` — the route/shell
- `features/quotations/components/quotation-editor.tsx` (or `quotation-workspace.tsx`) — the page body
- its sub-components: the top action bar, metrics strip, lifecycle row, client/brand form, **creator lines list**, totals, document-details form, quotation notes, terms accordion

> If names differ, search `features/quotations` for the strings `"Client cost"`, `"Generate outputs"`, `"Service description"`, `"Terms & conditions"` — those land you in the right files.

## 2. THE RULE CURSOR KEEPS MISSING — read first
This page (like the Shortlist workspace) is **flush and full-bleed. No cards. No centered column.**
- **No `max-width` + `mx-auto` wrapper.** Content runs edge to edge.
- **One gutter everywhere: 32px (`px-8`)** left and right — the *same* gutter the top nav and toolbar use. Every band, section header, table row, and form aligns to it. Nothing is inset in a narrower column.
- **No bordered/rounded/shadowed "card" boxes** around sections. Separate sections with a **1px bottom hairline** (`border-b border-[var(--line)]`) and padding, not a floating panel.
- Inputs/selects/tables sit directly on the page surface.

If a section looks like a rounded box floating on grey, it's wrong. It should look like a continuous document with hairline dividers.

## 3. Token map (mockup var → your token)
| Mockup | Use in code |
|---|---|
| `--blue` `#0057ff` | `var(--blue)` / `text-primary` `bg-primary` |
| `--blue-text` | `var(--blue-text)` |
| `--blue-soft` | `var(--blue-light)` |
| `--text/-2/-3/-4` | `var(--text)` / `var(--text-2)` / `var(--text-3)` + a 4th muted (`#9aa3b5` light / `#6b7285` dark) |
| `--line` / `--line-2` | `var(--line)` (hairline) / `var(--tw-border)` |
| `--surface` / `--surface-2` | `var(--surface)` / a slightly deeper surface |
| `--green*` / `--amber*` | existing status tokens |
Font: **Inter** (you already load it). No new hex beyond the above.

## 4. Component spec (measurements from the mockup)
**Sticky combined header** (replaces the old back-bar AND the separate title band — there is no "Back to quotations" and no standalone header block):
- One sticky row under the top nav, `border-b`, `padding:12px 32px`.
- Left (flex:1, min-w-0): line 1 = serial chip `QT-…` (10.5px bold uppercase, right border divider) + title `h1` 18px/700 truncating + a small edit icon button; line 2 = meta `Linked shortlist · Legal entity · Brand · Owner` at 12px, muted keys / semibold values, `·` dot separators, `nowrap`.
- Right (flex-shrink:0): Draft status pill, **Save** (glow-blue outline button), Preview split (`Preview · Detailed ▾`), Open Studio (ghost), **Generate outputs** primary with a `6/11` readiness chip + caret, and a `⋯` icon button.

**Metrics band** — flush grid, `grid-template-columns:repeat(8,1fr)`, `border-b`, NOT a card. Each cell `padding:14px 18px` with a **1px left divider** between cells; first cell pads to 32px, last pads to 32px. Label 9.5px uppercase muted; value 17px/800 tabular (Days-left value in blue). 8 cells: Base cost, Client cost, GP margin, GP %, PM %, Version, Creators, Days left.

**Lifecycle band** — flush row `padding:13px 32px`, `border-b`: an uppercase "LIFECYCLE" label + status chips (Shortlist·Linked = blue chip, Campaign·Not linked = muted chip, Live sync enabled = green chip), and the **Validity** pill pushed right (`margin-left:auto`, amber bg).

**Client & brand** — compact flush section `padding:15px 32px`, `border-b`. Section header row with the "Use temporary client & brand" **toggle on the right of the header** (not its own row). Below: 3 selects (`Legal entity*`, `Brand*`, `Campaign (optional)`) in a `repeat(3,1fr)` grid **capped `max-width:980px`**, 38px tall, 14px gap. Keep it small.

**Creators** — flush section `padding:22px 0` (horizontal padding handled per-row so option-line tints go full-bleed):
- Section header (padded 32px): `Creators · N · N lines` + subtitle; right = `Commercial summary` + primary `Add creator`.
- Toolbar (padded 32px): search (300px), `Platform · All ▾`, `Calc · Markup % ▾`.
- Column header row (`padding:11px 32px`, `border-b`): checkbox / Option / Tier / Service description / Platform / Type / Price / Status / (actions). Column widths: chk 34, opt 150, tier 78, svc flex, plat 70, type 150, price 120, status 96, act 96.
- Per influencer = a **group**: a white identity row (`padding:13px 32px`) — 40px gradient-initials avatar, name + verified tick, @handle, category chips, follower count right — then one or more **option lines** (`padding:11px 32px`, faint `--surface` bg, `border-top`) carrying: checkbox, `— · followers`, tier badge (Mid=blue / Macro=violet / Mega=rose / Celebrity=amber), **Service description input**, platform icon, **Type select**, price `— / + Cost detail`, status pill, and `+ / ⋯ / delete` icon buttons. Group has `border-b`.
- **Totals** row (`padding:16px 32px`, `border-top:2px`): "Totals · N creators · N option lines" left, big tabular amount right.

**Document details + Quotation notes** — flush section `padding:22px 32px`. Two columns via `grid-template-columns:1.1fr 1px 1fr` with the middle `1px` a hairline divider (NOT two cards). Left = the form grid (Issue date, Validity date, Status, Version, Department[span 2], Prepared by, Reviewed by, Client signatory, Change summary) + a revision-history line. Right = the notes textarea.

**Terms & conditions** — flush section. Just the 8 rows, each `padding:15px 4px` with `border-b`, a muted number + label + chevron. No outer box.

## 5. Guardrails
- Reuse shadcn `Select`, `Tooltip`, `DropdownMenu`, `Popover`, `Checkbox`, `Switch`, `Textarea`, `Input` — don't hand-roll.
- **Dark mode:** every value has a `.dark` counterpart in the mockup — carry the token, not the literal hex.
- Preserve **all** existing handlers/state (save, generate, preview template, add/remove creator line, cost-detail, calc mode, filters, field bindings). This is styling only.
- Motion: button `active:scale-[0.97]`, dropdown/popover `ease-out ≤200ms` from trigger origin.

## 6. Paste-ready Cursor prompt
> Restyle the Client-Quotation editor to match `quotation-redesign_5.html` exactly — copy its structure, spacing and CSS, then swap the mockup's CSS variables for our Discovery tokens per `QUOTATION_REDESIGN_HANDOFF.md`. Critical: the page is FLUSH and full-bleed — no cards, no max-width column, a single 32px gutter on both sides for every section, sections separated by 1px hairlines only. Merge the title/serial/meta into the sticky top action bar (no "Back to quotations"). Keep every existing handler and piece of state; this is styling only. Keep dark-mode parity.
