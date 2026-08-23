import type {
  WorkspaceClass,
  WorkspaceClassificationEntry,
} from "@/lib/security/workspace-class";

/**
 * Central P4 registry.
 * Prefix rules are evaluated longest-prefix-first for pages.
 * API routes use exact path templates (dynamic segments as [param]).
 */

/** Ordered page prefix → class (longest match wins). */
export const PAGE_PREFIX_CLASSIFICATIONS: Array<{
  prefix: string;
  class: WorkspaceClass;
  portal?: "client" | "creator";
}> = [
  { prefix: "/login", class: "public" },
  { prefix: "/auth", class: "public" },
  { prefix: "/io-approval", class: "public" },
  { prefix: "/review", class: "public" },
  { prefix: "/client-portal", class: "client_workspace", portal: "client" },
  { prefix: "/creator-portal", class: "client_workspace", portal: "creator" },
  { prefix: "/finance", class: "internal_workspace" },
  { prefix: "/operations", class: "internal_workspace" },
  { prefix: "/billing", class: "internal_workspace" },
  { prefix: "/collections", class: "internal_workspace" },
  { prefix: "/treasury", class: "internal_workspace" },
  { prefix: "/reports", class: "internal_workspace" },
  { prefix: "/settings", class: "internal_workspace" },
  { prefix: "/system", class: "admin_only" },
  { prefix: "/ai", class: "internal_workspace" },
  { prefix: "/discovery", class: "internal_workspace" },
  { prefix: "/studio", class: "internal_workspace" },
  { prefix: "/intelligence", class: "internal_workspace" },
  { prefix: "/planning", class: "internal_workspace" },
  { prefix: "/campaigns", class: "internal_workspace" },
  { prefix: "/clients", class: "internal_workspace" },
  { prefix: "/groups", class: "internal_workspace" },
  { prefix: "/brands", class: "internal_workspace" },
  { prefix: "/vendors", class: "internal_workspace" },
  { prefix: "/ios", class: "internal_workspace" },
  { prefix: "/links", class: "internal_workspace" },
  { prefix: "/dashboard", class: "internal_workspace" },
  { prefix: "/", class: "internal_workspace" },
];

/** Exact API path templates (Next dynamic segments kept as [id] style). */
export const API_ROUTE_CLASSIFICATIONS: Record<string, WorkspaceClass> = {
  "/api/health": "public",
  "/api/version": "public",
  "/api/build-info": "public",
  "/api/ready": "public", // detail elevates to admin/service via secret

  "/api/cron/publication-metrics": "service_only",
  "/api/cron/campaign-performance-monitor": "service_only",

  "/api/admin/queues": "admin_only",
  "/api/admin/campaign-performance/dashboard": "admin_only",
  "/api/admin/campaign-performance/health": "admin_only",
  "/api/admin/creators/repair-avatars": "admin_only",
  "/api/operations-center/snapshot": "admin_only",

  "/api/ai/chat": "internal_workspace",
  "/api/ai/conversations": "internal_workspace",
  "/api/ai/conversations/[id]": "internal_workspace",
  "/api/ai/conversations/[id]/messages/[messageId]": "internal_workspace",
  "/api/ai/campaign-objects/[id]/export": "internal_workspace",
  "/api/ai/campaign-objects/[id]/lifecycle": "internal_workspace",
  "/api/ai/campaign-objects/[id]/outputs/export": "internal_workspace",
  "/api/ai/campaign-objects/[id]/promote-scenario": "internal_workspace",
  "/api/ai/campaign-objects/[id]/versions": "internal_workspace",
  "/api/ai/campaign-objects/[id]/versions/[version]": "internal_workspace",

  "/api/discovery/search": "internal_workspace",
  "/api/discovery/jobs": "internal_workspace",
  "/api/discovery/jobs/[id]": "internal_workspace",
  "/api/discovery/diagnostics": "admin_only",
  "/api/discovery/import/files": "internal_workspace",
  "/api/discovery/acquisition/session": "internal_workspace",
  "/api/discovery/compare/document": "internal_workspace",

  "/api/operations/campaigns": "internal_workspace",
  "/api/operations/vendors/[id]/assignments": "internal_workspace",

  "/api/campaigns/influencers": "internal_workspace",
  "/api/campaigns/[id]/performance/document": "internal_workspace",
  "/api/campaigns/[id]/publications": "internal_workspace",
  "/api/campaigns/[id]/publications-bundle": "internal_workspace",

  "/api/clients/[clientId]/documents": "internal_workspace",
  "/api/creators/avatar": "internal_workspace",
  "/api/creators/publication-preview": "internal_workspace",
  "/api/review/media": "public",
  "/api/review/content": "public",
  "/api/review/quotation": "public",
  "/api/review/brand-logo": "public",
  "/api/vendors/platform-accounts/enrich": "internal_workspace",
  "/api/vendors/crm-import-search": "internal_workspace",

  "/api/quotations/[id]/export": "internal_workspace",
  "/api/shortlists/[id]/export": "internal_workspace",
  "/api/invoices/[id]/document": "internal_workspace",
  "/api/client-ios/[id]/document": "internal_workspace",
  "/api/vendor-ios/[id]/document": "internal_workspace",

  "/api/reports/client-profitability/document": "internal_workspace",
  "/api/reports/daily/drilldown": "internal_workspace",
  "/api/reports/pnl/document": "internal_workspace",
  "/api/reports/revenue-by-function/document": "internal_workspace",
  "/api/reports/spending-by-category/document": "internal_workspace",
  "/api/reports/statements/document": "internal_workspace",
  "/api/reports/top-clients/document": "internal_workspace",
  "/api/reports/top-influencers/document": "internal_workspace",
  "/api/reports/unsettled/document": "internal_workspace",
  "/api/reports/vr/document": "internal_workspace",
};

/** Server Action modules → workspace class (feature bucket). */
export const SERVER_ACTION_MODULE_CLASSIFICATIONS: Record<string, WorkspaceClass> = {
  "features/auth": "authenticated",
  "features/portals": "client_workspace",
  "features/client-access": "internal_workspace",
  "features/settings": "internal_workspace",
  "features/finance": "internal_workspace",
  "features/billing": "internal_workspace",
  "features/collections": "internal_workspace",
  "features/operations": "internal_workspace",
  "features/operations-center": "internal_workspace",
  "features/planning": "internal_workspace",
  "features/campaigns": "internal_workspace",
  "features/campaign-studio": "internal_workspace",
  "features/campaign-plan": "internal_workspace",
  "features/campaign-outputs": "internal_workspace",
  "features/campaign-intelligence-profile": "internal_workspace",
  "features/ai-workspace": "internal_workspace",
  "features/discovery": "internal_workspace",
  "features/discovery-import": "internal_workspace",
  "features/quotations": "internal_workspace",
  "features/io": "internal_workspace",
  "features/clients": "internal_workspace",
  "features/groups": "internal_workspace",
  "features/brands": "internal_workspace",
  "features/vendors": "internal_workspace",
  "features/creator-dna": "internal_workspace",
  "features/validation": "internal_workspace",
  "app/io-approval": "public",
  "app/(client-workspace)": "public",
  "features/client-workspace": "public",
};

/** Background workers / queues. */
export const WORKER_CLASSIFICATIONS: WorkspaceClassificationEntry[] = [
  {
    id: "discovery-worker/discovery-run",
    kind: "worker",
    class: "service_only",
    notes: "Service-role BullMQ worker; entity-scoped job payloads",
  },
  {
    id: "discovery-worker/creator-enrichment",
    kind: "worker",
    class: "service_only",
  },
  {
    id: "discovery-worker/creator-import",
    kind: "worker",
    class: "service_only",
  },
  {
    id: "discovery-worker/publication-metrics",
    kind: "worker",
    class: "service_only",
  },
  {
    id: "discovery-worker/publication-screenshot",
    kind: "worker",
    class: "service_only",
  },
  {
    id: "cron/publication-metrics",
    kind: "cron",
    class: "service_only",
  },
  {
    id: "cron/campaign-performance-monitor",
    kind: "cron",
    class: "service_only",
  },
];

/** Path prefixes that portal (client/creator) actors must never reach. */
export const PORTAL_BLOCKED_PAGE_PREFIXES = [
  "/finance",
  "/operations",
  "/billing",
  "/collections",
  "/treasury",
  "/reports",
  "/settings",
  "/system",
  "/ai",
  "/discovery",
  "/studio",
  "/intelligence",
  "/planning",
  "/campaigns",
  "/clients",
  "/groups",
  "/brands",
  "/vendors",
  "/ios",
  "/links",
  "/dashboard",
] as const;

/** API path prefixes blocked for portal actors. */
export const PORTAL_BLOCKED_API_PREFIXES = [
  "/api/admin",
  "/api/operations-center",
  "/api/ai",
  "/api/discovery",
  "/api/operations",
  "/api/reports",
  "/api/campaigns",
  "/api/clients",
  "/api/quotations",
  "/api/shortlists",
  "/api/invoices",
  "/api/client-ios",
  "/api/vendor-ios",
  "/api/creators",
  "/api/vendors",
  "/api/cron",
] as const;
