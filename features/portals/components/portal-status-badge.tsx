import { Badge } from "@/components/ui/badge";

const statusClassMap: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  invited: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  sent: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  submitted: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  invoiced: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  draft: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  "partially paid": "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

export function PortalStatusBadge({ value }: { value: string | null | undefined }) {
  const normalized = String(value ?? "pending").toLowerCase();
  const label =
    normalized.length > 0
      ? normalized
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      : "Pending";

  return (
    <Badge variant="outline" className={statusClassMap[normalized] ?? statusClassMap.pending}>
      {label}
    </Badge>
  );
}
