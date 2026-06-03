import {
  MegaphoneIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { CampaignsKpis } from "@/features/campaigns/queries";
import { formatMoney } from "@/features/campaigns/utils";

type CampaignsKpiStripProps = {
  kpis: CampaignsKpis;
};

const ACCENTS = {
  blue: { tile: "bg-brand-blue/10 text-brand-blue", dot: "var(--brand-blue)" },
  purple: {
    tile: "bg-brand-purple/10 text-brand-purple",
    dot: "var(--brand-purple)",
  },
  pink: { tile: "bg-brand-pink/10 text-brand-pink", dot: "var(--brand-pink)" },
  green: { tile: "bg-success/10 text-success", dot: "var(--success)" },
} as const;

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof MegaphoneIcon;
  accent: keyof typeof ACCENTS;
}) {
  const tone = ACCENTS[accent];
  return (
    <Card className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-6 -right-6 size-20 rounded-full opacity-[0.07]"
        style={{ backgroundColor: tone.dot }}
      />
      <CardContent className="relative p-5">
        <div
          className={`mb-3 flex size-10 items-center justify-center rounded-2xl ${tone.tile}`}
        >
          <Icon className="size-5" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl font-extrabold tracking-tight">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function CampaignsKpiStrip({ kpis }: CampaignsKpiStripProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Campaigns"
        value={String(kpis.total_campaigns)}
        icon={MegaphoneIcon}
        accent="blue"
      />
      <KpiCard
        label="Total Revenue"
        value={formatMoney(kpis.total_revenue, kpis.currency_code)}
        icon={WalletIcon}
        accent="purple"
      />
      <KpiCard
        label="Avg Margin"
        value={`${kpis.avg_margin.toFixed(1)}%`}
        icon={TrendingUpIcon}
        accent="pink"
      />
      <KpiCard
        label="Assignments"
        value={String(kpis.assignments)}
        icon={UsersIcon}
        accent="green"
      />
    </div>
  );
}
