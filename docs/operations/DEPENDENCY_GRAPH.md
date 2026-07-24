# Dependency Graph

## Topology

```
Users
  ↓
Next.js
  ↓
API
  ↓
├─ Supabase → Storage
├─ Redis → BullMQ
├─ AI (OpenAI)
├─ Email (Resend)
├─ Discovery (Apify) ← API + BullMQ + AI
└─ Finance ← Supabase + API
```

## Live status

Each node copies status/latency/lastFailure from the matching health adapter when available:

- `api` mirrors `nextjs`
- `finance-domain` mirrors `supabase`
- `users` is always healthy (entry actor)

Built by `buildDependencyGraph(components)` in `features/operations-center/dependency-graph/build-graph.ts`.

## Future

- Click-through from node → adapter detail  
- Edge latency annotations  
- Automatic topology from adapter `dependsOn` metadata
