# 07 — Workspace & Tenant Isolation

## Classes

`public | authenticated | client_workspace | internal_workspace | admin_only | service_only`

Registry: `lib/security/workspace-classification-registry.ts`

## Guarantees

- Portal actors cannot reach Finance / Ops / Billing / Admin / Discovery APIs
- Unclassified APIs → 403
- Dashboard layout `InternalWorkspaceGate` hard-denies portal users
- `requirePermission` blocks portal actors on non-portal permissions

## Tenancy

- Single-agency staff may see multiple legal entities by design
- Client portal scoped by `client_users.client_id`
- Creator portal scoped by `influencers.profile_id`

Full report: `docs/security/P4_WORKSPACE_ISOLATION_REPORT.md`

