import { formatMoneyCompact } from "@/features/campaigns/utils";
import type { HomeDashboardSnapshot } from "@/features/home/queries";
import { cn } from "@/lib/utils";

type HomeWelcomeBannerProps = {
  snapshot: HomeDashboardSnapshot;
};

type BannerKpi = {
  id: string;
  label: string;
  value: string;
  valueClassName?: string;
};

export function HomeWelcomeBanner({ snapshot }: HomeWelcomeBannerProps) {
  const kpis: BannerKpi[] = [
    {
      id: "active_campaigns",
      label: "Active Campaigns",
      value: String(snapshot.active_campaigns),
    },
    {
      id: "revenue",
      label: "Total Revenue",
      value: formatMoneyCompact(snapshot.total_revenue, snapshot.currency_code),
      valueClassName: "text-primary",
    },
    {
      id: "gp",
      label: "Gross Profit",
      value: formatMoneyCompact(snapshot.gross_profit, snapshot.currency_code),
      valueClassName:
        snapshot.gross_profit < 0 ? "text-destructive" : "text-brand-product",
    },
    {
      id: "vendors",
      label: "Active Vendors",
      value: String(snapshot.active_vendors),
    },
  ];

  return (
    <div className="relative mb-4 overflow-hidden rounded-3xl bg-brand-navy p-7 md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 size-56 rounded-full bg-brand-gradient opacity-20 blur-3xl"
      />
      <div className="relative space-y-6">
        <div>
          <h2 className="font-heading text-2xl font-extrabold text-white">
            Welcome back, {snapshot.greetingName} 👋
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Here&apos;s what&apos;s happening across your influencer campaigns today.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-10 gap-y-4 sm:gap-x-14">
          {kpis.map((kpi) => (
            <div key={kpi.id} className="min-w-[120px]">
              <p className="text-[11px] font-medium text-white/50">{kpi.label}</p>
              <p
                className={cn(
                  "mt-0.5 font-heading text-xl font-bold tracking-tight tabular-nums text-white",
                  kpi.valueClassName
                )}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
