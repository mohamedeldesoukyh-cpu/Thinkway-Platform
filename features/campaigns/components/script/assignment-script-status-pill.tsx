"use client";

import type { CreatorScriptStatusView } from "@/lib/campaign-script";
import { cn } from "@/lib/utils";

export function AssignmentScriptStatusPill({
  status,
  onOpen,
  onAssign,
}: {
  status: CreatorScriptStatusView | null;
  onOpen?: () => void;
  onAssign?: () => void;
}) {
  if (!status) {
    return (
      <span className="mt-0.5 block text-[10px] text-muted-foreground">Script · —</span>
    );
  }
  const tone =
    status.state === "customized"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      : status.state === "inherited"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
        : "border-border/60 bg-muted/50 text-muted-foreground";
  const label =
    status.state === "not_assigned"
      ? "Not assigned"
      : status.state === "inherited"
        ? `Inherited · ${status.versionLabel}`
        : `Customized · ${status.versionLabel}`;
  const action = status.actionLabel === "Assign" ? onAssign : onOpen;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        action?.();
      }}
      className={cn(
        "mt-1 inline-flex max-w-full items-center rounded-full border px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight",
        tone
      )}
      title={status.alignmentNote ?? label}
    >
      Script · {label}
    </button>
  );
}
