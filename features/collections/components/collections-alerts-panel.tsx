"use client";

import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";

import type { CollectionsAlertsPayload } from "@/lib/collections/alerts/collections-alerts";
import { cn } from "@/lib/utils";

type CollectionsAlertsPanelProps = {
  alerts: CollectionsAlertsPayload;
};

export function CollectionsAlertsPanel({ alerts }: CollectionsAlertsPanelProps) {
  if (alerts.alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-heading text-sm font-semibold">Collections alerts</h3>
      <div className="grid gap-2 md:grid-cols-2">
        {alerts.alerts.map((alert) => (
          <Link
            key={alert.id}
            href={alert.href}
            className={cn(
              "flex gap-3 rounded-2xl border px-4 py-3 transition-colors hover:bg-muted/50",
              alert.severity === "danger" && "border-red-500/40 bg-red-500/5",
              alert.severity === "warning" && "border-amber-500/40 bg-amber-500/5",
              alert.severity === "info" && "border-border"
            )}
          >
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium">{alert.title}</p>
              <p className="text-xs text-muted-foreground">{alert.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
