# Thinkway Engineering Rules

## Product reference (read first)

- **`docs/THINKWAY_SYSTEM_REFERENCE.md`** — Thinkway product spec (May 2026): modules, hierarchy, campaigns, billing, roles, roadmap.
- **`docs/ARCHITECTURE_ALIGNMENT.md`** — codebase vs spec gaps; consult before new entities or modules.
- **`docs/DISCOVERY_UI_CONTRACT.md`** — mandatory Discovery UI components; run `npm run test:discovery-ui-contract` before merge.
- **`docs/DISCOVERY_ARCHITECTURE.md`** — Discovery data flow and extension rules.
- **`docs/PERFORMANCE_GOVERNANCE.md`** — performance budgets, CI gates, monitoring SLOs.
- **`docs/PERFORMANCE_ENGINEERING_STANDARDS.md`** — coding / lazy / client / bundle / CSS checklist.
- **`.cursor/rules/thinkway-product-reference.mdc`** — persistent AI guardrails.
- **`.cursor/rules/thinkway-engineering-deployment-policy.mdc`** — Dev vs Prod Supabase, migrations, Ops Center, release safety.
- **`docs/RELEASE_WORKFLOW.md`** — Dual deployment (`dev` / `app` thinkwaymedia.com), approval-gated Production.
- **`.cursor/continuity/`** — Prompt (principles) · Summary (platform KB) · Prompt Summary (current sprint).

## Stack

- Next.js App Router

- TypeScript

- Tailwind CSS

- shadcn/ui

- Supabase

- Vercel

## Rules

- Strict TypeScript

- Mobile responsive

- Reusable components only

- No duplicated logic

- Modular architecture

- Use server actions when possible

- Keep files clean and scalable

- Avoid massive files

- Use feature-based modules

- Enterprise SaaS structure

- No hardcoded values

- Proper loading/error states

## UI Style

- Modern SaaS dashboard

- Clean spacing

- Minimal design

- Dark/light ready

- Fast UX

## Project Goal

Build an enterprise influencer marketing **operations platform** (not CRUD):

- **Hierarchy:** Group → Legal Entity → Brand → Campaign Header → Campaign Line
- **Workspaces:** operational command centers at `/groups/[id]`, `/campaigns/[id]`, `/clients/[id]`, `/vendors/[id]`
- clients · campaigns · influencers/vendors · deliverables · finance · analytics · approvals · workflows
