# Campaign Performance — Connectivity Diagnosis

Last verified: 2026-06-23 (Node v24.16.0, Windows)

## Symptom

`npm run audit:metrics` fails immediately after the banner with:

```
TypeError: fetch failed
```

The Next.js app and background workers can still reach Supabase from other contexts (browser, Docker/Linux workers).

## Exact failing request

The metrics audit calls `auditMetricsIntegrity()` in `lib/performance/campaign-performance-audit.ts`, which queries `campaign_publications` via the Supabase JS client. That resolves to a PostgREST GET:

```
https://<project-ref>.supabase.co/rest/v1/campaign_publications?select=id%2Ccampaign_header_id%2Cviews%2Clikes%2Ccomments%2Cshares%2Csaves%2Cengagements%2Cengagement_rate&content_url=not.is.null
```

Example (this environment):

```
https://hsxrewjcbvmbkqdlzjhs.supabase.co/rest/v1/campaign_publications?select=id%2Ccampaign_header_id%2Cviews%2Clikes%2Ccomments%2Cshares%2Csaves%2Cengagements%2Cengagement_rate&content_url=not.is.null
```

## Root cause category

**TLS certificate verification failure** (`tls_certificate`)

| Probe | Result |
| --- | --- |
| DNS (`hsxrewjcbvmbkqdlzjhs.supabase.co`) | OK — resolves to Cloudflare IPv4 |
| TLS handshake | FAIL — `UNABLE_TO_VERIFY_LEAF_SIGNATURE` |
| `fetch(SUPABASE_URL)` | FAIL — `TypeError: fetch failed` (cause: same TLS error) |
| `fetch(REST metrics URL)` | FAIL — same |

Node.js v24 on Windows does not use the Windows system CA store by default. Corporate SSL inspection (HTTPS proxy with a private root CA) or a missing intermediate chain causes Node CLI scripts to reject the certificate, while browsers and some worker runtimes (which trust OS CAs) continue to work.

This is **not** a Supabase outage, DNS failure, or incorrect `NEXT_PUBLIC_SUPABASE_URL`.

## Env loading (audit scripts)

`audit-metrics.ts` uses the same pattern as `audit-campaign-performance-final.ts`:

1. `import "@/lib/performance/script-env-preload"` — loads env before other imports
2. `createScriptSupabase()` from `lib/performance/script-env.ts`
3. `tsx --import script-env-preload.ts` via `scripts/run-performance-script.mjs`

Env search order (last wins): `.env.local` → `.env` → `services/discovery-worker/.env`.

## Remediation

### 1. Use system CA store (recommended on Node 22+)

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npm run audit:metrics
```

Or set `NODE_OPTIONS=--use-system-ca` permanently in your shell profile or CI job.

### 2. Install corporate root CA

If your network performs SSL inspection:

1. Export the organisation root CA as PEM.
2. Install it in **Windows Trusted Root Certification Authorities**.
3. Optionally point Node at it: `NODE_EXTRA_CA_CERTS=C:\path\to\corp-root.pem`

### 3. Verify after fix

```powershell
npm run audit:metrics
```

On failure, the script now prints a structured connectivity report (DNS, TLS, fetch probes, category, remediation).

### 4. Programmatic diagnostics

```typescript
import { diagnoseSupabaseConnectivity, formatConnectivityReport } from "@/lib/performance/script-env";

const report = await diagnoseSupabaseConnectivity();
console.log(formatConnectivityReport(report));
```

## Files involved

| File | Role |
| --- | --- |
| `scripts/audit-metrics.ts` | Metrics audit CLI |
| `lib/performance/campaign-performance-audit.ts` | `auditMetricsIntegrity()` query |
| `lib/performance/script-env.ts` | Env load, `createScriptSupabase`, `diagnoseSupabaseConnectivity()` |
| `lib/performance/script-env-preload.ts` | Early env injection for tsx |

## Why the app still works

- **Browser**: uses Windows certificate store (includes corporate roots).
- **Workers in Docker/Linux**: often use OS CA bundle or different Node flags.
- **Node CLI (tsx)**: uses Node's built-in CA list unless `--use-system-ca` or `NODE_EXTRA_CA_CERTS` is set.
