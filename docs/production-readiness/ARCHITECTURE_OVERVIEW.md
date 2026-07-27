# Architecture Overview — Thinkway

**Product:** Thinkway influencer marketing operations platform  
**Stack:** Next.js App Router · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel · Redis/BullMQ workers  

## Hierarchy (canonical)

```
Group → Legal Entity (clients) → Brand → Campaign Header → Campaign Line
```

- Brand-first campaign creation (commercial fields live on **brands**).
- Campaign numbering: header `TW-YYYY-NNNN`; lines `{header}-A/B/C`.
- Finance (revenue, cost, GP, PO) belongs at **line** level.

## Creator data layers

```
Identity (influencers / platform accounts)
    ↓
Discovery (browse, search, AI, shortlists, import, DNA)
    ↓
Commercial CRM (optional — creator_crm_profiles + activation events)
```

| Layer | Purpose | May create CRM? |
|---|---|---|
| Identity | Stable creator identity | No |
| Discovery | Research / matching / DNA | **No** |
| Commercial CRM | Operational activation audit | Only via `ensureCommercialCreator` when writers ON |

Writers gate: `CREATOR_CRM_WRITERS_ENABLED` — **default OFF**. Production must remain OFF until a future approved enablement window.

## Major surfaces

| Surface | Path / service |
|---|---|
| Internal workspace | `app/(dashboard)/**` |
| Discovery | `/discovery/*` |
| Campaigns / Studio | `/campaigns/*` |
| Vendors | `/vendors/*` |
| Portals | `/client-portal/*`, `/creator-portal/*` |
| Background workers | `services/discovery-worker` |

## Related deep docs

- `docs/THINKWAY_SYSTEM_REFERENCE.md`
- `docs/ARCHITECTURE_ALIGNMENT.md`
- `docs/DISCOVERY_ARCHITECTURE.md`
- `docs/architecture/CREATOR_CRM_FINAL_ARCHITECTURE.md`
- `docs/handover/02_SYSTEM_ARCHITECTURE.md`
