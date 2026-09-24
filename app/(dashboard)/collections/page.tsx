import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CollectionsRedesign } from "@/features/collections/components/collections-redesign";
import { loadCollectionsRedesign } from "@/features/collections/load-redesign";
import "@/app/styles/collections-platform-shared.css";
import "@/app/styles/collections-fragment.css";

export const dynamic = "force-dynamic";

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  if ([tab].flat().some(value => value === "pay" || value === "payables")) notFound();
  const data = await loadCollectionsRedesign().catch(() => null);
  return <DashboardShell title="Collections" hidePageHeader hideDesktopHeader mainClassName="tw-main">
    <PlatformErrorBoundary surface="collections">
      {data ? <Suspense fallback={<p>Loading Collections…</p>}><CollectionsRedesign data={data} /></Suspense> : <div className="tw-note">Collections is unavailable. Sign in with Collections access, then reload this page.</div>}
    </PlatformErrorBoundary>
  </DashboardShell>;
}
