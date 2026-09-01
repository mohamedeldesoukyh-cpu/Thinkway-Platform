# Invoice Template — Field Mapping

**Master template:** `lib/billing/invoice-template-html.ts` (design parity with INV Detailed / Summary HTML)  
**Legacy static shell:** `lib/billing/templates/Thinkway_Invoice_Template.html` (superseded)  
**Data loader:** `lib/billing/invoice-document-data.ts`  
**Renderer:** `lib/billing/invoice-template-render.ts` → `buildInvoiceTemplateHtml`  
**Layouts:** `detailed` (per deliverable) · `by_creator` (campaign line rollup) · `package` (lump-sum + AF)

Maps dynamic regions in the invoice HTML template to platform data.

---

## Document header

| Template field | DB source | Column / path | Fallback |
|----------------|-----------|---------------|----------|
| Title / serial badge | `invoices` | `document_number` | `INV-PENDING` |
| Invoice date | `invoices` | `issue_date` | — |
| Due date | `invoices` | `due_date` | — |
| IO reference | `campaign_headers` / `campaign_lines` → `vendor_ios` | `po_number` or `vendor_ios.document_number` | campaign `document_number` |

---

## Section 1 — Parties (Billed To)

| Template field | DB source | Column / path | Fallback |
|----------------|-----------|---------------|----------|
| Client / Agency name | `clients` | `legal_name` or `name` | — |
| Address line 1 | `clients` | `legal_address.line1` or `billing_address.line1` | — |
| City, country | `clients` | `legal_address.city/country` or `city` + `country` | — |
| TRN / VAT | `clients` | `vat_number` or `tax_id` | — |

**From (Supplier):** static Thinkway block from template (`lib/io/thinkway-agency-defaults.ts`).

---

## Section 2 — Invoice details

| Template field | DB source | Column / path | Fallback |
|----------------|-----------|---------------|----------|
| Invoice number | `invoices` | `document_number` | — |
| Account number | `clients` | `document_number` | — |
| Campaign No. | `campaign_headers` | `document_number` | — |
| Campaign / project | `campaign_headers` | `name` | — |
| Client | `clients` | `legal_name` or `name` | — |
| Campaign period | `campaign_headers` | `start_date`, `end_date` | — |
| IO / PO reference | `campaign_headers` / vendor IOs | `po_number`, linked `vendor_ios.document_number` | — |

---

## Section 3 — Line items (dynamic rows)

**Source:** `invoice_line_items` via `lib/finance/invoice-line-registry.ts`.

| Template column | DB source | Column |
|-----------------|-----------|--------|
| Description | `invoice_line_items` | `description` |
| Sub-description | deliverable + line + campaign | `deliverable_label`, `campaign_lines.document_number`, campaign name |
| Qty | `invoice_line_items` | `quantity` |
| Unit price | `invoice_line_items` | `revenue_before_vat` |
| Tax | `invoice_line_items` | `revenue_vat_percent` or Exempt |
| Amount | `invoice_line_items` | `line_total` |

UR/AF and influencer fees appear as persisted invoice line descriptions when generated from assignment deliverables.

---

## Totals

| Template field | Source |
|----------------|--------|
| Subtotal | `invoices.subtotal` |
| VAT | `invoices.tax_amount` + line `revenue_vat_percent` |
| Total due | `invoices.total` |
| USD equivalent | `total / campaign_headers.po_exchange_rate` when currency is EGP |

Currency from `invoices.currency`.

---

## Section 4 — Payment details

| Template field | Source | Fallback |
|----------------|--------|----------|
| Due date | `invoices.due_date` | — |
| Payment terms pill | `clients.payment_terms` | Net 30 Days |
| Bank block | Thinkway defaults | Template static (AAIB) |

---

## Payment advice slip

| Template field | Source |
|----------------|--------|
| Customer | `clients.legal_name` or `name` |
| Invoice number | `invoices.document_number` |
| Amount due | `invoices.total` |
| Due date | `invoices.due_date` |

---

## Preview & download

| Route | Purpose |
|-------|---------|
| `/billing/invoices/[id]/preview` | Dashboard iframe preview (live render) |
| `/api/invoices/[id]/document?format=html` | Inline HTML |
| `/api/invoices/[id]/document?download=1` | Download HTML attachment |
