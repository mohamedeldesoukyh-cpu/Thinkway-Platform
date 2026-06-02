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

export default function DashboardPage() {
  return (
    <DashboardShell
      title="Dashboard"
      description="Influencer marketing operations at a glance."
    >
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
