import { Badge } from "@/components/ui/badge";
import type { IoTermsSource } from "@/lib/io/client-io-terms";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<IoTermsSource, string> = {
  platform: "Platform Default",
  entity: "Vendor Default",
  io: "Custom for this IO",
};

const CLIENT_ENTITY_LABELS: Record<IoTermsSource, string> = {
  platform: "Platform Default",
  entity: "Client Default",
  io: "Custom for this IO",
};

type IoTermsSourceBadgeProps = {
  source: IoTermsSource;
  /** Use Client IO wording for the entity layer. */
  variant?: "vendor" | "client";
  className?: string;
};

export function IoTermsSourceBadge({
  source,
  variant = "vendor",
  className,
}: IoTermsSourceBadgeProps) {
  const labels = variant === "client" ? CLIENT_ENTITY_LABELS : SOURCE_LABELS;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide",
        source === "io" && "bg-amber-500/15 text-amber-900 dark:text-amber-200",
        source === "entity" && "bg-sky-500/15 text-sky-900 dark:text-sky-200",
        source === "platform" && "bg-muted text-muted-foreground",
        className
      )}
    >
      {labels[source]}
    </Badge>
  );
}
