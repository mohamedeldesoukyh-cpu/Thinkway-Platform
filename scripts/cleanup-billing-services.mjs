import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const files = [
  "lib/services/billing/billing-service.ts",
  "lib/services/billing/invoice-service.ts",
  "lib/services/billing/statement-service.ts",
];

const sigFixes = [
  [/export async function getCampaignBillingLines\(\s*campaignId: string\s*\)/g, "export async function getCampaignBillingLines(supabase: SupabaseClient, campaignId: string)"],
  [/export async function getCampaignBillingGroups\(\s*campaignId: string\s*\)/g, "export async function getCampaignBillingGroups(supabase: SupabaseClient, campaignId: string)"],
  [/export async function getCampaignOperationalBillingDetail\(\s*campaignId: string\s*\)/g, "export async function getCampaignOperationalBillingDetail(supabase: SupabaseClient, campaignId: string)"],
  [/export async function getInvoiceWorkspace\(\s*invoiceId: string\s*\)/g, "export async function getInvoiceWorkspace(supabase: SupabaseClient, invoiceId: string)"],
];

for (const rel of files) {
  const fp = path.join(root, rel);
  let s = fs.readFileSync(fp, "utf8");
  if (!s.includes('import type { SupabaseClient }')) {
    s = `import type { SupabaseClient } from "@supabase/supabase-js";\n\n${s.replace(/^import type \{ SupabaseClient \}[\s\S]*?\n\n/, "")}`;
  }
  s = s.replace(/async function requireUser\(\)[\s\S]*?\n\}\r?\n\r?\n/g, "");
  s = s.replace(/const \{ supabase \} = await requireUser\(\);\r?\n\r?\n/g, "");
  s = s.replace(/const \{ supabase \} = await requireUser\(\);\r?\n/g, "");
  for (const [re, rep] of sigFixes) s = s.replace(re, rep);
  s = s.replace(/from "\.\/constants"/g, 'from "@/features/billing/constants"');
  s = s.replace(/from "\.\/types"/g, 'from "@/features/billing/types"');
  fs.writeFileSync(fp, s);
  console.log("cleaned", rel);
}
