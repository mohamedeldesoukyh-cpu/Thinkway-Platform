# Deliverables Module — Documentation & Asset Repository

**Status:** Phase 1 **implemented & approved** — Preview/UAT (2026-07-30)  
**Authority:** Product  
**Scope this release:** Internal platform only (AM workspace + Media Plan indicator)  
**Out of scope this release:** Creator Portal · Client Portal · Bulk Upload · Client approval state machine  
**UAT sign-off:** [`DELIVERABLES_DOCUMENTATION_UAT.md`](./DELIVERABLES_DOCUMENTATION_UAT.md)  
**Post-UAT freeze:** defect fixes only until Production approval (same discipline as Commercial SSOT)  

**Supersedes:** [`DELIVERABLES_CONTENT_APPROVAL_SSOT.md`](./DELIVERABLES_CONTENT_APPROVAL_SSOT.md) (workflow framing).  

---

## 1. First principle

**Deliverables is NOT a workflow engine.**

It does **not** manage publishing, scheduling, performance, assignment/campaign operational workflow, finance, or commercial logic.

**Deliverables is the SSOT for campaign documentation and creator assets only.**

It answers one question:

> What content and documentation have we received for each campaign deliverable?

```text
Campaign
  ├── Assignments   (who delivers what)
  ├── Deliverables  (documentation & assets only)
  ├── Publication   (live published content)
  └── Performance   (metrics & reporting)
```

Draft assets ≠ Publication ≠ Performance.

---

## 2. Locked product decisions

### D1 — Documentation granularity

**Support both Deliverable-level and Post-level documentation.**

Structure is derived from expected quantity / post schedule:

| Case | Documentation units |
|---|---|
| Quantity = 1 | **One** documentation record for that deliverable |
| Quantity > 1 | **One documentation record per expected post** (Story 1, Story 2, Story 3…) |

Each unit has its own assets, versions, comments, and documentation history.  
Never mix assets from multiple posts into one record.

**Implementation rule:**

- If `quantity > 1` and post-schedule rows exist → one unit per `assignment_post_schedule`  
- If `quantity = 1` → one unit keyed to the deliverable (attach assets with `assignment_post_schedule_id` null, or to the single post if present — prefer deliverable-level for qty=1)  
- If posts are missing for qty>1 → still surface expected units from quantity (placeholder units until posts exist)

### D2 — “Received” definition

A documentation unit is **Received** when it has **≥ 1 valid content asset**:

- Uploaded file, **or**  
- External / cloud storage link  

**Caption or text alone does not** mark the unit as received.  
Captions/copy are supporting documentation.

### D3 — Media Plan documentation indicator

Keep the **execution** avatar ring (Live / Partial) unchanged.

Add a **separate lightweight** documentation indicator (badge / corner dot / small document icon) — **not** a second meaning on the execution ring.

| Colour | Meaning |
|---|---|
| 🟢 | All documentation units for that creator are Received |
| 🟠 | Some Received, at least one missing |
| ⚪ | Nothing received yet |

Click → open Deliverables filtered to that creator.

### D4 — Client (this release)

No Deliverables workflow for clients.

Later / separate portal work may allow: view, download, comment.  
**No** approval state machine, workflow transitions, or business logic in Deliverables.

**Phase 1:** Internal comments only in the AM workspace (schema still allows `client` / `creator` audiences for future).

### D5 — Creator Portal

**Not in this release.** Internal team submits assets. Creator Portal = later phase.

### D6 — Asset type (required)

Every asset has a **type**, e.g.:

`draft_video` · `final_video` · `story_screenshot` · `feed_image` · `caption` · `thumbnail` · `brief` · `contract` · `invoice_support` · `other`

### D7 — Future-proof cardinality

Unlimited assets, versions, comments, and publication references per documentation unit.  
Never assume 1 asset = 1 deliverable.

---

## 3. Domain model (approved)

### Tables

- `deliverable_assets` — logical attachment (typed) on a documentation unit  
- `deliverable_asset_versions` — append-only versions (never overwrite)  
- `deliverable_comments` — `internal` \| `creator` \| `client`  
- `deliverable_documentation_events` — audit (upload, delete, replace, comment, download, link_add, archive, publication_link)  
- `deliverable_publication_links` — optional many references to `campaign_publications` (reference only)

### Storage

Bucket `deliverable-assets` (private), signed URLs, path scoped by campaign/deliverable/asset/version.

### Completeness

Computed per documentation unit from D2; rolled up per creator for Media Plan indicator.

---

## 4. Phase 1 implementation order — DONE

1. Database (+ Dev apply) ✅  
2. API / services ✅  
3. Deliverables Workspace (internal) ✅  
4. Documentation indicator on Media Plan (Original + Actual) ✅  
5. Unit tests ✅  
6. Preview / UAT ⏳  

**Explicit non-goals Phase 1:** Creator Portal · Client Portal · Bulk Upload · approval engine · Performance coupling · workflow edits from Deliverables.

### Phase 2 backlog

- **Bulk Documentation Upload** workspace (multi-file/link → assign to creators/units → review → save)  
- Large-campaign list performance (pagination / virtualization / lazy detail) if UAT D-section requires  
- Creator Portal asset submission  
- Client Access view / download / comment (still no Deliverables approval engine)

---

## 5. Success criteria

- AM documents files/links/captions with types and versions  
- Received = file or link present  
- Qty>1 → per-post documentation units  
- Media Plan shows independent docs indicator  
- No draft written as Publication/Performance  
- Assignments/Finance/Commercial untouched  
