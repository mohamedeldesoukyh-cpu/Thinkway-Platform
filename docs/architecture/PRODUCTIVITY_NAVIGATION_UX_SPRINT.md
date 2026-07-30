# Productivity & Navigation UX Sprint — Implementation Plan

**Status:** Implemented on `develop` — Preview/UAT (2026-07-30)  
**Scope:** Productivity, navigation, editing efficiency only  
**Non-goals:** No changes to Commercial SSOT, Deliverables rules, Publication, Performance, Finance  
**Governance:** Same freeze model as Commercial SSOT / Deliverables — after green UAT, feature-freeze (bug fixes, perf, minor polish only).

---

## 1. Goal

1. **P0** Media Plan Edit History + Undo/Redo + History Panel  
2. **P1** Studio → Open Campaign / Open Quotation (contextual)  
3. **P1** Previous / Next across Campaigns, Quotations, Shortlists, VIO, CIO (full filtered set)  
4. **P1** Campaign header/general inline editing (staged save)  

---

## 2. Locked decisions

### D1 — Edit History retention

- **No fixed delete cap.** Treat as audit trail.  
- Persist all entries (never delete).  
- UI loads latest **50** by default; infinite scroll / Load More for older.  
- Future archive OK; never hard-delete.

### D2 — Default History view

```
History
────────────────
Edit History     ← default
Business Versions
```

### D3 — Previous / Next

Use the **entire filtered result set**, not the current page. Context persists until filters change.

### D4 — Campaign inline v1

Header & general info only (name, client, brand, dates, owner, objectives, status, notes, metadata).  
Exclude commercials, Media Plan, Deliverables, Finance, Assignments.

### D5 — Studio contextual open

- Linked Campaign → **Open Campaign**  
- Else Quotation → **Open Quotation**  
- Else → hide (never show disabled)

### D6 — Edit History details

Collapsed: actor · time · summary.  
Expanded: field-level old → new, added/removed creators, etc. (no restore required to understand).

### D7 — Compare mode

Support Current↔Edit, Edit↔Previous Edit, Business↔Business.  
Colours: 🟢 Added · 🟠 Modified · 🔴 Removed.

### D8 — Restore

Append-only: Restore Edit 42 → creates Edit 47 “(Restored from Edit 42)”. Never overwrite.

### D9 — Unsaved changes (platform)

Reusable: dirty indicator · Save · Cancel · Ctrl/Cmd+S · leave confirm · Reset.  
Share across modules with inline edit.

---

## 3. Media Plan architecture (non-negotiable)

| Layer | Purpose | Bumps `versionLabel`? |
|---|---|---|
| **Business Versions** (`history`) | Governance / approval milestones | Yes (SSOT rules) |
| **Edit History** (`editHistory`) | Productivity audit of every persist | **Never** |
| **Audit History** (`auditHistory`) | Existing compact audit | Never |

Routine edits must not create business versions. Spec: `MEDIA_PLAN_VERSIONING.md`.

---

## 4. Implementation order

1. ~~P0 Media Plan Edit History + Undo/Redo + History Panel~~  
2. ~~P1 Studio Open Campaign/Quotation~~  
3. ~~P1 Prev/Next~~ (Campaigns full filtered IDs; Quotations/Shortlists/CIO/VIO filtered sets)  
4. ~~P1 Campaign header inline edit + shared dirty/save component~~  

### Key surfaces

| Area | Location |
|---|---|
| Edit History store | `features/campaign-outputs/media-plan-edit-history.ts` (`editHistory` on tip) |
| Restore (append-only) | `media-plan-edit-restore.ts` + `restore-media-plan-edit` action |
| History panel | `media-plan-history-panel.tsx` (Edit History default) |
| Studio open | `studio-linked-entity-open.tsx` in Outputs Center |
| Prev/Next | `lib/navigation/list-nav-context.ts` + `EntityPrevNext` |
| Dirty/save | `components/forms/unsaved-changes-bar.tsx` |
| Campaign inline | `campaign-header-inline-editor.tsx` (header/general only) |

Development only until Production is explicitly approved. Tests: `npx tsx --test features/campaign-outputs/media-plan-edit-history.test.ts`.

---

## 5. Release discipline

### Phase 1 — Development / Preview

1. Commit to `develop` (auto-deploys Preview/Development)  
2. UAT on Dev  
3. Defect fixes + performance tuning  

### Phase 2 — Freeze (after green UAT)

- Freeze Productivity & Navigation UX Sprint.  
- Accept only: bug fixes · performance · minor UX polish.  
- No new features in this workstream.  
- Production only with explicit approval.

---

## 6. Post-UAT backlog (not in this commit)

| Item | Notes |
|---|---|
| **History search** | Filter by user, date, field, creator, action type (Added / Modified / Removed / Restored) |
| **History export** | PDF / Excel / CSV for audits |
| **Keyboard conventions** | Platform-wide: Ctrl/Cmd+Z Undo, Shift+Z Redo, F Search, Esc Cancel edit, Enter Save |
| **Navigation context fidelity** | Persist filters, sort, search, grouping, grid/list view, pinned filters when returning from Prev/Next |
| **Deep linking** | Shareable URL per edit (e.g. Campaign → History → Edit #248) |

These are separate initiatives after freeze — do not expand this sprint.
