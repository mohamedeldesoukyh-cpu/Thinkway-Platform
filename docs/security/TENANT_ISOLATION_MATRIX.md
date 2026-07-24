# Tenant Isolation Matrix

## Actor types

| Actor | Detection | Home |
|-------|-----------|------|
| Anonymous | No session | `/login` |
| Internal staff | Authenticated; not in `client_users` / linked `influencers.profile_id` | Dashboard `/` |
| Client portal | Row in `client_users` for `profile_id` | `/client-portal` |
| Creator portal | `influencers.profile_id = auth.uid()` | `/creator-portal` |
| Service | `CRON_SECRET` / service-role worker | N/A |

## Resource access matrix

| Resource | Client portal | Creator portal | Internal staff | Service |
|----------|---------------|----------------|----------------|---------|
| Own client campaigns (scoped) | Yes (`clientIds`) | No | Yes (permission) | Entity job |
| Other client campaigns | **No** | **No** | Yes* | No ambient |
| Finance / PO / invoices (internal) | **No** | **No** | Permission + MFA roles | Cron only |
| Client portal invoices view | Scoped yes | No | N/A | No |
| Operations move/reassignment | **No** | **No** | Permission | No |
| Billing workspace | **No** | **No** | Permission | No |
| Admin queues / system | **No** | **No** | Admin | No |
| Discovery AI chat / tools | **No** | **No** | Internal | No |
| AI conversations | **No** | **No** | Owner / `ai.*` RLS | No |
| Quotations / shortlists export | **No** | **No** | Permission | No |
| Creator enrichment | **No** | **No** | Enqueue | Worker by `influencerId` |
| Uploads (`creator-imports`) | **No** | **No** | discovery.* + internal | Worker |
| Publication media bucket | **No** | **No** | internal + campaigns.read | service_role |
| Notifications (portal) | Own | Own | Staff channels | No |

\* Staff multi-client visibility is intentional for agency operations.

## Enforcement layers

1. **Middleware** — portal path/API block + unclassified API 403  
2. **Layout gate** — `(dashboard)` redirects portal actors  
3. **Server permissions** — portal cannot call non-portal permissions  
4. **Portal scope** — `requireClientScope` / `requireCreatorScope` filter IDs  
5. **RLS** — `is_internal_user()`, `can_access_client()`, permission helpers  
6. **Workers** — entity IDs on job payloads; service role offline  

## Client A ↛ Client B (portal)

| Surface | Mechanism |
|---------|-----------|
| Campaigns list | `client_users` → `clientIds` filter |
| Client IO / invoices | Scoped queries in portal features |
| Notifications | User / client scoped |
| Uploads | Portal cannot access internal buckets (RLS + path deny) |
| Exports | Internal APIs blocked for portal |
| Settings | Internal `/settings` blocked |

## Residual gaps

- Staff-side object ownership (e.g. quotation created_by) is softer than portal tenancy — acceptable for internal workspace.
- Full live RLS penetration suite against two portal users requires a seeded staging DB (not in `test:appsec-p4`).
