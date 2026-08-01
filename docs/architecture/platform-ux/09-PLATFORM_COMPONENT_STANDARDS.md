# 09 — Platform Component Standards (Process-Oriented)

**Status:** Draft for Product approval  
**Seed:** Campaign Baseline · Product UX Standards · Enterprise Tabs · Financial Display

---

## 1. Principle

Replace page-oriented one-offs with **reusable workflow components**.

New modules must compose these — not invent parallel kits.

---

## 2. Core process components (to standardize)

| Component | Responsibility | Evolution path |
|-----------|----------------|----------------|
| **Business Process Navigation** | Ordered stages; current/completed/upcoming/blocked | Evolve Enterprise Tabs |
| **Lifecycle Progress** | Compact stage index / % | New thin presentation widget |
| **Current Stage** | Label + purpose sentence | Workspace header |
| **Recommended Next Action** | Single primary CTA | Header / portfolio |
| **Health Summary** | Attention / blocked / OK | Header + portfolio |
| **Business Context Crumb** | Module / entity / origin | Platform chrome |
| **Workspace Header** | Identity · status · health · KPIs · next action | Generalize Campaign hero |
| **Operational Summary** | Stage-unique stats | CampaignWorkspaceFrame stats |
| **Portfolio Command Row** | Stage · progress · health · next | Evolve campaigns table/cards |
| **Persistent Entity Shell** | Chrome stays; content swaps | Campaign scroll shell pattern |

---

## 3. Visual / interaction standards (converge)

Must converge across Campaign · Studio · AI · Finance · Clients · Vendors:

- Spacing & typography scale  
- Cards / tables / buttons / headers  
- Badges & status indicators  
- Empty states  
- Action placement (primary · secondary · overflow)  
- Filters · search · bulk actions  
- Progress indicators  
- Dialogs · drawers  
- Information density  
- Scroll + sticky process rail  
- Responsive breakpoints  

**Starting tokens:** Campaign Aurora + Platform V6 should merge into one enterprise token set over migration phases (no big-bang theme rewrite in phase 1).

---

## 4. Preserve as-is (do not rebuild)

| Standard | Keep |
|----------|------|
| Financial Display | `formatMoneyKpi` / `formatMoneyDetail` |
| Deliverables binding | Selection SSOT · upload lock · Save/Discard/Cancel |
| Enterprise Tabs engineering | Evolve API/semantics toward process nav |
| Approval / IO / billing logic | Untouched |
| Accessibility / responsive gains | Untouched |

---

## 5. Explicit anti-patterns

- Second tab system beside Enterprise/Process Navigation  
- Disabled primary CTAs for unreleased features  
- Hero row that duplicates every process stage  
- Module-specific money formatters  
- Studio/AI visual “product brand” that breaks campaign identity  
- Portfolio that only shows money with no stage/next action  

---

## 6. Approval questions

1. Approve evolving Enterprise Tabs into Business Process Navigation?  
2. Approve a shared Workspace Header pattern generalized from Campaign?  
3. Approve gradual token convergence (not a simultaneous full restyle)?
