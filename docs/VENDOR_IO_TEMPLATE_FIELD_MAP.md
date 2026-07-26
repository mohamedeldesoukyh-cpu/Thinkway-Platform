# Vendor IO Template — Field Mapping

**Master template:** `lib/io/templates/Thinkway_IO_Global.html`  
**Generator:** `lib/io/vendor-io-document-service.ts`  
**Data loader:** `lib/io/vendor-io-document-data.ts`

This document maps every dynamic region in `Thinkway_IO_Global.html` to platform data sources.

---

## Document header

| Template field | DB / code source | Column / path | Fallback |
|----------------|------------------|---------------|----------|
| `<title>` IO number | `vendor_ios` | `document_number` | `VIO-PENDING` |
| Serial badge (`VIO-2026-8`) | `vendor_ios` | `document_number` | — |
| Issued date | `vendor_ios` | `created_at` | `now()` |
| Issued country | `campaign_headers` → `clients` | `clients.country` | Thinkway agency country |
| Footer IO number | `vendor_ios` | `document_number` | — |

---

## Section 1 — Parties

| Template field | DB source | Column / path | Fallback |
|----------------|-----------|---------------|----------|
| Influencer / Agency | `influencers` | `COALESCE(legal_name, display_name, management_agency)` | `——` |
| Advertiser (Agency) | Static Thinkway profile | `lib/io/thinkway-agency-defaults.ts` → `legalName` | Thinkway (ثينكواي) |
| National ID / Trade License | `influencers` | `metadata.national_id` or `metadata.trade_license` | `——` |
| Commercial Register No. | Thinkway defaults | `commercialRegister` | 57920 |
| Influencer Address | `influencers` | `metadata.address` or `city` + `country_code` | `——` |
| Registered Address | Thinkway defaults | `registeredAddress` | Template static |
| Influencer Email | `influencers` | `email` | `——` |
| Agency Email & VAT | Thinkway defaults | `email`, `vatNumber` | hello@thinkwaymedia.com |

**Note:** UI label **Legal entity** = `clients` table. Thinkway agency legal entity uses configured defaults until `groups`/`clients` Thinkway self-record exists.

---

## Section 2 — Campaign details

| Template field | DB source | Column / path | Fallback |
|----------------|-----------|---------------|----------|
| Client | `campaign_headers` → `clients` | `clients.legal_name` or `clients.name` | `——` |
| Brand | `campaign_headers` → `brands` | `brands.name` | `——` |
| Campaign Name | `campaign_headers` | `name` | `——` |
| Campaign Duration From/To | `campaign_headers` | `start_date`, `end_date` | `[DATE]` |
| Channel(s) | `assignment_deliverables` + `influencer_platform_accounts` | distinct `platform` | line `metadata.platform` |
| Usage Period | `vendor_ios` | `usage_rights` | brand `usage_period` metadata |

---

## Section 3 — Influencer details

| Template field | DB source | Column / path | Fallback |
|----------------|-----------|---------------|----------|
| Full Name / Handle | `influencers` + accounts | `display_name` + `@handle` (primary) | `——` |
| Platform(s) | `influencer_platform_accounts` | `platform` (comma list) | deliverable platforms |
| Follower Count | `influencer_platform_accounts` | `follower_count` (primary/max) | `——` |
| Content Niche | `influencers` | `categories[]` | `——` |
| Primary Audience | `influencers` | `country_code`, `languages[]` | `——` |
| Avg. Engagement Rate | `influencer_platform_accounts` | `engagement_rate` | `——` |

---

## Section 4 — Content deliverables (dynamic rows)

**Source:** `assignment_deliverables` for all `vendor_io_lines.campaign_line_id` linked to this Vendor IO.

| Template column | DB source | Column |
|-----------------|-----------|--------|
| Platform | `assignment_deliverables` | `platform` |
| Deliverable Type | `assignment_deliverables` | `deliverable_type` |
| No. of Posts | `assignment_deliverables` | `quantity` |
| Account / Handle | `influencer_platform_accounts` | `handle` for matching `platform` |
| Scheduled Date(s) | `assignment_deliverables` | `live_date` or `assignment_post_schedule.live_date` |

Only deliverables with `quantity > 0` are rendered. Empty template platform rows are omitted.

---

## Section 5 — Pricing & fees

| Template field | Calculation | Source |
|----------------|-------------|--------|
| Content Creation Fee | `SUM(assignment_deliverables.cost_before_vat)` | deliverables on linked lines |
| Platform Distribution Fee | `0` or line metadata | `campaign_lines.metadata.distribution_fee` |
| Usage Rights Fee | `vendor_ios` amount − content fee − distribution | derived |
| VAT (14% or line %) | `SUM(assignment_deliverables.cost_vat_amount)` | per-deliverable VAT |
| Total Amount Due | `vendor_ios.amount` or subtotal + VAT | must match platform |

Currency from `vendor_ios.currency_code` or `campaign_lines.currency_code`.

---

## Section 6 — Payment terms

| Template field | DB source | Fallback |
|----------------|-----------|----------|
| Payment Schedule | `influencers.payment_terms` | Net 30 Days from Invoice |
| Payment Method | `influencers.payment_details.method` | Bank Transfer |
| Beneficiary (influencer) | `influencers.payment_details.beneficiary_name` | influencer legal name |
| Bank / Branch | `influencers.payment_details.bank_name` | `——` |
| Account Number | `influencers.payment_details.account_number` | `——` |
| SWIFT | `influencers.payment_details.swift` | `——` |
| IBAN | `influencers.payment_details.iban` | `——` |
| Agency bank block | Thinkway defaults | Template static (AAIB) |
| Currency pill | `vendor_ios.currency_code` | EGP |

---

## Section 7 — Signatures

| Template field | Source |
|----------------|--------|
| IO ref in confirmation | `vendor_ios.document_number` |
| Influencer name | `influencers.legal_name` or `display_name` |
| Thinkway signatory | Thinkway defaults `authorizedSignatory` |

---

## Section 8 — Terms & conditions

Replaced at generate time via `renderTermsListHtml(data.terms)` in `lib/io/vendor-io-template-render.ts`.

**Precedence (first non-empty wins):**

1. `vendor_ios.terms_text` — structured JSON `[{title, body}, …]` (deal override)
2. `influencers.vendor_io_terms_text` — vendor default (same JSON shape)
3. Platform defaults — `VENDOR_IO_DEFAULT_TERMS` (`lib/io/vendor-io-default-terms.ts`), synced with the static list in `Thinkway_IO_Global.html`

Legacy freeform `terms_text` (pre-structured seed prose) does not parse as JSON and falls through to vendor/platform defaults. Existing generated `terms_html` documents are not rewritten unless the IO is regenerated.

See `docs/VENDOR_IO_TERMS.md` for the full hierarchy and UX.

---

## Vendor IO record & storage

| Stored field | Table | Column |
|--------------|-------|--------|
| Vendor IO ID | `vendor_ios` | `id` |
| Vendor IO Number | `vendor_ios` | `document_number` |
| HTML body | `vendor_ios` | `terms_html` |
| HTML file URL | `vendor_ios` | `generated_html_url` |
| PDF file URL | `vendor_ios` | `generated_pdf_url` |
| Generated at | `vendor_ios` | `document_generated_at` |
| Assignment links | `vendor_io_lines` | `campaign_line_id` |
| Campaign link | `vendor_ios` | `campaign_header_id` |
| Vendor link | `vendor_ios` | `influencer_id` |
| Revision | `vendor_ios` | `revision_number`, `root_vendor_io_id`, `is_superseded` |

**Storage bucket:** `vendor-io-documents`  
Paths: `{vendor_io_id}/document.html`, `{vendor_io_id}/document.pdf`

---

## Email tracking

| Field | Table | Column |
|-------|-------|--------|
| Sent date | `vendor_ios` | `sent_at` |
| Recipient | `io_notifications` | `recipient_email` |
| Delivery status | `io_notifications` | `payload.delivery_status`, `sent_at` |
| Event | `io_notifications` | `event_type = 'vendor_io_sent'` |

---

## Status lifecycle

| UI status | `vendor_io_status` | When |
|-----------|-------------------|------|
| Draft | `draft` | Created, document not generated |
| Generated | `generated` | HTML/PDF produced |
| Sent | `sent` | Email / portal send |
| Revised | prior row `is_superseded=true`, new row `generated` | `/n` revision |
| Cancelled | `rejected` or future `cancelled` | Manual cancel |

---

## Numbering (existing system)

| Pattern | Example | Mechanism |
|---------|---------|-----------|
| Base | `VIO-2026-0008` | `assign_vendor_io_document_number()` trigger |
| Revision | `VIO-2026-0008/1` | `revision_number > 0` on insert |

User-facing examples `VIO-2026-1` map to the same sequence (4-digit padding in DB).
