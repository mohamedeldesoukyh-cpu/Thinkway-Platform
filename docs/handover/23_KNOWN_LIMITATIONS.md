# 23 — Known Limitations

1. **Ops metrics are process-local** — serverless instances do not share AI/security counters.  
2. **Sentry optional** — error reporting no-op without `SENTRY_DSN`.  
3. **Staff multi-client access** — intentional; not a hard tenant DB partition.  
4. **Quotations SELECT** — permission-scoped, not strictly owner-only (staff).  
5. **Realtime WebSocket probe** — not implemented; inferred healthy.  
6. **Vercel Deploy API** — metadata-only without `VERCEL_API_TOKEN` deep checks.  
7. **Finance posting/export failure series** — partially instrumented (placeholders in Ops Center).  
8. **Restore drill** — procedure documented; production drill evidence may be pending.  
9. **DevOps role** — allowlisted in code; ensure role exists in prod RBAC if used.  
10. **HttpOnly cookies** — remain false for Supabase browser client compatibility (documented residual).

