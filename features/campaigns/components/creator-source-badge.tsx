import { Badge } from "@/components/ui/badge";
import type { CreatorSourceType } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<CreatorSourceType, string> = {
  internal: "Internal Creator",
  public_discovery: "Public Discovery",
  oauth_verified: "OAuth Verified",
  imported: "Imported",
};

const SOURCE_STYLES: Record<CreatorSourceType, string> = {
  internal: "border-border/60 bg-muted/40 text-foreground",
  public_discovery: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  oauth_verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  imported: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

export function CreatorSourceBadge({
  source,
  className,
}: {
  source: CreatorSourceType;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium", SOURCE_STYLES[source], className)}
    >
      {SOURCE_LABELS[source]}
    </Badge>
  );
}
