"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import {
  calculatePoConsumption,
  type PoConsumptionSnapshot,
} from "@/lib/finance/po/calculations";
import { getPoHealthColor } from "@/lib/finance/po/status";
import { cn } from "@/lib/utils";

type CampaignLinePoPanelProps = {
  currency: string;
  poAmount: number;
  consumed: number;
  currentLineRevenue: number;
  excludeLineRevenue?: number;
  poCurrency?: string | null;
  exchangeRate?: number | null;
  fxSnapshotAt?: string | null;
};

export function CampaignLinePoPanel(props: CampaignLinePoPanelProps) {
  const snapshot = calculatePoConsumption({
    po_amount: props.poAmount,
    consumed: props.consumed,
    current_line_revenue: props.currentLineRevenue,
    exclude_line_revenue: props.excludeLineRevenue ?? 0,
  });

  return (
    <Card className={cn(snapshot.is_over_consumed && "border-destructive/50")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">PO utilization (live)</CardTitle>
          <Badge
            variant={snapshot.is_over_consumed ? "destructive" : "secondary"}
          >
            {healthLabel(snapshot.health)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <MetricGrid snapshot={snapshot} currency={props.currency} />
        {props.poCurrency && props.exchangeRate ? (
          <p className="text-xs text-muted-foreground">
            FX: 1 {props.poCurrency} = {props.exchangeRate.toFixed(4)} {props.currency}
            {props.fxSnapshotAt ? " · snapshot preserved" : ""}
          </p>
        ) : null}
        {props.poAmount > 0 ? (
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full", getPoHealthColor(snapshot.health))}
              style={{
                width: `${Math.min(
                  100,
                  (snapshot.projected_consumed / props.poAmount) * 100
                )}%`,
              }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricGrid({
  snapshot,
  currency,
}: {
  snapshot: PoConsumptionSnapshot;
  currency: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Mini label="PO amount" value={formatMoney(snapshot.po_amount, currency)} />
      <Mini label="Consumed" value={formatMoney(snapshot.consumed, currency)} />
      <Mini
        label="Projected consumed"
        value={formatMoney(snapshot.projected_consumed, currency)}
      />
      <Mini
        label="Projected remaining"
        value={formatMoney(snapshot.projected_remaining, currency)}
      />
      <Mini
        label="Projected remaining %"
        value={
          snapshot.projected_remaining_percent != null
            ? formatPercent(snapshot.projected_remaining_percent)
            : "—"
        }
      />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function healthLabel(health: PoConsumptionSnapshot["health"]) {
  switch (health) {
    case "healthy":
      return "Healthy";
    case "near_limit":
      return "Near limit";
    case "exceeded":
      return "Exceeded";
    default:
      return "No PO";
  }
}
