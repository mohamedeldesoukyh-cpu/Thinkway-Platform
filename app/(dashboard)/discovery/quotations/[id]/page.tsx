import { notFound } from "next/navigation";
import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Button } from "@/components/ui/button";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import { QUOTATIONS_LIST_PATH } from "@/features/quotations/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QuotationWorkspace } from "@/features/quotations/components/quotation-workspace";
import {
  getQuotationDetail,
  getQuotationFormOptions,
} from "@/features/quotations/queries";

async function getGroupOptionsForPromote() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("groups")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(200);
  return ((data ?? []) as Array<{ id: string; name: string }>) ?? [];
}

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuotationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [detail, formOptions, groupOptions] = await Promise.all([
    getQuotationDetail(id),
    getQuotationFormOptions(),
    getGroupOptionsForPromote(),
  ]);
  if (!detail) notFound();

  return (
    <DashboardShell
      title={detail.name}
      description={detail.serial_number ?? "Client quotation"}
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <DiscoverySubNav activeHref="/discovery/quotations" />
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="border-b border-border px-4 py-2 md:px-6">
              <Button asChild variant="ghost" size="sm" className="-ml-2">
                <Link href={QUOTATIONS_LIST_PATH}>← Back to client quotations</Link>
              </Button>
            </div>
            <QuotationWorkspace
              detail={detail}
              formOptions={formOptions}
              groupOptions={groupOptions}
            />
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
