# Prompt Summary — Current Sprint

**Branch:** `develop`  
**Focus:** Client Workspace Dev QA follow-up — **Development only. Do not deploy Production.**

Three Development QA defects, all fixed in this push:

1. **Historical quotation URL** — old V1 review URLs render the frozen V1 snapshot and `Historical / Superseded / Read only`. They do not show V2 price, V2 approval state, current campaign state, or Approve / Reject / Request Changes. Canonical journey still shows V2 (`Updated — Approval required`).
2. **Approved quotation immutability** — once `quotations.status = approved`, creator commercials, deliverables, roster, and totals cannot be mutated in-place. Server/action/domain rejects with “Create a new quotation version…”. Staff must generate V2 draft, send to client, then get new approval.
3. **Client quotation approval audit** — `quotation.client_approved` is written to `audit_logs` as existing `approve` with metadata `event=client_approved`, `approval_source=client_workspace`, `actor_kind=client`. Enum unchanged.

**Do not promote Production. Stop for another live QA cycle.**

- Dev: https://dev.thinkwaymedia.com  
- Prod: https://app.thinkwaymedia.com  

Migration (Dev applied, not Production): `supabase/migrations/20260820150000_client_review_journeys.sql`
