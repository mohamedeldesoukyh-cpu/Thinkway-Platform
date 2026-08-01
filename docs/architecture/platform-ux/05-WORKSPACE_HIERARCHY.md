# 05 — Workspace Hierarchy

**Status:** Draft for Product approval

---

## 1. Canonical stack

```
Campaign Portfolio          (module command center)
        ↓
Campaign                    (entity)
        ↓
Business Lifecycle          (stage progression)
        ↓
Workspace / Stage surface   (process navigation selection)
        ↓
Operational Details         (registers, editors, boards)
```

Users must always feel they remain **inside Campaigns** (or the active module).

---

## 2. Portfolio responsibilities

The Portfolio is an **operational dashboard**, not only a table.

Each row (or card) should communicate:

| Field | Intent |
|-------|--------|
| Identity | TW-# · Name · Brand |
| Current stage | e.g. Vendor IO · Deliverables |
| Progress | Simple % or stage index |
| Health | OK / Attention / Blocked |
| Next recommended action | One verb phrase |

Opening a row **continues** the journey at the recommended stage when possible (`?stage=` / existing `?tab=` mapping).

---

## 3. Entity workspace responsibilities

### Persistent shell

- Identity, status, health, stage, KPIs, process rail, primary next action  

### Stage surface

- Stage-specific summary (unique identity — keep Campaign IA rules)  
- Stage tools  
- Operational content  

### Details

- Progressive disclosure (collapsed meta, charts, legends)

---

## 4. Information hierarchy (all workspaces)

1. Which business object?  
2. Status?  
3. Health?  
4. What should I do next?  
5. What operational data belongs to this stage?  

Matches and extends [`PRODUCT_UX_STANDARDS.md`](../PRODUCT_UX_STANDARDS.md).

---

## 5. Studio / Media Plan / AI placement

```
Campaign
  └── Lifecycle
        ├── … Assignments …
        ├── Planning ──┬── Media Plan (ops)
        │              └── Studio (collaborative authoring)
        ├── Client IO …
        └── Assist (AI in context)
```

They share campaign crumb + process position under **Planning** (or Assist), not a different OS shell.

---

## 6. Non-Campaign modules

Same stack:

`Client Portfolio → Client → Onboarding/Relationship process → Stage → Details`  
`Vendor Portfolio → Vendor → CRM/IO readiness process → Stage → Details`  
`Finance register → Document → Document lifecycle → Actions → Lines`

---

## 7. Approval questions

1. Accept Portfolio as lifecycle dashboard?  
2. Accept deep-link into recommended stage on open?  
3. Accept Planning/Studio under Campaign workspace hierarchy?
