import fs from "node:fs";

const files = [
  "lib/services/billing/approval-service.ts",
  "lib/services/billing/billing-service.ts",
  "lib/services/billing/collection-service.ts",
  "lib/services/billing/invoice-service.ts",
  "lib/services/billing/vendor-payment-service.ts",
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(/\{\s*;\s*\}/g, "{");
  s = s.replace(/\}\s*const /g, "\n  const ");
  s = s.replace(/\}\s*const\[/g, "\n  const[");
  s = s.replace(/\}\s*return /g, "\n  return ");
  s = s.replace(/\}\s*await /g, "\n  await ");
  s = s.replace(/\}\s*let /g, "\n  let ");
  s = s.replace(/\}\s*if /g, "\n  if ");
  s = s.replace(/\}\s*for /g, "\n  for ");
  s = s.replace(/;\s*return /g, "\n  return ");
  s = s.replace(/;\s*await syncDeliverable/g, "\n  await syncDeliverable");
  s = s.replace(
    /export async function grantFinanceOverride\(\s*input\.approval_id: string,\s*input\.line_id: string,\s*input\.hours: number\s*\): Promise<BillingMutationResult> \{/,
    "export async function grantFinanceOverride(supabase: SupabaseClient, userId: string, input: { approval_id: string; line_id: string; hours: number }): Promise<BillingMutationResult> {"
  );
  s = s.replace(
    /\.eq\("id", input\.approval_id\);return /g,
    '.eq("id", input.approval_id);\n\n  return '
  );
  fs.writeFileSync(f, s);
  console.log("fixed", f);
}
