"use client";

import Link from "next/link";
import { UsersIcon } from "lucide-react";

import { PlatformV6PageSectionHeader } from "@/components/platform/platform-v6-layout";
import { formatAnalyticsAmount, buildCurrencyContext } from "@/lib/analytics/currency/engine";
import type { FinanceAlert, FinanceAlertsPayload } from "@/lib/analytics/queries/dashboard-alerts";

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

type FinanceAlertsPanelProps = {
  alerts: FinanceAlertsPayload;
};

export function FinanceAlertsPanel({ alerts }: FinanceAlertsPanelProps) {
  const currency = buildCurrencyContext([]);

  return (
    <section>
      <PlatformV6PageSectionHeader
        compact
        title="Finance alerts"
        description="Grouped monitoring signals — click through to resolve."
      />
      <div className="platform-v6-alert-section">
        {alerts.alerts.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-[var(--tw-text-3,#94a3b8)]">
            No active alerts for the current filter set.
          </p>
        ) : (
          GROUP_ORDER.map((group) => {
            const items = alerts.by_group[group];
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="platform-v6-alert-group-label">
                  {group === "vendor" ? (
                    <UsersIcon className="size-3" aria-hidden />
                  ) : null}
                  {GROUP_LABELS[group]}
                  <span className="cnt">{items.length}</span>
                </div>
                <ul className="list-none p-0">
                  {items.slice(0, 8).map((alert) => (
                    <li key={alert.id}>
                      <Link href={alert.href} className="platform-v6-alert-item">
                        <div className="platform-v6-alert-dot" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 text-xs font-semibold text-[var(--tw-text,#0f172a)]">
                            {alert.title}
                          </div>
                          <div className="line-clamp-2 text-[11px] text-[var(--tw-text-3,#94a3b8)]">
                            {alert.description}
                          </div>
                          {alert.amount != null ? (
                            <div className="mt-1 text-xs font-bold text-[var(--tw-amber-text,#92400e)] tabular-nums">
                              {formatAnalyticsAmount(alert.amount, currency)}
                            </div>
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
    </section>
  );
}
