export const CLIENT_PROFILE_TAB_ORDER = [
  "overview",
  "brands",
  "legal",
  "finance",
  "documents",
  "campaigns",
  "access",
] as const;

export type ClientProfileTabId = (typeof CLIENT_PROFILE_TAB_ORDER)[number];

export const CLIENT_PROFILE_TAB_STORAGE_KEY = "thinkway:client-profile-tab-order:v1";

const CLIENT_PROFILE_TAB_SET = new Set<string>(CLIENT_PROFILE_TAB_ORDER);

export function isClientProfileTabId(value: string): value is ClientProfileTabId {
  return CLIENT_PROFILE_TAB_SET.has(value);
}

export const GROUP_WORKSPACE_TAB_ORDER = [
  "overview",
  "legal-entities",
  "brands",
  "documents",
  "financial",
  "activity",
] as const;

export type GroupWorkspaceTabId = (typeof GROUP_WORKSPACE_TAB_ORDER)[number];

export const GROUP_WORKSPACE_TAB_STORAGE_KEY = "thinkway:group-workspace-tab-order:v1";

const GROUP_WORKSPACE_TAB_SET = new Set<string>(GROUP_WORKSPACE_TAB_ORDER);

export function isGroupWorkspaceTabId(value: string): value is GroupWorkspaceTabId {
  return GROUP_WORKSPACE_TAB_SET.has(value);
}

export const VENDOR_PROFILE_TAB_ORDER = [
  "overview",
  "legal",
  "finance",
  "documents",
  "platforms",
  "campaigns",
] as const;

export type VendorProfileTabId = (typeof VENDOR_PROFILE_TAB_ORDER)[number];

export const VENDOR_PROFILE_TAB_STORAGE_KEY = "thinkway:vendor-profile-tab-order:v1";

const VENDOR_PROFILE_TAB_SET = new Set<string>(VENDOR_PROFILE_TAB_ORDER);

export function isVendorProfileTabId(value: string): value is VendorProfileTabId {
  return VENDOR_PROFILE_TAB_SET.has(value);
}

export const BILLING_WORKSPACE_TAB_ORDER = [
  "queue",
  "overview",
  "invoices",
  "collections",
  "aging",
  "approvals",
  "vendors",
] as const;

export type BillingWorkspaceTabId = (typeof BILLING_WORKSPACE_TAB_ORDER)[number];

export const BILLING_WORKSPACE_TAB_STORAGE_KEY = "thinkway:billing-workspace-tab-order:v1";

const BILLING_WORKSPACE_TAB_SET = new Set<string>(BILLING_WORKSPACE_TAB_ORDER);

export function isBillingWorkspaceTabId(value: string): value is BillingWorkspaceTabId {
  return BILLING_WORKSPACE_TAB_SET.has(value);
}

export const INVOICE_WORKSPACE_TAB_ORDER = [
  "lines",
  "collections",
  "approvals",
  "activity",
] as const;

export type InvoiceWorkspaceTabId = (typeof INVOICE_WORKSPACE_TAB_ORDER)[number];

export const INVOICE_WORKSPACE_TAB_STORAGE_KEY = "thinkway:invoice-workspace-tab-order:v1";

const INVOICE_WORKSPACE_TAB_SET = new Set<string>(INVOICE_WORKSPACE_TAB_ORDER);

export function isInvoiceWorkspaceTabId(value: string): value is InvoiceWorkspaceTabId {
  return INVOICE_WORKSPACE_TAB_SET.has(value);
}

export const VAT_WORKSPACE_TAB_ORDER = [
  "settlement",
  "monthly",
  "country",
  "entity",
  "invoices",
] as const;

export type VatWorkspaceTabId = (typeof VAT_WORKSPACE_TAB_ORDER)[number];

export const VAT_WORKSPACE_TAB_STORAGE_KEY = "thinkway:vat-workspace-tab-order:v1";

const VAT_WORKSPACE_TAB_SET = new Set<string>(VAT_WORKSPACE_TAB_ORDER);

export function isVatWorkspaceTabId(value: string): value is VatWorkspaceTabId {
  return VAT_WORKSPACE_TAB_SET.has(value);
}

export const EXCHANGE_RATES_TAB_ORDER = ["currencies", "rates", "history"] as const;

export type ExchangeRatesTabId = (typeof EXCHANGE_RATES_TAB_ORDER)[number];

export const EXCHANGE_RATES_TAB_STORAGE_KEY = "thinkway:exchange-rates-tab-order:v1";

const EXCHANGE_RATES_TAB_SET = new Set<string>(EXCHANGE_RATES_TAB_ORDER);

export function isExchangeRatesTabId(value: string): value is ExchangeRatesTabId {
  return EXCHANGE_RATES_TAB_SET.has(value);
}

export const MOVE_OPERATIONS_TAB_ORDER = ["hierarchy", "vendor"] as const;

export type MoveOperationsTabId = (typeof MOVE_OPERATIONS_TAB_ORDER)[number];

export const MOVE_OPERATIONS_TAB_STORAGE_KEY = "thinkway:move-operations-tab-order:v1";

const MOVE_OPERATIONS_TAB_SET = new Set<string>(MOVE_OPERATIONS_TAB_ORDER);

export function isMoveOperationsTabId(value: string): value is MoveOperationsTabId {
  return MOVE_OPERATIONS_TAB_SET.has(value);
}
