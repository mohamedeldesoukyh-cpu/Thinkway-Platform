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
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
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
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Finance alerts
          </h2>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Grouped monitoring signals — click through to resolve.
          </p>
        </div>
      }
    >
      <div className="space-y-4 px-4 py-4 md:px-5">
        {alerts.alerts.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
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
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {GROUP_LABELS[group]}
                  </h3>
                  <Badge
                    variant="secondary"
                    className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
                  >
                    {items.length}
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {items.slice(0, 8).map((alert) => (
                    <li key={alert.id}>
                      <Link
                        href={alert.href}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50",
                          alert.severity === "danger" && "border-destructive/30",
                          alert.severity === "warning" && "border-amber-500/30"
                        )}
                      >
                        <SeverityIcon severity={alert.severity} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-foreground">{alert.title}</p>
                          <p className="line-clamp-2 text-[10px] text-muted-foreground">
                            {alert.description}
                          </p>
                          {alert.amount != null ? (
                            <p className="mt-1 text-[10px] tabular-nums text-foreground">
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
      </div>
    </OperationalTableSection>
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
