"use client";

import Link from "next/link";
import {
  AlertTriangleIcon,
  CircleAlertIcon,
  InfoIcon,
  ReceiptIcon,
  TrendingDownIcon,
  WalletIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAnalyticsAmount, buildCurrencyContext } from "@/lib/analytics/currency/engine";
import type { FinanceAlert, FinanceAlertsPayload } from "@/lib/analytics/queries/dashboard-alerts";
import { cn } from "@/lib/utils";

const GROUP_LABELS: Record<FinanceAlert["group"], string> = {
  po: "Purchase orders",
  collections: "Collections",
  billing: "Billing",
  profitability: "Profitability",
  vendor: "Vendor payments",
};

const GROUP_ORDER: FinanceAlert["group"][] = [
  "collections",
  "billing",
  "po",
  "profitability",
  "vendor",
];

function SeverityIcon({ severity }: { severity: FinanceAlert["severity"] }) {
  if (severity === "danger") {
    return <CircleAlertIcon className="size-4 text-destructive" aria-hidden />;
  }
  if (severity === "warning") {
    return <AlertTriangleIcon className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />;
  }
  return <InfoIcon className="size-4 text-muted-foreground" aria-hidden />;
}

type FinanceAlertsPanelProps = {
  alerts: FinanceAlertsPayload;
};

export function FinanceAlertsPanel({ alerts }: FinanceAlertsPanelProps) {
  const currency = buildCurrencyContext([]);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Finance alerts</CardTitle>
        <CardDescription className="text-xs">
          Grouped monitoring signals — click through to resolve.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.alerts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No active alerts for the current filter set.
          </p>
        ) : (
          GROUP_ORDER.map((group) => {
            const items = alerts.by_group[group];
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-2">
                <div className="flex items-center gap-2">
                  <GroupIcon group={group} />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {GROUP_LABELS[group]}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {items.length}
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {items.slice(0, 8).map((alert) => (
                    <li key={alert.id}>
                      <Link
                        href={alert.href}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border px-3 py-2 transition-colors hover:bg-muted/50",
                          alert.severity === "danger" && "border-destructive/30",
                          alert.severity === "warning" && "border-amber-500/30"
                        )}
                      >
                        <SeverityIcon severity={alert.severity} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{alert.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {alert.description}
                          </p>
                          {alert.amount != null ? (
                            <p className="mt-1 text-xs tabular-nums text-foreground">
                              {formatAnalyticsAmount(alert.amount, currency)}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function GroupIcon({ group }: { group: FinanceAlert["group"] }) {
  switch (group) {
    case "po":
      return <WalletIcon className="size-4 text-muted-foreground" aria-hidden />;
    case "collections":
      return <ReceiptIcon className="size-4 text-muted-foreground" aria-hidden />;
    case "billing":
      return <ReceiptIcon className="size-4 text-muted-foreground" aria-hidden />;
    case "profitability":
      return <TrendingDownIcon className="size-4 text-muted-foreground" aria-hidden />;
    case "vendor":
      return <WalletIcon className="size-4 text-muted-foreground" aria-hidden />;
    default:
      return null;
  }
}
