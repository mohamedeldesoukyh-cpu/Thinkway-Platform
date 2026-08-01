# 07 — Navigation Flow Diagrams

**Status:** Draft for Product approval

---

## 1. Target platform flow

```mermaid
flowchart TB
  subgraph platform [Platform Navigation]
    Home[Home]
    CampMod[Campaigns]
    Comm[Commercial]
    Fin[Finance]
    Net[Network]
    Disc[Discovery]
  end

  CampMod --> Portfolio[Campaign Portfolio]
  Portfolio --> Entity[Campaign Entity Shell]
  Entity --> Process[Business Process Navigation]
  Process --> Content[Stage Content]

  Content -->|Planning| MediaPlan[Media Plan]
  Content -->|Planning| Studio[Studio]
  Content -->|Assist| AI[AI in context]
  Content -->|Finance stage| FinLink[Finance documents]
```

---

## 2. Current vs target (Campaign)

### Current (problem)

```mermaid
flowchart LR
  Sidebar --> StudioApp[/studio and /ai]
  Sidebar --> CampList[/campaigns]
  CampList --> Aurora[/campaigns/id]
  Aurora --> Tabs[Peer tabs]
  Aurora --> Hero[Hero actions]
  Hero --> StudioApp
  Hero --> MP[/media-plan]
  Tabs --> Hero
```

Multiple parallel paths to the same work; Studio feels external.

### Target

```mermaid
flowchart TB
  CampList[Campaign Portfolio] --> Shell[Persistent Campaign Shell]
  Shell --> Rail[Process Navigation]
  Rail --> OV[Overview]
  Rail --> PL[Planning]
  Rail --> AS[Assignments]
  Rail --> CIO[Client IO]
  Rail --> VIO[Vendor IO]
  Rail --> DEL[Deliverables]
  Rail --> PERF[Performance]
  Rail --> FIN[Finance]
  Rail --> TL[Timeline]
  PL --> MP[Media Plan surface]
  PL --> ST[Studio surface]
  Shell -.->|same identity| MP
  Shell -.->|same identity| ST
```

---

## 3. Open campaign journey

```mermaid
sequenceDiagram
  actor U as Operator
  participant P as Portfolio
  participant S as Campaign Shell
  participant R as Process Rail
  participant C as Stage Content

  U->>P: Scan stage / health / next action
  U->>P: Open campaign
  P->>S: Enter entity with recommended stage
  S->>R: Highlight current stage
  S->>C: Show stage workspace
  U->>R: Advance to next stage
  R->>C: Swap content only
  Note over S: Identity KPIs health remain
```

---

## 4. Cross-module with origin

```mermaid
flowchart LR
  CampFinance[Campaign Finance stage] -->|Create invoice| Inv[Invoice workspace]
  Inv -->|Opened from TW-xxxx| CampFinance
```

---

## 5. Approval question

Confirm these flows as the navigation contract for implementation phases.
