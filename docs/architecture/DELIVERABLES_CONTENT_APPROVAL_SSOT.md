# Deliverables — Content Collection & Approval Workspace

**Status:** Locked product direction (2026-07-30)  
**Authority:** Product  
**Environment impact:** Design only until an implementation phase is approved  

---

## 1. Principle

**Deliverables** is the **Content Collection & Approval Workspace**.

Its purpose is to collect draft assets from creators (files or links), and to track whether content has been:

1. Received  
2. Reviewed internally  
3. Approved internally  
4. Approved by the client  

**before** publishing.

The uploaded / linked draft asset is **not** the final published content.  
It must **never** be treated as a Publication or a Performance record.

---

## 2. Canonical lifecycle

```text
Assignment
  → Deliverable   (draft asset collection & approvals)
  → Publication   (live post / published URL)
  → Performance   (analytics on the live post)
```

| Stage | Module | Responsibility |
|---|---|---|
| Plan / commercial / schedule grain | **Assignment** | Who / what / commercials / planned units |
| Draft asset + approvals | **Deliverable** | Receive creator drafts (file/link), internal + client approval history |
| Live post identity | **Publication** | Canonical published URL / live post record after go-live |
| Metrics | **Performance** | Reach, engagement, impressions, and all campaign metrics on publications |

---

## 3. Hard boundaries (non-negotiable)

### Deliverables owns

- Draft asset intake (upload file and/or external draft link)  
- “Content received” tracking  
- Internal review / approval  
- Client Access review / approve / request changes  
- Approval and revision history for drafts  
- Optional **reference** to the resulting Publication (or published URL) **after** go-live  

### Deliverables does **not** own

- Live post metrics  
- Engagement / reach / impressions  
- Treating a draft asset as a publication  
- Mixing content production with campaign reporting  

### Performance owns

- Tracking **live** URLs  
- Reach, engagement, impressions, and related metrics  
- Single source of truth for published-content analytics  

### Publication owns

- The live post record created when approved content is published  
- The durable published URL identity that Performance attaches to  

---

## 4. Relationship rules

1. **One Assignment** may have many Deliverables (planned content units).  
2. A Deliverable holds **draft** assets and approval state until publish.  
3. When the creator publishes the **approved** content, the Deliverable **references** the resulting Publication (or published URL).  
4. Performance reads Publications — not draft deliverable assets — for metrics.  
5. Client Access content approval operates on **Deliverables**, not on Performance rows.  
6. Client Access Media Plan approval remains a separate concern (plan governance), not draft-content approval.

---

## 5. Current platform gap (honest state)

Today the Campaign **Deliverables** tab is largely a **read-only operational explorer** over assignment posts/deliverables. Draft intake, received tracking, and client content approval are incomplete / split (including a legacy portal `deliverables` path). Performance/Publications already handle live URLs and metrics.

This document locks the **target** separation. Implementation must realign the Deliverables workspace to this model and stop implying that Deliverables CONTENT = publication/performance.

---

## 6. Implementation guidance (when approved)

1. Make Deliverables the AM + Client Access workspace for draft assets and approvals.  
2. Keep Performance as SSOT for live metrics only.  
3. After publish: Deliverable → `publication_id` / published URL reference (link only).  
4. Do not write draft assets into `campaign_publications` or performance pipelines.  
5. Preserve approval history on the Deliverable across revisions.  
6. Migrate or retire dual-tracking with legacy portal deliverables so one operational SSOT remains.

---

## 7. Anti-patterns (forbidden)

1. Creating a Publication when a creator uploads a draft  
2. Feeding draft asset URLs into Performance as live content  
3. Using the Deliverables CONTENT column as a publication-status proxy  
4. Client-approving content only on Performance/Publication rows  
5. Losing draft approval history once a live URL exists  

---

## Related

- Product lifecycle (high level): `docs/THINKWAY_SYSTEM_REFERENCE.md` (Content Production → Client Approval → Publishing → Performance)  
- External collaboration direction: `docs/THINKWAY_3_EXTERNAL_COLLABORATION_PLATFORM.md`  
- Gap analysis: `docs/ARCHITECTURE_ALIGNMENT.md`  
