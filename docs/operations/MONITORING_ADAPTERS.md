# Monitoring Adapters

## Contract

```ts
interface HealthProvider {
  id: string;
  name: string;
  kind: ProviderKind;
  weight?: number;
  check(ctx: HealthProviderContext): Promise<HealthCheckResult>;
}
```

Register via:

```ts
registerHealthProvider(myProvider);
```

Defaults are registered by `ensureDefaultHealthProviders()` when the registry is empty.

## Built-in providers

| ID | Kind | Probe |
|----|------|-------|
| nextjs | infrastructure | Process + build info |
| vercel | infrastructure | Deploy env metadata |
| supabase | infrastructure | `profiles` SELECT latency |
| redis | infrastructure | PING |
| bullmq | queue | Redis broker reachability |
| storage | storage | Bucket list |
| realtime | infrastructure | Config assumption (WS future) |
| openai / anthropic / gemini | ai | API key + in-process metrics |
| apify, resend, smtp, google-oauth, meta, tiktok, youtube | integration | Env configuration |

## Adding a provider

1. Implement `HealthProvider` in `features/operations-center/adapters/`.
2. Register in `registerDefaultHealthProviders()` (or call `registerHealthProvider` at boot).
3. Optionally add a dependency-graph node in `dependency-graph/build-graph.ts`.
4. Add alert rules if needed in `alerts/engine.ts`.
5. Extend `npm run test:operations` coverage for registration.

No changes to the Operations Center shell UI are required for new health cards — they appear under the matching kind tab.
