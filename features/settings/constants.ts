import type { AccessControlModule } from "@/features/settings/types";

export const SETTINGS_MODULES: AccessControlModule[] = [
  { key: "campaigns", label: "Campaigns", permissions: ["campaigns.read", "campaigns.write"] },
  { key: "billing", label: "Billing", permissions: ["invoices.read", "invoices.write"] },
  { key: "planning", label: "Planning", permissions: ["planning.read", "planning.write", "planning.approve"] },
  { key: "collections", label: "Collections", permissions: ["collections.read", "collections.write"] },
  { key: "treasury", label: "Treasury", permissions: ["treasury.read"] },
  { key: "ios", label: "IOs", permissions: ["client_ios.read", "client_ios.write", "vendor_ios.read", "vendor_ios.write"] },
  { key: "publications", label: "Publications", permissions: ["publications.read", "publications.write", "publications.approve"] },
  { key: "analytics", label: "Analytics", permissions: ["analytics.read"] },
  { key: "client_portal", label: "Client Portal", permissions: ["client_portal.read", "client_portal.write"] },
  { key: "creator_portal", label: "Creator Portal", permissions: ["creator_portal.read", "creator_portal.write"] },
  { key: "settings", label: "Settings", permissions: ["settings.read", "settings.write", "roles.read", "roles.write"] },
];

export const INTERNAL_ROLE_SLUGS = new Set([
  "super_admin",
  "admin",
  "finance",
  "operations",
  "account_manager",
]);
