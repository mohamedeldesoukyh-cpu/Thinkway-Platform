import { z } from "zod";
export const BUILTIN_REPORT_IDS = ["overview", "pnl", "vr", "client-profitability", "revenue-by-function", "spending-by-category", "top-clients", "top-influencers", "statements", "unsettled", "daily"] as const;
export const builtinReportSchema = z.object({ id: z.enum(BUILTIN_REPORT_IDS), name: z.string().trim().min(1).max(80), description: z.string().max(500), currency: z.enum(["EGP", "USD", "AED", "SAR"]), visibility: z.enum(["all", "users"]), shared_with: z.array(z.string().uuid()).max(300) }).refine(r => r.visibility !== "users" || r.shared_with.length > 0, { message: "Choose at least one user." });
export type BuiltinReportSettings = z.infer<typeof builtinReportSchema>;
export function builtinReportIdForPath(path: string) {
  const match = path.match(/^\/(?:api\/)?reports\/([^/]+)(?:\/|$)/);
  return match && (BUILTIN_REPORT_IDS as readonly string[]).includes(match[1]) ? match[1] : null;
}
export function canSeeBuiltinReport(report: Pick<BuiltinReportSettings, "visibility" | "shared_with">, userId: string, admin: boolean) {
  return admin || report.visibility === "all" || report.shared_with.includes(userId);
}
