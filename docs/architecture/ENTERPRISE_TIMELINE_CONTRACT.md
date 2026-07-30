# Enterprise Timeline Contract (Release 2.1)

**Status:** Active  
**Store:** `audit_logs` only — no parallel timeline tables  
**Code:** `lib/timeline/enterprise-timeline-contract.ts`, `lib/timeline/emit-enterprise-timeline-event.ts`

## Principles

1. One chronological campaign event spine.
2. Modules emit; Timeline projects.
3. Assignment (`campaign_line_id`) is included whenever the event is operational.
4. Specialized domain tables (documentation events, payment timeline, revisions) may continue as source systems — they project into Timeline later; they do not replace `audit_logs`.

## Metadata shape

```ts
{
  source: "enterprise_timeline",
  event: "assignment.created" | "media_plan.client_approved" | ...,
  label: "Human label",
  summary: "Operator-readable summary",
  campaign_header_id: "<uuid>",
  campaign_id: "<uuid>",          // same as header for compatibility
  campaign_line_id?: "<uuid>|null",
  assignment_deliverable_id?: "<uuid>|null",
  assignment_post_schedule_id?: "<uuid>|null",
  media_plan_id?: "<uuid>|null",
  campaign_object_id?: "<uuid>|null",
  version?: number|null,
  module?: "media_plan" | "assignments" | ...
}
```

## R2.1 emitters

| Module | Status |
|---|---|
| Media Plan lifecycle | Active via `logMediaPlanTimelineEvents` (mapped to enterprise event names) |
| Assignment create/update | Contract + emitter ready; incremental adoption (Convert already logs conversion) |
| Deliverable / Publication / Performance | Contract defined; fuller coverage in later releases |
| Invoice / Payment | Contract defined; emitters in 2.2/2.3/3.0 |

## UI

Campaign workspace **Timeline & activity** → Enterprise Timeline section reads workspace activity projected from `audit_logs`.
