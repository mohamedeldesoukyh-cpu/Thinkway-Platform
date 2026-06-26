import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function PublicationWorkspaceEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted px-6 py-10 text-center",
        className
      )}
    >
      <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <Button size="sm" variant="outline" className="mt-4 h-8" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
