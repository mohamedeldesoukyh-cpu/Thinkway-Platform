# Thinkway Platform Financial Display Standard

**Status:** Governing standard  
**Effective:** 2026-08-01  
**Scope:** Platform-wide presentation of monetary values (not Campaign Workspace only)  
**Non-goals:** No changes to calculations, APIs, database, workflows, or financial rules

---

## Principles

1. **ISO currency codes only** — never localize with `$`, `£`, `€`, `E£`, `د.إ`, `﷼`, etc.
2. **Currency always comes from the document** — campaign, quotation, Client IO, Vendor IO, invoice, PO, payment, credit note, or report context. Never hardcode a currency for display.
3. **One formatter** — every surface uses `lib/finance/currency-format.ts`.
4. **Precision by context** — executive KPIs omit decimals; detailed/ledger views keep two decimals.
5. **Icons represent metrics, not currencies** — no dollar-sign icons for Revenue/Cost.

---

## Canonical formatter

| API | Use when | Example |
|-----|----------|---------|
| `formatMoneyDetail(amount, currency)` | Tables, IO, invoices, POs, payments, credit notes, PDFs, emails, exports | `EGP 1,235,561.00` |
| `formatMoneyKpi(amount, currency)` | Executive KPI cards, summary strips, home dashboards | `EGP 1,235,561` |
| `formatCurrencyAmount(amount, currency, options?)` | Shared primitive (`precision: "kpi" \| "detail"` or `decimals`) | — |

Aliases (prefer migrating to the names above over time):

- `formatMoney` → detail (campaigns / most UI)
- `formatMoneyCompact` → KPI
- `formatBillingMoney` / `formatBillingMoneyCompact` → billing wrappers
- `formatKpiCurrency` → KPI utils

**Implementation:** `lib/finance/currency-format.ts`  
**Tests:** `lib/finance/currency-format.test.ts`

---

## Precision rules

### Executive KPI cards / summary strips

- ISO code
- Thousands separators (`en-US`)
- **No decimal places**

### Detailed financial views & documents

- ISO code
- Thousands separators
- **Two decimal places**

Applies to Client IO, Vendor IO, Billing, Payments, Credit Notes, Purchase Orders, Invoices, financial reports, PDFs, emails, exports.

---

## KPI icons (metric, not currency)

| Metric | Icon guidance |
|--------|----------------|
| Revenue | Wallet / banknote |
| Cost | Receipt / invoice |
| Gross Profit | Trending up |
| Margin | Percentage |

Never use currency-symbol glyphs as icons.

---

## Terminology

Use consistently across the platform:

Revenue · Cost · Gross Profit · Margin · Budget · Actual · Committed · Outstanding · Paid · Receivable · Payable

Do not invent alternate labels for the same concept (e.g. “Gross profit” vs “GP” is OK as abbreviation; “Turnover” vs “Revenue” is not).

---

## Accessibility

- Consistent alignment and digit grouping
- Space between ISO code and amount (`EGP 1,235,561`)
- High contrast tabular numerals where available
- Readable on desktop, tablet, and mobile

---

## Migration rule

No module may implement its own currency formatting.

When adding Planning Board, Copilot, Notifications, or Analytics surfaces, call `formatMoneyKpi` / `formatMoneyDetail` only.

`currencySymbol()` remains **deprecated for display** and exists only to parse legacy symbol-prefixed strings.

---

## Related

- Campaign UI guidelines: [`CAMPAIGN_WORKSPACE_UI_GUIDELINES.md`](./CAMPAIGN_WORKSPACE_UI_GUIDELINES.md)
- Architecture alignment: [`../ARCHITECTURE_ALIGNMENT.md`](../ARCHITECTURE_ALIGNMENT.md)
