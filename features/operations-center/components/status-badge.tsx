import { Badge } from "@/components/ui/badge";

import type { AlertLevel, ComponentStatus } from "../types";

const STATUS_CLASS: Record<ComponentStatus, string> = {
  healthy: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-red-600/15 text-red-700 dark:text-red-400",
  offline: "bg-zinc-500/20 text-zinc-700 dark:text-zinc-300",
  unknown: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

export function ComponentStatusBadge({ status }: { status: ComponentStatus }) {
  return (
    <Badge variant="outline" className={`text-[10px] uppercase ${STATUS_CLASS[status]}`}>
      {status}
    </Badge>
  );
}

const ALERT_CLASS: Record<AlertLevel, string> = {
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-red-600/15 text-red-700 dark:text-red-400",
};

export function AlertLevelBadge({ level }: { level: AlertLevel }) {
  return (
    <Badge variant="outline" className={`text-[10px] uppercase ${ALERT_CLASS[level]}`}>
      {level}
    </Badge>
  );
}
