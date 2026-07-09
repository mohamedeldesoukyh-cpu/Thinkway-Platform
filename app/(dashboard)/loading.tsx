import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLoading() {
  return (
    <DashboardShell
      title="Dashboard"
      description="Influencer marketing operations at a glance."
      platformV6
      hidePageHeader
      immersiveLayout
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0 md:p-0"
    >
      <div className="flex flex-1 flex-col gap-5 p-5 md:p-6">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-[10px] bg-muted" />
          ))}
        </div>
        <div className="grid flex-1 gap-4 lg:grid-cols-2">
          <div className="min-h-[240px] animate-pulse rounded-[10px] bg-muted" />
          <div className="min-h-[240px] animate-pulse rounded-[10px] bg-muted" />
        </div>
      </div>
    </DashboardShell>
  );
}
