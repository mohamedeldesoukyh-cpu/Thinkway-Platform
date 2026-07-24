# Architecture Diagrams (Mermaid)

## Overall Architecture

```mermaid
flowchart TB
  Users --> NextJS[Next.js on Vercel]
  NextJS --> API[Route Handlers / Server Actions]
  API --> SB[(Supabase Postgres + Auth + Storage)]
  API --> Redis[(Redis)]
  Redis --> BullMQ[BullMQ Queues]
  BullMQ --> Worker[Discovery Worker]
  Worker --> SB
  API --> AI[AI Providers]
  API --> Email[Resend / SMTP]
  API --> Apify[Apify]
```

## Authentication Flow

```mermaid
sequenceDiagram
  participant U as User
  participant P as proxy.ts
  participant S as Supabase Auth
  participant A as App
  U->>P: Request
  P->>P: Rate limit + CSRF
  P->>S: getUser / session
  alt MFA required
    S-->>U: AAL2 challenge
  end
  P->>A: Authorized request
  A->>A: requirePermission / workspace actor
```

## Workspace Isolation

```mermaid
flowchart LR
  Portal[Client / Creator Portal] -->|blocked| Internal[Internal Workspace]
  Portal -->|blocked| Finance
  Portal -->|blocked| AdminAPI[Admin / Ops APIs]
  Staff[Internal Staff] --> Internal
  Staff --> Finance
  Staff --> OpsCenter[Operations Center]
```

## Discovery Pipeline

```mermaid
flowchart LR
  Search[Discovery Search] --> Browse[Unified Browse]
  Browse --> Enrich[Enrichment Queues]
  Import[Import Center] --> Enrich
  Enrich --> DNA[Creator DNA]
  DNA --> Shortlist
  Shortlist --> Quotation
  Quotation --> Campaign
```

## AI Pipeline

```mermaid
flowchart TB
  User --> Chat[/api/ai/chat]
  Chat --> Tools[Tool Registry]
  Tools --> JWT[User JWT + RLS]
  JWT --> SB[(Supabase)]
  Tools --> Isolation[AI Isolation Guards]
  Isolation -->|deny| FinanceTools[Finance tools / billing reports]
```

## Finance Pipeline

```mermaid
flowchart LR
  Lines[Campaign Lines] --> PO[PO / Billing]
  PO --> Invoice
  Invoice --> Posting[Posting Center]
  Posting --> FX[FX / VAT]
  Invoice --> Collections
```

## Queue Architecture

```mermaid
flowchart TB
  App[Next.js producers] --> Redis
  Cron[/api/cron] --> Redis
  Redis --> Q1[discovery-run]
  Redis --> Q2[creator-enrichment]
  Redis --> Q3[publication-metrics]
  Redis --> DLQ[creator-enrichment-dlq]
  Q1 & Q2 & Q3 --> Worker
  Worker --> SB[(Supabase)]
```

## Database Relationships

```mermaid
erDiagram
  GROUPS ||--o{ CLIENTS : has
  CLIENTS ||--o{ BRANDS : has
  BRANDS ||--o{ CAMPAIGN_HEADERS : has
  CAMPAIGN_HEADERS ||--o{ CAMPAIGN_LINES : has
  CAMPAIGN_LINES ||--o{ CAMPAIGN_INFLUENCERS : assigns
  INFLUENCERS ||--o{ CAMPAIGN_INFLUENCERS : linked
```

## Deployment Architecture

```mermaid
flowchart LR
  Git --> Vercel
  Git --> WorkerHost[Worker Host]
  Vercel --> SupabaseProd[(Supabase Prod)]
  WorkerHost --> RedisProd[(Redis Prod)]
  WorkerHost --> SupabaseProd
  DNS --> Vercel
```

## Operations Center

```mermaid
flowchart TB
  OpsUI[/operations] --> Snapshot[buildOperationsCenterSnapshot]
  Snapshot --> Health[Health Engine]
  Snapshot --> Queues[Queue Monitor]
  Snapshot --> Alerts[Alert Engine]
  Snapshot --> Graph[Dependency Graph]
  Health --> Adapters[HealthProvider Registry]
```

## Monitoring Architecture

```mermaid
flowchart LR
  Probes[/api/health /ready] --> Ops[Operations Center]
  Adapters --> Ops
  Heartbeat[Worker Heartbeat] --> Ops
  Guards[Rate limit / CSRF counters] --> Ops
  Ops --> Alerts
  Sentry[(Sentry optional)] --> Oncall
```

