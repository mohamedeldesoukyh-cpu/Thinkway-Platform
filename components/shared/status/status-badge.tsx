import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { LegacyStatusTone, SemanticStatusTone } from "./status-config";
import {
  resolveStatusBadgeClassName,
  STATUS_PILL_BASE_CLASS,
  type StatusBadgeAppearance,
} from "./status-utils";

export type StatusBadgeProps = {
  label: string;
  tone: SemanticStatusTone | LegacyStatusTone;
  appearance?: StatusBadgeAppearance;
  variant?: "default" | "secondary" | "outline" | "destructive" | "ghost" | "link";
  className?: string;
  capitalize?: boolean;
  children?: ReactNode;
};

export function StatusBadge({
  label,
  tone,
  appearance = "outline",
  variant,
  className,
  capitalize,
  children,
}: StatusBadgeProps) {
  const badgeVariant =
    variant ?? (appearance === "ghost" ? "ghost" : "outline");
  const baseClass = appearance === "pill" ? STATUS_PILL_BASE_CLASS : undefined;

  return (
    <Badge
      variant={badgeVariant}
      className={cn(
        resolveStatusBadgeClassName(tone, appearance, className, { baseClass }),
        capitalize && "capitalize",
      )}
    >
      {children ?? label}
    </Badge>
  );
}
