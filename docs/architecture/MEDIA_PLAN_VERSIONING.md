# Media Plan Versioning — Business Specification (SSOT)

**Status:** Normative Single Source of Truth (SSOT) — approved  
**Scope:** Media Plan lifecycle and version governance  
**Precedence:** If code and this specification conflict, **this specification takes precedence**. No implementation may deviate from this document.

**Related:**

| Doc | Relationship |
|---|---|
| [`MEDIA_PLANNING_V1_PRODUCTION_READINESS.md`](./MEDIA_PLANNING_V1_PRODUCTION_READINESS.md) | v1 engine SSOT (baseline / working draft / portal) |
| [`../release/2.0/MEDIA_PLAN_LIFECYCLE_OWNERSHIP.md`](../release/2.0/MEDIA_PLAN_LIFECYCLE_OWNERSHIP.md) | Original / Current / Actual ownership (R2.0) |
| Thinkway enterprise principle | Approved business artefacts are revised in a controlled manner; strategic redesigns are explicit and versioned separately |

---

## 0. Architectural principles (non-negotiable)

### 0.1 The specification is the contract

- `MEDIA_PLAN_VERSIONING.md` is the SSOT for lifecycle and version governance.
- Implementations must conform; UI cannot be the sole enforcer.
- Domain model gates are required for mutate / revise / regenerate / restore / approve.

### 0.2 Business Version vs Audit History (fundamental separation)

These layers must remain **completely separate**.

| Layer | Purpose | Affects business version number? |
|---|---|---|
| **Business Version** | Meaningful milestones visible to the business and the client (`v1.0`, `v1.1`, `v2.0`) | Yes — only per lifecycle rules below |
| **Audit History** | Every modification (timestamp, actor, reason, before/after) | **Never** |

Confusing persistence snapshots or every edit with a client-facing version number is a defect.

### 0.3 Approval is the version boundary

The **approval event**—not the edit—changes how versioning behaves.

```
v1.0 Draft
  → 100 internal edits
  → Still v1.0
  → Approved
  → Any further change
  → v1.1 (Revision) or v2.0 (Regeneration)
```

This must be enforced by the **domain model**, not only the UI.

### 0.4 Immutability of Approved versions

Once a Media Plan version is **Approved**:

- It **cannot** be edited.
- It **cannot** be overwritten.
- It **cannot** be deleted.
- It can only be:
  - **Revised** (new minor business version),
  - **Regenerated** (new major business version),
  - **Restored** (as a **new** business version).

This ensures a defensible audit trail.

### 0.5 Explicit user intent (AI)

The AI must **never** infer a regeneration when a revision is sufficient.

Decision hierarchy:

1. **Revise** the existing approved plan (operational changes).
2. **Ask for confirmation** if the request could be interpreted either way.
3. **Regenerate** only when the user **explicitly** requests it, or when a **strategic** change requires it (budget, objectives, audience, platforms, creator mix, deliverables redesign).

### 0.6 Release gate

Any implementation that creates a new business revision on every edit is **not compliant** and **must not be merged** until it conforms to this SSOT.

---

## 1. Purpose

Thinkway Media Plans are **enterprise business artefacts**. Version numbers communicate client-facing change history, not every internal keystroke.

- **Before approval:** iterate on one working business version; log an audit trail.
- **After approval:** that version is immutable; further change creates a new business version (Revision or Regeneration).
- **Restore** never rewrites history; it always appends a new business version.

---

## 2. Media Plan version lifecycle

Each **business version** has its own lifecycle state:

| Status | Meaning | Engine mapping (v1) |
|---|---|---|
| **Draft** | Working version; editable; not yet sent for client decision | `draft` |
| **Under Review** | Sent to client; same business version until a decision | `locked` (send/lock) |
| **Approved** | Approved; **immutable** | `approved_by_client` / `approved_on_behalf` |
| **Superseded** | Replaced by a newer approved business version | prior baseline after supersession |
| **Archived** | Retained for history; not active for operations | `archived_baseline` / retention |

### Lifecycle transitions (normative)

```
Draft ──send to client──► Under Review
Under Review ──approve──► Approved
Under Review ──request changes / reject / unlock──► Draft  (same business version)
Approved ──revise / regenerate / restore──► new business version starts as Draft
Approved ──superseded by newer approved version──► Superseded
Any terminal / retention policy ──► Archived
```

Notes:

- **Draft** and **Under Review** share the same business version identity (e.g. still `v1.0`).
- Sending to client does **not** bump the business version.
- **Approval** freezes the version (immutability). Leaving Approved via Revise/Regenerate/Restore creates a new business version.
- Under Review content is presented for client decision; returning to Draft for changes (unlock / request changes / reject) **does not** bump the business version.

---

## 3. Versioning rules

### 3.1 Before approval (Draft or Under Review)

If the current Media Plan business version is **Draft** or **Under Review**:

**Do not create a new business version.**

All of the following update the **same** working business version (e.g. remain `v1.0`):

- Editing dates / timeline
- Reordering publications
- Adjusting creators
- Updating deliverables
- AI suggestions / working-draft regenerate
- Manual edits
- Schedule slot moves
- Deterministic date-offset / campaign start rebinding

The platform **must** maintain an **internal audit trail** (§7). The business version label does not change.

#### Example

```
v1.0 (Draft)
  09:00  AI generated plan
  09:30  User changed start date
  10:15  User moved Creator A
  11:00  User changed posting dates
→ Still v1.0
```

### 3.2 After approval (immutable)

Once a Media Plan version is **Approved**, it becomes **immutable** (§0.4).

Any subsequent change that alters the plan content **must** create a **new business version**. The prior approved version remains in history (and becomes **Superseded** when a newer version is approved).

#### Examples

```
v1.0 Approved
  → Client delays campaign
  → v1.1 Revision (starts Draft → … → Approved)

v1.1 Approved
  → Replace one creator
  → v1.2 Revision

v1.2 Approved
  → Budget / strategy changes
  → v2.0 Regenerated
```

---

## 4. Revision vs Regeneration

These operations create a **new business version** when leaving an **Approved** (immutable) version. They are **not** used for every pre-approval edit.

### 4.1 Revision (minor version)

**When:** Operational changes after approval.

**Typical triggers:** date / timeline adjustments, creator substitutions, individual schedule changes.

**Preserves** (unless the change explicitly targets them): strategy, creator order, waves, deliverables, budget allocation.

**Creates:** `v1.1`, `v1.2`, `v1.3`, …  
**Operation:** `revise`

### 4.2 Regeneration (major version)

**When:** Strategy changes or an **explicit** AI rebuild.

**Typical triggers:** budget, objectives, audience, platforms, creator mix, deliverables redesign, or explicit “regenerate / rebuild Media Plan”.

**Behaviour:** May reorder creators, rebalance waves, redesign schedule.

**Creates:** `v2.0`, `v3.0`, …  
**Operation:** `regenerate`

### 4.3 Choosing Revise vs Regenerate

| Change class | Operation |
|---|---|
| Operational schedule / date / single creator / slot | **Revision** (minor) |
| Strategy, budget, mix, platforms, objectives, deliverables redesign, or explicit rebuild | **Regeneration** (major) |
| Ambiguous | **Ask for confirmation** — never silently regenerate |

Pre-approval edits are **neither** a new Revision nor Regeneration in the business-version sense: they mutate the working version and append audit only.

---

## 5. Restore

Restoring **never overwrites history**.

```
v1.0 → v1.1 → v1.2 → Restore v1.0 → v1.3
```

- Copies content from a prior **business version** into a **new** business version (append-only).
- Prior versions remain readable for compare.
- Restored tip starts as **Draft** and follows the same approval lifecycle.
- Operation: `restore`

---

## 6. Approval workflow (governance fields)

Each Media Plan **business version** must include:

| Field | Values / meaning |
|---|---|
| **Status** | `Draft` · `Under Review` · `Approved` · `Superseded` · `Archived` |
| **Approved By** | User / actor identity when approved (null until approved) |
| **Approved Date** | ISO timestamp when approved (null until approved) |
| **Approval Source** | `Client` · `Internal` (null until approved) |
| **Approval Impact** | `None` · `Internal` · `Client Re-approval` |

### 6.1 Approval Impact (defaults for new business versions)

| Change class | Approval Impact |
|---|---|
| Initial working version (never approved) | `None` |
| Internal schedule adjustment after prior approval | `Internal` |
| Creator replacement / mix change | `Client Re-approval` |
| Strategy regeneration (major) | `Client Re-approval` |
| Material deliverables / budget / platforms change | `Client Re-approval` |

These fields support enterprise governance and reporting across Studio, Campaign, and Portal.

---

## 7. Audit trail (always)

Even when remaining on `v1.0` before approval, **every modification must be logged**:

| Field | Required |
|---|---|
| Timestamp | Yes |
| Actor (User / AI / System) | Yes |
| Change reason | Yes |
| Before / After values | Yes (sufficient for reconstructability) |
| Optional: operation class | Suggested (`edit`, `ai_suggest`, `date_offset`, `schedule_move`, `working_regenerate`, …) |

Audit History **never** increments the business version number.

### Distinction

| Layer | Identity | When it grows |
|---|---|---|
| **Business version** | `v1.0`, `v1.1`, `v2.0` | Leaving Approved (revise/regenerate/restore); initial create |
| **Audit history** | Append-only entries on the working version | Every mutation, always |
| **Technical persistence** | DB / CO snapshots | Implementation detail — not client-facing version labels |

---

## 8. Version record (business version)

When a **new business version** is created (or on initial generate), the record must include at least:

| Field | Description |
|---|---|
| Version number / label | e.g. `v1.1`, `v2.0` |
| Timestamp | Created at |
| Actor | User and/or AI |
| Reason | Why this version exists |
| Change summary | Human-readable delta |
| Operation | `initial` \| `revise` \| `regenerate` \| `restore` |
| Status | Draft → Under Review → Approved → Superseded / Archived |
| Approved By / Date / Source | Populated on approval |
| Approval Impact | `None` · `Internal` · `Client Re-approval` |
| Compare / restore | Across business versions only |

---

## 9. Alignment with existing product language

| This SSOT | v1 / R2.0 language |
|---|---|
| Approved business version | Current Approved Baseline / Portal **Original** |
| Working Draft / Under Review tip | Working Draft / **Current** |
| Superseded approved version | Prior baselines retained in history |
| Audit trail | Distinct from business version bump |

Ownership constraints in [`MEDIA_PLAN_LIFECYCLE_OWNERSHIP.md`](../release/2.0/MEDIA_PLAN_LIFECYCLE_OWNERSHIP.md) still apply. Versioning does not override those write guards.

---

## 10. Non-goals / anti-patterns

Do **not**:

1. Bump `v1.0` → `v1.1` for every Studio or Copilot edit while still Draft / Under Review.
2. Treat internal persistence snapshots as client-facing version numbers.
3. Edit, overwrite, or delete an Approved version in place.
4. Restore by mutating a historical version row (must append).
5. Use Regeneration for trivial date moves after approval (use Revision).
6. Use Revision for strategy / budget / mix redesign (use Regeneration).
7. Silently regenerate when the request is ambiguous (ask first).
8. Merge non-compliant “revision on every edit” code to `develop`.

---

## 11. Domain enforcement (required)

The domain model must enforce:

1. `if Status ∈ {Draft, Under Review}` → mutate working tip + **audit only**; **no** business version increment (including working-draft regenerate).
2. `if Status === Approved` → reject in-place content mutation; only Revise / Regenerate / Restore creating a **new** Draft business version.
3. Business version history (`history`) stores **business** milestones only; audit log is a separate append-only list.
4. Copilot / Studio: prefer Revise; confirm if ambiguous; Regenerate only when explicit or strategic.
5. UI shows business version + Status + approval fields; audit log is separate from version history.

---

## 12. Acceptance criteria (spec-level)

1. Multiple edits while Draft leave the label at `v1.0` and produce multiple audit entries.
2. Send to client moves Status to Under Review without changing `v1.0`.
3. Approval freezes `v1.0` with Approved By / Date / Source populated; further date change creates `v1.1` (Revision) as Draft with Approval Impact set.
4. Creator replacement after approval → minor Revision with Approval Impact = Client Re-approval.
5. Strategy / budget rebuild after approval → `v2.0` (Regeneration) with Client Re-approval.
6. Ambiguous AI request asks for confirmation rather than regenerating.
7. Restore `v1.0` after `v1.2` yields `v1.3` without mutating `v1.0`–`v1.2`.
8. Compare operates across business versions; audit explains intra-version edits before first approval.
9. Non-compliant revise-on-every-edit behaviour is rejected by tests and release gate.
