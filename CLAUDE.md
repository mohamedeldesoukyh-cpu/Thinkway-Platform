# Thinkway Engineering Rules

## Product reference (read first)

- **`docs/THINKWAY_SYSTEM_REFERENCE.md`** — IConnect agreed spec (May 2026): modules, hierarchy, campaigns, billing, roles, roadmap.
- **`docs/ARCHITECTURE_ALIGNMENT.md`** — codebase vs spec gaps; consult before new entities or modules.
- **`.cursor/rules/thinkway-product-reference.mdc`** — persistent AI guardrails.

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