import type { CustomColumn } from "@/lib/reports/custom/custom-report";

export const FIELD_GROUPS: { label: string; keys: CustomColumn[] }[] = [
  { label: "Campaign details", keys: ["campaignNumber", "group", "client", "brand", "campaign"] },
  { label: "Revenue", keys: ["revenue", "accruedRevenue", "totalRevenue"] },
  { label: "Cost", keys: ["cost", "accruedCost", "totalCost"] },
  { label: "Gross profit", keys: ["gp", "accruedGp", "totalGp"] },
  { label: "Revenue share", keys: ["revenueShare"] },
  { label: "Creator details", keys: ["creator", "deliverables", "platform"] },
];
export const FIELD_DESCRIPTIONS: Record<CustomColumn, string> = {
  campaignNumber: "Campaign document number", group: "Client holding group", client: "Billing client", brand: "Campaign brand", campaign: "Campaign title",
  revenue: "Revenue · went live", accruedRevenue: "Accrued revenue · not yet live", totalRevenue: "Revenue + accrued revenue",
  cost: "Cost · went live", accruedCost: "Accrued cost · not yet live", totalCost: "Cost + accrued cost",
  gp: "Gross profit = revenue − cost", accruedGp: "Accrued gross profit", totalGp: "GP + accrued GP",
  revenueShare: "Campaign revenue share (allocated per creator)", creator: "Turns on one row per creator", deliverables: "Deliverable quantities and types", platform: "Instagram, TikTok, and other platforms", vat: "Added by Include VAT · always last",
};
