# Deliverables Module Redesign — Documentation & Asset Repository

**Status:** Redesign proposal — awaiting product approval (no implementation)  
**Date:** 2026-07-30  
**Authority:** Product  
**Supersedes (direction):** [`DELIVERABLES_CONTENT_APPROVAL_SSOT.md`](./DELIVERABLES_CONTENT_APPROVAL_SSOT.md) where it frames Deliverables as a workflow/approval engine.  
**Preserved from prior lock:** Draft assets ≠ Publication ≠ Performance; Assignment → Deliverable → Publication → Performance.

---

## 1. First principle

**Deliverables is NOT a workflow engine.**

It does **not** manage:

- Campaign execution  
- Publishing  
- Scheduling  
- Performance / metrics  
- Assignment or campaign operational workflow  
- Finance / commercial logic  

Those remain owned by Assignments, Publication, Performance, Finance, and related modules.

**Deliverables is the SSOT for campaign documentation and creator assets only.**

It answers one question:

> What content and documentation have we received for each campaign deliverable?

Nothing more.

---

## 2. Purpose & responsibilities

For every **Assignment Deliverable**, users document and maintain:

| Category | Examples |
|---|---|
| Files | Image, video, ZIP, PDF, story screenshot |
| Links | Google Drive, Dropbox, OneDrive, WeTransfer, Canva, Figma, other https |
| Text | Captions, copy, creator notes, internal notes, client comments |
| History | File versions, revision history, upload dates, uploaded by |

The module is the campaign’s **documentation repository**.

### Must not own

Publication URLs (as operational truth), performance metrics, reach/engagement, scheduling, assignment workflow, campaign workflow, operational status, finance, commercial logic.

---

## 3. Module relationships

```text
Campaign
  ├── Assignments      (who delivers what — commercial + schedule grain)
  ├── Deliverables     (documentation & assets only)
  ├── Publication      (live published content)
  └── Performance      (metrics & reporting on publications)
```

| Rule | Detail |
|---|---|
| Deliverables ≠ Performance | Never display campaign metrics on Deliverables |
| Deliverables ≠ Publication | Never treat draft assets as live posts |
| After publish | Deliverable may store a **reference only** to Publication (platform, published URL, publication_id) |
| Performance | Reads metrics from Publication — never from Deliverable assets |

---

## 4. Current state (review summary)

### What exists

| Layer | Today |
|---|---|
| **Ops grain** | `assignment_deliverables` + `assignment_post_schedule` (commercial, schedule, workflow status, billing) |
| **Campaign Deliverables tab** | Read-only operational explorer; CONTENT = notes or **publication status**; Workflow + Billing + Publication filters |
| **Detail sheet** | General / Workflow / Content — Content is notes only |
| **Legacy portal path** | `deliverables` + `portal_uploads` + creator upload RPC; client approve on legacy rows — **not** assignment SSOT |
| **Reusable patterns** | `document-upload-form`, `lib/supabase/storage.ts` signed URLs, `client_documents` / `influencer_documents` / `group_documents` |
| **Media Plan cards** | `CreatorCard` / `CreatorAvatarImage` already use rings for **Live/Partial execution** (Performance facts) — documentation ring must be a **separate** visual signal |

### Gaps vs target repository

- No multi-asset set on assignment deliverables  
- No append-only file versions  
- No captions/copy as first-class draft fields  
- No audience-separated comment threads (Internal / Creator / Client)  
- No documentation audit (upload/delete/replace/comment/download)  
- Strong UI coupling to workflow + publication status  
- Dual SSOT with legacy portal `deliverables`

**Honest verdict:** Current page is an ops inventory, not a documentation workspace. Redesign is required before coding.

---

## 5. Target domain model

### 5.1 Anchor

Documentation hangs off the existing operational grain:

- **Parent:** `assignment_deliverables.id` (primary)  
- Optional finer grain: `assignment_post_schedule.id` when one commercial deliverable expands to multiple posts and each post needs its own asset pack  

Commercial / schedule / billing fields stay on Assignment tables. Deliverables UI for documentation does **not** edit those fields (Assignments remains the editor).

### 5.2 Proposed tables (additive)

#### `deliverable_assets`

One logical asset slot / attachment belonging to a deliverable (or post).

| Column | Purpose |
|---|---|
| `id` | PK |
| `assignment_deliverable_id` | FK → `assignment_deliverables` |
| `assignment_post_schedule_id` | nullable FK for post-level packs |
| `campaign_header_id` | denormalized for RLS / queries |
| `asset_kind` | `file` \| `external_link` \| `caption` \| `copy_text` \| `note_bundle` (or split notes to comments) |
| `label` | Human label (e.g. “Reel draft”, “Caption”) |
| `sort_order` | Display order |
| `current_version_id` | FK → latest `deliverable_asset_versions.id` |
| `created_by`, `created_at`, `archived_at` | Lifecycle |

Unlimited assets per deliverable.

#### `deliverable_asset_versions`

Append-only versions. **Nothing is overwritten.**

| Column | Purpose |
|---|---|
| `id` | PK |
| `asset_id` | FK → `deliverable_assets` |
| `version_number` | Integer, monotonic per asset |
| `storage_bucket` / `storage_path` | For files (private bucket) |
| `external_url` | For Drive/Dropbox/Canva/etc. (validated https) |
| `mime_type`, `file_name`, `file_size` | File metadata |
| `text_body` | Caption / copy when kind is text |
| `checksum` | Optional integrity |
| `uploaded_by`, `uploaded_at` | Provenance |
| `change_summary` | Optional “v2 fixes framing” |

Example: Reel_v1.mp4 → Reel_v2.mp4 → Final_Reel.mp4 = versions 1–3 on one asset.

#### `deliverable_comments`

Threaded or flat comments with **audience source**.

| Column | Purpose |
|---|---|
| `id` | PK |
| `assignment_deliverable_id` | FK |
| `assignment_post_schedule_id` | nullable |
| `asset_id` | optional — comment on specific asset |
| `audience` | `internal` \| `creator` \| `client` |
| `body` | Markdown/plain |
| `author_user_id` | profiles / portal user mapping |
| `author_display_name` | Snapshot for portal users |
| `created_at`, `edited_at`, `deleted_at` | Soft-delete for audit honesty |

#### `deliverable_documentation_events` (audit)

Every meaningful action:

`upload` · `delete` · `replace` (new version) · `comment` · `download` · `link_add` · `archive` · `publication_link`

| Column | Purpose |
|---|---|
| `id`, `campaign_header_id`, `assignment_deliverable_id` | Scope |
| `asset_id`, `version_id`, `comment_id` | Optional targets |
| `event_type` | Enum above |
| `actor_user_id`, `actor_label` | Who |
| `payload` | jsonb (old/new pointers, file name, url host, etc.) |
| `occurred_at` | Timestamp |

Also mirror critical events into platform `audit_logs` where enterprise audit already expects them.

#### Publication reference (on deliverable or post)

Nullable columns (or small link table):

- `linked_publication_id` → `campaign_publications.id`  
- Optional denormalized `linked_published_url`, `linked_publication_platform` for display  

**Reference only** — no publish actions, no metrics fetch in Deliverables services.

### 5.3 Storage

| Item | Proposal |
|---|---|
| New bucket | `deliverable-assets` (private) |
| Path | `{campaign_header_id}/{assignment_deliverable_id}/{asset_id}/{version_id}-{safeFileName}` |
| Access | Short-lived signed URLs (reuse `createSignedDocumentUrl` pattern) |
| External links | Store URL + optional title; validate with existing safe external URL helpers |

Reuse: `components/forms/document-upload-form.tsx`, `lib/supabase/storage.ts`, portal upload UX patterns from creator portal (adapted to assignment grain).

### 5.4 Documentation completeness (for Media Plan rings)

**Not a workflow status.** Derived indicator only:

| Ring | Rule |
|---|---|
| 🟢 Green | All **required** deliverables for that creator/assignment have ≥1 current asset (file or link) documented |
| 🟠 Orange | Some required deliverables have assets; at least one required is still empty |
| ⚪ Default | No assets received yet for that creator’s required deliverables |

**Required** (v1 proposal): every `assignment_deliverables` row under the creator’s assignment(s) counts as required unless flagged `documentation_optional` in metadata (default = required). Captions/copy can be optional in v1 or required by deliverable type config later.

Ring must **not**:

- Change Assignment workflow  
- Imply client approval  
- Imply publication / Live status  

**Conflict note:** Media Plan cards already use avatar ring colors for **execution** (Live/Partial from Performance). Documentation completeness needs a **distinct visual** (e.g. secondary ring segment, badge pip, or dual-ring) so Live green and Docs green are not confused. Final visual language to be agreed in UI mock before build.

Click creator / indicator → open Deliverables documentation filtered to that creator.

---

## 6. UI redesign proposal

### 6.1 Remove operational-table feel

Replace (or heavily reshape) the current explorer so it is a **documentation workspace**, not a workflow/billing grid.

**Remove from primary Deliverables UX (or demote):**

- Workflow status as primary column  
- Billing status as primary column  
- Publication status as CONTENT  
- Filters that imply Deliverables owns execution  

Billing/workflow remain visible on **Assignments** (and elsewhere). Deliverables may show Assignment/Creator/Platform/Type/Due as **context only** (read-only).

### 6.2 Workspace layout (proposed)

**Left / list**

- Group by Creator → Assignment → Deliverable  
- Each row shows: Creator, Deliverable type, Asset count, Latest version label, Revision count, Last updated, Docs completeness chip (empty / partial / complete), Publication reference icon if linked  

**Right / detail (or sheet)**

- Basic info (read-only from Assignment)  
- Assets gallery/list with preview where possible  
- Version timeline per asset  
- Comments tabs: Internal | Creator | Client  
- Activity / audit feed  
- Publication reference card (if linked) — link out to Publication module  

**Primary actions:** Upload file · Add link · Add caption/copy · Comment · Download · Open external link  

No “Mark posted”, no metrics, no schedule editing.

### 6.3 Surfaces to update

| Surface | Change |
|---|---|
| Campaign Deliverables tab | Documentation workspace |
| Deliverable detail sheet | Asset/version/comment/audit |
| Creator portal (phase 2+) | Upload into assignment deliverable assets (retire legacy-only path) |
| Client Access (phase 2+) | View assets + client comments (not Performance) |
| Original / Actual Media Plan | Documentation completeness indicator on creator avatar |
| Studio / HTML export Media Plan | Same indicator parity if cards are shown |

---

## 7. API / service changes (proposed)

| API | Role |
|---|---|
| `listDeliverableDocumentation(campaignId, filters)` | Workspace list + completeness |
| `getDeliverableDocumentation(deliverableId)` | Detail pack |
| `addDeliverableAsset` / `addDeliverableAssetVersion` | File or link or text |
| `archiveDeliverableAsset` | Soft-delete; never silent overwrite |
| `addDeliverableComment` | Audience-scoped |
| `logDeliverableDownload` | Audit on signed URL issue |
| `linkDeliverablePublication` | Set reference only |
| `getCreatorDocumentationCompleteness(campaignId)` | Facts for Media Plan rings |

Permissions: `campaigns.read` / `campaigns.write`; portal scopes later for creator/client audiences. RLS by campaign access.

**Explicit non-APIs:** no metrics sync, no publication create from upload, no workflow status mutation from Deliverables documentation services.

---

## 8. Migration strategy

### Phase 0 — Design approval (this document)

No schema/UI code.

### Phase 1 — Foundation (Dev only)

1. Additive migrations: tables + `deliverable-assets` bucket + RLS  
2. Documentation services + AM UI workspace on Campaign Deliverables tab  
3. Decouple CONTENT from publication status  
4. Completeness helper + Media Plan ring (distinct from Live/Partial)  
5. Keep Assignments commercial/workflow untouched  

### Phase 2 — Portal alignment

1. Creator portal uploads write to new asset versions (assignment grain)  
2. Client Access: view + client comments  
3. Soft-migrate legacy `deliverables.content_url` / `portal_uploads` into assets where linkable  
4. Stop treating legacy approve RPC as ops SSOT  

### Phase 3 — Publication reference + cleanup

1. Link Deliverable → Publication after go-live (manual or assisted from Performance “link back”)  
2. Deprecate dual UI paths  
3. Documentation-only regression suite  

**Data safety:** Additive schema; no drop of `assignment_deliverables` commercial columns; legacy portal tables retained until migration verified.

**Rollback:** Feature-flag documentation workspace; fall back to previous explorer; leave new tables in place (append-only history preserved).

---

## 9. Impact on existing modules

| Module | Impact |
|---|---|
| **Assignments** | Unchanged commercial/schedule/workflow ownership; remains planning SSOT |
| **Deliverables tab** | Full UX redesign |
| **Publication** | Gains optional inbound reference from Deliverable; no ownership change |
| **Performance** | Unchanged; still SSOT for live metrics; Media Plan Live/Partial rings stay Performance-driven |
| **Media Plan** | Adds **documentation** completeness indicator (visual only); click-through to Deliverables |
| **Creator / Client portals** | Re-point content upload/view to assignment documentation SSOT (phased) |
| **Finance / Commercial SSOT** | No impact |
| **Billing badges on current Deliverables tab** | Leave Assignments/Billing; remove from documentation primary UX |

---

## 10. Reusable building blocks

| Reuse | Path |
|---|---|
| Upload form patterns | `components/forms/document-upload-form.tsx` |
| Signed storage | `lib/supabase/storage.ts` |
| Entity document panels | `features/documents/*`, client/vendor document flows |
| Safe external URLs | existing URL validation helpers |
| Avatar primitive | `components/creator/creator-avatar-image.tsx` |
| Media Plan card shell | `features/campaign-outputs/components/media-plan-calendar.tsx` (`CreatorCard`) |
| Flatten identity for list context | Adapt `flatten-operational-deliverables.ts` for **context rows**, strip workflow/publication-as-content |

**Do not reuse for drafts:** `campaign_publications` insert paths, Performance metrics collectors, assignment post workflow editors.

---

## 11. Open decisions (need product confirmation)

1. **Grain:** Documentation always on `assignment_deliverables`, or also per `assignment_post_schedule` when quantity > 1?  
2. **Required assets:** Is “≥1 file or link” enough for green, or must caption/copy also be present by type?  
3. **Media Plan visual:** How to show Docs ring **without** colliding with Live/Partial execution ring?  
4. **Client comments vs formal approve:** This redesign treats Client as a **comment audience**, not a Deliverables-owned approval state machine. Confirm.  
5. **Creator portal timing:** Same release as AM workspace, or Phase 2?  
6. **Legacy `deliverables` table:** Migrate-then-deprecate timeline?

---

## 12. Approval gate

**Do not implement** until this redesign is reviewed and approved.

After approval, recommended first delivery slice:

1. Schema + storage bucket (Dev)  
2. AM documentation workspace (list + detail + upload/link/version + internal comments + audit)  
3. Completeness API + Media Plan documentation indicator  
4. Explicit non-goals in that slice: portal rewrite, client comments, publication auto-link  

---

## 13. Success criteria

- AM can open Deliverables and immediately see whether assets exist per deliverable  
- Unlimited attachments + version history with no overwrites  
- Comments separated by Internal / Creator / Client  
- Full audit of upload/delete/replace/comment/download  
- Media Plan shows documentation progress on creator avatars without implying Live/approval  
- Zero draft assets written as Publications or Performance rows  
- Publication appears only as an optional reference after go-live  
