import Link from "next/link";
import {
  ArrowRightIcon,
  Building2Icon,
  LineChartIcon,
  MegaphoneIcon,
  UsersIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { HomeWelcomeBanner } from "@/features/home/components/home-welcome-banner";
import { getHomeDashboardSnapshot } from "@/features/home/queries";

export default async function DashboardPage() {
  let snapshot = null;
  let bannerError: string | null = null;

  try {
    snapshot = await getHomeDashboardSnapshot();
  } catch (error) {
    bannerError =
      error instanceof Error ? error.message : "Failed to load your dashboard summary.";
  }

  return (
    <DashboardShell
      title="Dashboard"
      description="Influencer marketing operations at a glance."
    >
      {snapshot ? (
        <HomeWelcomeBanner snapshot={snapshot} />
      ) : bannerError ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
          {bannerError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="size-4" />
              Executive dashboard
            </CardTitle>
            <CardDescription>
              CFO-grade KPIs, trends, profitability tables, and finance alerts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard">
                Open executive dashboard
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2Icon className="size-4" />
              Clients
            </CardTitle>
            <CardDescription>
              View and manage client accounts, statuses, and billing contacts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/clients">
                Open clients
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MegaphoneIcon className="size-4" />
              Campaigns
            </CardTitle>
            <CardDescription>
              Plan budgets, timelines, and platform strategy for client campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/campaigns">
                Open campaigns
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-4" />
              Vendors
            </CardTitle>
            <CardDescription>
              Manage creators, platforms, and pricing for campaign assignments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/vendors">
                Open vendors
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
