# Alert Engine

## Levels

- `info`
- `warning`
- `critical`

## Evaluation

`evaluateAlerts(ctx)` is pure and deterministic given the latest snapshot:

- Redis offline/critical  
- Supabase unavailable  
- Storage critical  
- AI (OpenAI) unavailable  
- Worker missing/stale heartbeat  
- Queue stuck (waiting &gt; 200 or oldest wait &gt; 30m)  
- Elevated queue failures / DLQ  
- High latency (&gt; 2s)  
- Overall health score &lt; 50  
- Deployment failed (when Vercel adapter sets `meta.deploymentFailed`)

## Extending

Add a rule inside `features/operations-center/alerts/engine.ts`. Keep rules side-effect free so unit tests can assert titles/ids.
