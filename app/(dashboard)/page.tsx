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
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getGreetingName(): Promise<string> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "there";

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const fullName = (profile as { full_name: string | null } | null)?.full_name;
    if (fullName?.trim()) return fullName.trim().split(/\s+/)[0];
    return user.email?.split("@")[0] ?? "there";
  } catch {
    return "there";
  }
}

export default async function DashboardPage() {
  const name = await getGreetingName();

  return (
    <DashboardShell
      title="Dashboard"
      description="Influencer marketing operations at a glance."
    >
      <div className="relative mb-4 overflow-hidden rounded-3xl bg-brand-navy p-7 md:p-8">
        <div
          aria-hidden
          className="bg-brand-gradient pointer-events-none absolute -top-12 -right-12 size-56 rounded-full opacity-20 blur-3xl"
        />
        <div className="relative">
          <h2 className="font-heading text-2xl font-extrabold text-white">
            Welcome back, {name} 👋
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Pick up where you left off across campaigns, vendors, and billing.
          </p>
        </div>
      </div>

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
