import Link from "next/link";
import {
  ArrowRightIcon,
  BarChart3Icon,
  CoinsIcon,
  LineChartIcon,
  ReceiptIcon,
  WalletIcon,
} from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const reportLinks = [
  {
    href: "/dashboard",
    title: "Executive dashboard",
    description: "CFO-grade KPIs, profitability trends, and finance alerts.",
    icon: LineChartIcon,
    tint: "text-brand-blue",
  },
  {
    href: "/collections",
    title: "Collections",
    description: "Aging, receivables, and collection performance.",
    icon: CoinsIcon,
    tint: "text-brand-purple",
  },
  {
    href: "/treasury",
    title: "Treasury",
    description: "Cashflow position and liquidity forecasting.",
    icon: WalletIcon,
    tint: "text-brand-pink",
  },
  {
    href: "/planning",
    title: "Planning",
    description: "Budgets, forecasts, and variance analysis.",
    icon: BarChart3Icon,
    tint: "text-success",
  },
  {
    href: "/finance/po-tracker",
    title: "PO tracker",
    description: "Purchase-order consumption and remaining budget.",
    icon: ReceiptIcon,
    tint: "text-brand-blue",
  },
  {
    href: "/billing",
    title: "Billing",
    description: "Invoice lifecycle, queue, and operational billing.",
    icon: ReceiptIcon,
    tint: "text-brand-purple",
  },
] as const;

export default function ReportsPage() {
  return (
    <DashboardShell
      title="Performance Reports"
      description="Analytics across campaigns, vendors, finance, and channels."
    >
      <PlatformErrorBoundary surface="analytics">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportLinks.map((report) => {
            const Icon = report.icon;
            return (
              <Card key={report.href} className="justify-between">
                <CardHeader>
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
                    <Icon className={`size-5 ${report.tint}`} />
                  </div>
                  <CardTitle className="mt-3">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" size="sm">
                    <Link href={report.href}>
                      Open report
                      <ArrowRightIcon data-icon="inline-end" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
