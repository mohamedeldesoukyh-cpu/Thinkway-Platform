/**
 * Phase 4 — move shared types/utilities from features/* to lib/domains/* and lib/*,
 * then rewrite lib/** imports away from @/features/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

function reExport(rel, from) {
  write(rel, `/** @deprecated Import from \`${from}\` — re-export for UI backward compat. */\nexport * from "${from}";\n`);
}

// ── Domain types ─────────────────────────────────────────────────────────────

write("lib/domains/billing/types.ts", read("features/billing/types.ts"));

write(
  "lib/domains/billing/constants.ts",
  read("features/billing/constants.ts").replace(
    'from "./types"',
    'from "@/lib/domains/billing/types"'
  )
);

write("lib/domains/billing/schemas.ts", read("features/billing/schemas.ts"));

write(
  "lib/domains/campaign/workspace-types.ts",
  read("features/campaigns/types.ts")
    .replace('@/features/io/types', "@/lib/domains/io/types")
    .replace(
      'billing_status: import("@/features/billing/types").CampaignLineBillingStatus;',
      'billing_status: import("@/lib/domains/campaign/types").CampaignLineBillingStatus;'
    )
    .replace(
      'operational_status: import("@/features/campaigns/types/operational").CampaignLineOperationalStatus;',
      'operational_status: import("@/lib/domains/campaign/types").CampaignLineOperationalStatus;'
    )
);

write(
  "lib/domains/campaign/assignment-hierarchy-types.ts",
  read("features/campaigns/types/assignment-hierarchy.ts").replace(
    '@/features/campaigns/types',
    "@/lib/domains/campaign/workspace-types"
  )
);

write(
  "lib/domains/campaign/operational-utils.ts",
  read("features/campaigns/types/operational.ts").replace(
    '@/features/campaigns/types/operational',
    "@/lib/domains/campaign/types"
  )
);

write(
  "lib/domains/campaign/operational-deliverable-explorer.ts",
  read("features/campaigns/types/operational-deliverable-explorer.ts")
);

write("lib/domains/io/types.ts", read("features/io/types.ts"));

write(
  "lib/domains/commercial/quotation-detail-types.ts",
  read("features/quotations/types.ts")
);

write(
  "lib/domains/commercial/quotation-constants.ts",
  read("features/quotations/constants.ts")
);

write(
  "lib/domains/groups/campaign-status.ts",
  `/** Shared group/campaign status helpers. */\n\nexport function isCancelledCampaignStatus(status: string): boolean {\n  return status === "cancelled";\n}\n`
);

const uploadSchemaMatch = read("features/clients/schemas.ts").match(
  /export const uploadClientDocumentSchema =[\s\S]*?\n}\);/
);
write(
  "lib/domains/clients/document-schemas.ts",
  `import { z } from "zod";\n\n${uploadSchemaMatch?.[0] ?? "export const uploadClientDocumentSchema = z.object({});"}\n`
);

// ── Campaign lib modules ─────────────────────────────────────────────────────

write(
  "lib/campaigns/constants.ts",
  read("features/campaigns/constants.ts")
    .replace(
      'export { labelForBillingStatus } from "@/features/billing/constants";',
      'export { labelForBillingStatus } from "@/lib/domains/billing/constants";'
    )
);

write(
  "lib/campaigns/constants/operational-status.ts",
  read("features/campaigns/constants/operational-status.ts").replace(
    '@/features/campaigns/types/operational',
    "@/lib/domains/campaign/types"
  )
);

write(
  "lib/campaigns/line-assignment.ts",
  read("features/campaigns/line-assignment.ts")
    .replace('from "./constants"', 'from "@/lib/campaigns/constants"')
    .replace(
      '): import("./types").CampaignLineAssignmentStatus | null {',
      '): import("@/lib/domains/campaign/types").CampaignLineAssignmentStatus | null {'
    )
);

write(
  "lib/campaigns/utils.ts",
  read("features/campaigns/utils.ts").replace(
    'import { METADATA_PLATFORM_KEY } from "./constants";',
    'import { METADATA_PLATFORM_KEY } from "@/lib/campaigns/constants";'
  )
);

write("lib/campaigns/hierarchy-utils.ts", read("features/campaigns/components/assignment-hierarchy/hierarchy-utils.ts"));

// line assignment schema only
const schemasContent = read("features/campaigns/schemas.ts");
const lineSchemaMatch = schemasContent.match(
  /export const lineAssignmentPayloadSchema =[\s\S]*?\n}\);/
);
write(
  "lib/campaigns/schemas.ts",
  `import { z } from "zod";

${lineSchemaMatch?.[0] ?? "export const lineAssignmentPayloadSchema = z.object({});"}
`
);

// ── Commercial / quotation lib modules ───────────────────────────────────────

write("lib/commercial/quotation-engine.ts", read("features/quotations/quotation-engine.ts"));

write(
  "lib/commercial/quotation-validity.ts",
  read("features/quotations/quotation-validity.ts").replace(
    '@/features/quotations/constants',
    "@/lib/domains/commercial/quotation-constants"
  )
);

write("lib/commercial/quotation-default-terms.ts", read("features/quotations/quotation-default-terms.ts"));

write("lib/commercial-sync/shortlist-seeds.ts", read("features/quotations/shortlist-seeds.ts"));

write(
  "lib/finance/exchange-rates/resolve-rate.ts",
  `import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function resolveEffectiveExchangeRate(input: {
  from_currency: string;
  to_currency: string;
  as_of?: string;
}): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const asOf = input.as_of ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("resolve_effective_exchange_rate", {
    p_from_currency: input.from_currency.toUpperCase(),
    p_to_currency: input.to_currency.toUpperCase(),
    p_as_of: asOf,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Number(data ?? 1);
}
`
);

write(
  "lib/discovery/promote-profile.ts",
  read("features/discovery/shortlists/promote.ts")
);

const vendorUtils = read("features/vendors/utils.ts");
const paymentTermsFn = vendorUtils.match(
  /export function formatPaymentTermsLabel[\s\S]*?\n}\n/
)?.[0];
const paymentMethodFn = vendorUtils.match(
  /export function formatPaymentMethodLabel[\s\S]*?\n}\n/
)?.[0];
write(
  "lib/vendors/format-utils.ts",
  `import { labelForOption } from "@/lib/master-data/label-for-option";
import { PAYMENT_TERMS_OPTIONS, VENDOR_PAYMENT_METHOD_OPTIONS } from "@/lib/master-data/constants";
import type { PaymentTerms } from "@/types/database";

${paymentTermsFn ?? ""}
${paymentMethodFn ?? ""}
`
);

// Creator display utils (subset for compare document)
write(
  "lib/creators/creator-display-utils.ts",
  read("features/discovery/components/creator-search/creator-search-utils.ts")
    .replace(
      'import type { CreatorSearchSort } from "./creator-search-types";',
      'export type CreatorSearchSort = "relevance" | "name" | "followers" | "engagement" | "views";'
    )
    .replace(
      /export \{\n  CREATOR_COMPARE_STORAGE_KEY[\s\S]*?\} from "@\/features\/discovery\/components\/creator-compare\/compare-storage";\n/,
      ""
    )
);

// IO campaign queries (subset used by workspace service)
const ioQueries = read("features/io/queries.ts");
const campaignIoFns = [
  "getClientIoSendHistory",
  "getClientIoSendRecipients",
  "getCampaignClientIo",
  "getCampaignVendorIos",
];
// Extract full file but fix type imports - simpler: re-export from features path via lib wrapper
write(
  "lib/io/campaign-io-queries.ts",
  ioQueries
    .replace('@/features/io/types', "@/lib/domains/io/types")
    .replace(
      /export async function getClientIos[\s\S]*$/,
      ""
    )
    .replace(/export function buildIoEmailLink[\s\S]*$/, "")
    .replace(/export async function ensureVendorIoFromAssignment[\s\S]*$/, "")
    .replace(/export function debugIo[\s\S]*$/, "")
    .trim() + "\n"
);

write(
  "lib/domains/commercial/promote-master-data-schema.ts",
  read("features/quotations/promote-master-data-schema.ts")
);

write(
  "lib/quotations/promote-master-data.ts",
  read("features/quotations/promote-master-data.ts")
    .replace('"use server";\n\n', "")
    .replace('@/features/quotations/promote-master-data-schema', "@/lib/domains/commercial/promote-master-data-schema")
    .replace('from "./types"', 'from "@/lib/domains/commercial/quotation-detail-types"')
    .replace('from "./duplicate-search"', 'from "@/features/quotations/duplicate-search"')
);

reExport(
  "features/quotations/promote-master-data-schema.ts",
  "@/lib/domains/commercial/promote-master-data-schema"
);
reExport(
  "features/quotations/promote-master-data.ts",
  "@/lib/quotations/promote-master-data"
);

// ── Feature re-exports (backward compat) ─────────────────────────────────────

reExport("features/billing/types.ts", "@/lib/domains/billing/types");
reExport("features/billing/constants.ts", "@/lib/domains/billing/constants");
reExport("features/billing/schemas.ts", "@/lib/domains/billing/schemas");

write(
  "features/campaigns/types.ts",
  `/** @deprecated Import from \`@/lib/domains/campaign/workspace-types\` — re-export for UI backward compat. */
export type {
  CampaignLineAssignmentStatus,
  LinePaymentStatus,
  VendorPaymentStatus,
  WorkflowStage,
} from "@/lib/domains/campaign/types";

export type {
  CreatorBrowseFilters,
  CreatorBrowseResult,
  InfluencerAssignmentProfile,
  InfluencerSearchResult,
} from "@/lib/domains/creator/types";

export type { CampaignLineBillingStatus as LineBillingStatus } from "@/lib/domains/campaign/types";

export * from "@/lib/domains/campaign/workspace-types";
`
);

reExport(
  "features/campaigns/types/assignment-hierarchy.ts",
  "@/lib/domains/campaign/assignment-hierarchy-types"
);
reExport(
  "features/campaigns/types/operational.ts",
  "@/lib/domains/campaign/operational-utils"
);
reExport(
  "features/campaigns/types/operational-deliverable-explorer.ts",
  "@/lib/domains/campaign/operational-deliverable-explorer"
);

reExport("features/campaigns/constants.ts", "@/lib/campaigns/constants");
reExport(
  "features/campaigns/constants/operational-status.ts",
  "@/lib/campaigns/constants/operational-status"
);
reExport("features/campaigns/line-assignment.ts", "@/lib/campaigns/line-assignment");
reExport("features/campaigns/utils.ts", "@/lib/campaigns/utils");
reExport(
  "features/campaigns/components/assignment-hierarchy/hierarchy-utils.ts",
  "@/lib/campaigns/hierarchy-utils"
);

write(
  "features/campaigns/schemas.ts",
  `${read("features/campaigns/schemas.ts").replace(/export const lineAssignmentPayloadSchema =[\s\S]*?\n}\);\n\n/, 'export { lineAssignmentPayloadSchema } from "@/lib/campaigns/schemas";\n\n')}`
);

reExport("features/quotations/types.ts", "@/lib/domains/commercial/quotation-detail-types");
reExport("features/quotations/constants.ts", "@/lib/domains/commercial/quotation-constants");
reExport("features/quotations/quotation-engine.ts", "@/lib/commercial/quotation-engine");
reExport("features/quotations/quotation-validity.ts", "@/lib/commercial/quotation-validity");
reExport("features/quotations/quotation-default-terms.ts", "@/lib/commercial/quotation-default-terms");
reExport("features/quotations/shortlist-seeds.ts", "@/lib/commercial-sync/shortlist-seeds");
reExport("features/io/types.ts", "@/lib/domains/io/types");
reExport("features/discovery/shortlists/promote.ts", "@/lib/discovery/promote-profile");

write(
  "features/groups/types.ts",
  read("features/groups/types.ts").replace(
    "export function isCancelledCampaignStatus(status: string): boolean {\n  return status === \"cancelled\";\n}",
    'export { isCancelledCampaignStatus } from "@/lib/domains/groups/campaign-status";'
  )
);

// ── Rewrite lib/** imports ───────────────────────────────────────────────────

const IMPORT_MAP = [
  ["@/features/billing/types", "@/lib/domains/billing/types"],
  ["@/features/billing/constants", "@/lib/domains/billing/constants"],
  ["@/features/billing/schemas", "@/lib/domains/billing/schemas"],
  [
    "@/features/campaigns/types/assignment-hierarchy",
    "@/lib/domains/campaign/assignment-hierarchy-types",
  ],
  [
    "@/features/campaigns/types/operational-deliverable-explorer",
    "@/lib/domains/campaign/operational-deliverable-explorer",
  ],
  ["@/features/campaigns/types/operational", "@/lib/domains/campaign/operational-utils"],
  ["@/features/campaigns/types", "@/lib/domains/campaign/workspace-types"],
  ["@/features/campaigns/line-assignment", "@/lib/campaigns/line-assignment"],
  [
    "@/features/campaigns/constants/operational-status",
    "@/lib/campaigns/constants/operational-status",
  ],
  ["@/features/campaigns/constants", "@/lib/campaigns/constants"],
  ["@/features/campaigns/schemas", "@/lib/campaigns/schemas"],
  ["@/features/campaigns/utils", "@/lib/campaigns/utils"],
  [
    "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils",
    "@/lib/campaigns/hierarchy-utils",
  ],
  ["@/features/quotations/types", "@/lib/domains/commercial/quotation-detail-types"],
  ["@/features/quotations/shortlist-seeds", "@/lib/commercial-sync/shortlist-seeds"],
  ["@/features/quotations/quotation-engine", "@/lib/commercial/quotation-engine"],
  ["@/features/quotations/quotation-validity", "@/lib/commercial/quotation-validity"],
  ["@/features/quotations/quotation-default-terms", "@/lib/commercial/quotation-default-terms"],
  ["@/features/quotations/constants", "@/lib/domains/commercial/quotation-constants"],
  [
    "@/features/quotations/promote-master-data-schema",
    "@/lib/domains/commercial/promote-master-data-schema",
  ],
  ["@/features/io/types", "@/lib/domains/io/types"],
  ["@/features/finance/exchange-rates/queries", "@/lib/finance/exchange-rates/resolve-rate"],
  ["@/features/groups/types", "@/lib/domains/groups/campaign-status"],
  [
    "@/features/discovery/components/creator-search/creator-search-utils",
    "@/lib/creators/creator-display-utils",
  ],
  ["@/features/discovery/shortlists/promote", "@/lib/discovery/promote-profile"],
  ["@/features/vendors/utils", "@/lib/vendors/format-utils"],
  ["@/features/clients/schemas", "@/lib/domains/clients/document-schemas"],
  ["@/features/quotations/promote-master-data", "@/lib/quotations/promote-master-data"],
];

function walk(dir, cb) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, cb);
    else if (/\.(ts|tsx)$/.test(ent.name)) cb(full);
  }
}

walk(path.join(root, "lib"), (file) => {
  let content = fs.readFileSync(file, "utf8");
  let changed = false;
  for (const [from, to] of IMPORT_MAP) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  // performance report → service directly
  if (content.includes("@/features/campaigns/queries/publications")) {
    content = content.replace(
      /import \{ getCampaignPerformanceBundle \} from "@\/features\/campaigns\/queries\/publications";/,
      'import { getCampaignPerformanceBundle } from "@/lib/services/campaigns/campaign-publication-service";'
    );
    changed = true;
  }
  // campaign workspace IO queries
  if (content.includes("@/features/io/queries")) {
    content = content.replace("@/features/io/queries", "@/lib/io/campaign-io-queries");
    changed = true;
  }
  if (changed) fs.writeFileSync(file, content, "utf8");
});

console.log("Phase 4 lib domain migration complete.");
