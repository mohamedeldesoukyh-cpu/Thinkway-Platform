import {
  SparklesIcon,
  UploadIcon,
  PencilIcon,
  CircleDashedIcon,
  CheckCircle2Icon,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Self-contained data-source badge (spec §1/§11). Renders the transparency
 * source of an enriched value so reviewers always know its provenance.
 */
export type DataSource =
  | "apify"
  | "imported"
  | "manual"
  | "forecast"
  | "actual"
  | "unavailable";

const SOURCE_META: Record<
  DataSource,
  { label: string; icon: LucideIcon; className: string }
> = {
  apify: {
    label: "Apify",
    icon: SparklesIcon,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  actual: {
    label: "Actual",
    icon: CheckCircle2Icon,
    className:
      "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  imported: {
    label: "Imported",
    icon: UploadIcon,
    className: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  },
  manual: {
    label: "Manual",
    icon: PencilIcon,
    className:
      "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  forecast: {
    label: "Forecast",
    icon: CircleDashedIcon,
    className:
      "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
  },
  unavailable: {
    label: "Unavailable",
    icon: CircleDashedIcon,
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function DataSourceBadge({
  source,
  label,
  className,
}: {
  source: DataSource;
  /** Optional override label (e.g. provider name). */
  label?: string;
  className?: string;
}) {
  const meta = SOURCE_META[source] ?? SOURCE_META.unavailable;
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", meta.className, className)}
    >
      <Icon aria-hidden />
      {label ?? meta.label}
    </Badge>
  );
}
