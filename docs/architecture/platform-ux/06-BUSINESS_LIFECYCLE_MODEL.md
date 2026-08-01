# 06 — Business Lifecycle Model

**Status:** Conditionally approved — **canonical stages live in** [`12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`](./12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md)  
**Note:** This doc retains the practical process rail. Where names differ, **doc 12 wins**. Underlying data/status fields remain unchanged until a later functional release explicitly maps them.

---

## 1. Campaign lifecycle (canonical)

| # | Stage | Operator intent | Primary surface (today → target) |
|---|-------|-----------------|----------------------------------|
| 0 | Creation | Establish header | New Campaign dialog → Overview |
| 1 | Planning | Strategy & schedule | Media Plan / Studio → **Planning** |
| 2 | Creator Discovery | Find creators | Discovery (context: campaign) |
| 3 | Shortlisting | Curate | Shortlists / Discovery |
| 4 | Media Planning | Commit schedule | Media Plan ops + Studio Outputs |
| 5 | Commercial Approval | Client commercial lock | Quotation / Client IO approval cues |
| 6 | Assignments | Line economics & creators | Assignments |
| 7 | Client IO | Client document cycle | Client IO |
| 8 | Vendor IO | Vendor document cycle | Vendor IO |
| 9 | Deliverables | Assets & documentation | Deliverables |
| 10 | Performance | Live execution metrics | Performance |
| 11 | Finance | Invoice & GP command | Finance |
| 12 | Collection | Cash recovery | Finance / Collections (link) |
| 13 | Reporting | Close-out narratives | Reports / Performance exports |
| 14 | Completed | Terminal | Status + Timeline |

### Process rail (Campaign workspace — proposed visible stages)

A practical rail (not every micro-stage) for day-to-day ops:

```
Overview → Planning → Assignments → Client IO → Vendor IO
  → Deliverables → Performance → Finance → Timeline
```

Discovery/Shortlist/Collection/Reporting appear as **linked stages** or recommended actions when relevant, without overcrowding the rail.

---

## 2. Stage states

| State | Meaning |
|-------|---------|
| Upcoming | Not started |
| Current | Active focus |
| Completed | Exit criteria met (presentation heuristic) |
| Blocked | Cannot progress (show reason) |
| Attention | Needs operator action |
| Waiting | External party (client/vendor) |

---

## 3. Recommended next action (examples)

| Situation | Next action |
|-----------|-------------|
| No assignments | Create assignment |
| Assignments ready, no Client IO | Set up / generate Client IO |
| Client IO approved, Vendor IOs missing | Generate Vendor IOs |
| Vendor IOs sent, deliverables missing | Open Deliverables |
| Live posts, weak metrics coverage | Open Performance |
| Billable ready | Create invoice |
| Outstanding AR | Open Collections |

Heuristics are **presentation-only** initially (derive from existing workspace fields already loaded).

---

## 4. Other lifecycles (summary)

### Client

`Prospect → Onboarding → Ready → Active → Credit watch → Archived`

### Vendor

`Prospect → CRM complete → Approved → Assigned → Delivering → Payable → Closed`

### Invoice

`Draft → Approved → Posted → Partially paid → Paid → Cancelled`

### Media Plan

`Draft → Under review → Approved → Executing → Actual/Remaining → Locked`

---

## 5. Mapping note (implementation later)

Do **not** invent new DB enums in this UX initiative.  
Map rail stages to existing tabs/routes (`overview`, `lines`, `client-io`, …) and existing status fields.

---

## 6. Approval questions

1. Accept the practical Campaign process rail (9 items) vs full 15-stage narrative?  
2. Confirm Discovery/Collection remain linked actions vs always-visible rail items?  
3. Confirm next-action heuristics may use existing loaded fields only (no new APIs)?
