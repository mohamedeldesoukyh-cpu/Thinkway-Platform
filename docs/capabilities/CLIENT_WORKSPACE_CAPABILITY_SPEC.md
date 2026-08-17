# Client Workspace — Capability Specification

**Status:** Development implementation (not Production)  
**Class:** Capability specification (functional delivery) — **not** an architecture reopen  
**Surface:** Client-facing presentation + decision layer over existing Thinkway SSOTs

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) | **S04 Media Planning** client review/approve; hands off to quotation → campaign conversion (existing) |
| Stakeholder Journey(s) | **Client** (primary); Internal Ops sees decisions without re-entry |
| Business Process components reused | Campaign Object versions · Shortlist item status · Commercial engine · Quotation generation · IO-style hashed tokens · audit_logs |
| Workspace(s) extended | New client-facing review workspace. Does **not** replace Client Portal (operational invoices/IO) or Studio |
| No new navigation philosophy | Client never sees Studio steps. Internal enters via Studio Package, Shortlist, or Quotation — same Client Review |
| No duplicate workflow | Selection writes Shortlist SSOT. Commercial reads existing commercial. Quotation uses `createQuotationFromSelection` / campaign-plan generator |
| Lifecycle extension | Frozen `campaign_object_versions` snapshot is the reviewable package. Live Studio edits do not mutate a published review |
| Campaign Workspace invariants | Untouched. No Campaign Workspace UX redesign |

## Product rule

Client Workspace is **not** a second campaign system, commercial engine, creator database, or approval product.

```
Studio → Package → Create Client Review → Client Workspace
Shortlist → select creators → Create Client Review → Client Workspace
Quotation → Create Client Review → Client Workspace
```

These are three **entry points** into the same versioned Client Review (`source`: `studio` | `shortlist` | `quotation`). They are not three client products. Shortlist/quotation do not require Studio package readiness. Frozen `source_snapshot` preserves the presented creator set and client-facing commercial values.

## Persistence (new — required)

| Object | Why it cannot reuse an existing table |
|--------|--------------------------------------|
| `campaign_client_reviews` | Signed, revocable, **version-frozen** review link. Campaign Object versions freeze content; they do not issue client tokens or client review status |
| `campaign_client_review_comments` | Structured campaign/creator/content/commercial feedback. `deliverable_comments` is the wrong entity |
| `campaign_client_review_events` | Client-safe activity subset. Full `audit_logs` must not be exposed to clients |

The review row stores a selection projection and a `source_snapshot` so a superseded version stays historically accurate. Live Studio / Shortlist / Quotation edits do not mutate an already-created review.

## Creator media plan (client-facing)

The Creators section is a client-facing influencer media plan. It is **not** Studio CURRENT Creators / “Who should we recommend?”.

| Layer | SSOT |
|-------|------|
| Identity, metrics, publications | Unified creator + stored `recent_publications` frozen into `source_snapshot` |
| Audience / category / performance depth | `loadCreatorIntelligenceBundle` (consume-only), freeze-on-read into the open review snapshot |
| Campaign totals | Campaign Forecast Engine from frozen creator inputs |
| CPE / CPM | Existing commercial formulas using **client-facing investment** and forecast engagements/impressions |
| EMV | Shown only when an existing Thinkway EMV value is frozen; never invented |
| Selection | `campaign_client_reviews.selection_state` + shortlist item status |
| Commercial | Quoted **revenue** only |

Missing metrics render **Not available** / **Data unavailable** / **To be confirmed** / **Not provided**. Real zeros remain `0`. The client nav is always Overview · Creators · Content Plan · Commercial · Feedback · Approval. Strategy, quotation, and timeline fold into those pages. Creator quantity is the snapshot roster, never Studio “recommended” copy.

## HypeAuditor parity

Code SSOT: `features/client-workspace/hypeauditor-parity.ts`

| HypeAuditor capability | Thinkway implementation | Thinkway SSOT | Status |
|---|---|---|---|
| Campaign summary | Reach, engagements, CPE, CPM, EMV, creator count, activity mix | Campaign Forecast + client revenue | Shipped |
| Creator cards | Media-plan cards with progressive disclosure | `source_snapshot` | Shipped |
| Creator detail | Profile, audience, performance, content, fit, commercial | Snapshot + ECI freeze-on-read | Shipped |
| Audience | Age / gender / location / interests when verified | ECI audience | Shipped |
| Performance | Avg likes/comments/views, ER, estimated reach | Unified metrics + ECI performance | Shipped |
| Content feed | Stored publications; unavailable state when none | Stored recent publications | Shipped |
| Deliverables | Proposed mix or to-be-confirmed | Shortlist / quotation / studio | Shipped |
| Commercial | Client-facing investment only | Quotation revenue | Shipped |
| Creator selection | Accept / reject / in review + multi-select | Review selection_state | Shipped |
| Filters | Status + platform/category/tier/location when supported | Snapshot fields | Shipped |
| Comments | Creator comments, reject reason, change request | `campaign_client_review_comments` | Shipped |
| Approval | Creator + campaign decisions | Review status | Shipped |
| Versioning | Frozen snapshot; old versions stay historically accurate | `source_snapshot` | Shipped |
| Responsive experience | Stacked cards + detail sheet | Client Workspace UI | Shipped |
| AQS / bot pie / ROI | Explicitly not copied | n/a | Not copied |

## Security

Reuse `generate_io_approval_token()` / `hash_io_approval_token()` (same as Client/Vendor IO one-click links). Public route `/review/*`. Anon has no table grants. Token resolution is SECURITY DEFINER. Service role loads the frozen snapshot **after** token validation.

## Out of scope (this slice)

Production deploy. Client Portal operational modules. Studio six-step exposure. ECI/Apify diagnostics in the client UI.
