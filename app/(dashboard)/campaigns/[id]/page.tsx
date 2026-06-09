import { notFound } from "next/navigation";

import { PageBackButton } from "@/components/navigation/page-back-button";
import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignWorkspaceView } from "@/features/campaigns/components/campaign-workspace";
import {
  getCampaignFormOptions,
  getCampaignWorkspace,
} from "@/features/campaigns/queries";
import { getCampaignBillingGroups, getCampaignBillingLines, getCampaignOperationalBillingDetail } from "@/features/billing/queries";
import { getFinanceInvoiceRegister } from "@/features/finance/invoices/queries";
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";
import { toPlainAssignmentHierarchy } from "@/lib/campaigns/serialize-assignment-hierarchy";
import { getCampaignPublications } from "@/features/campaigns/queries/publications";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { EMPTY_CAMPAIGN_FORM_OPTIONS } from "@/features/campaigns/campaign-page-fallbacks";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { devLog } from "@/lib/dev-log";
import { loadFinanceAuditTimeline } from "@/lib/finance/queries/finance-audit";
import { isBillingRepairOnLoadEnabled } from "@/lib/billing/billing-repair-on-load";
import {
  repairActiveInvoiceOperationalRelock,
  repairLinesBillingWithoutVendorIo,
  repairNonIoInvoiceLineItemsForCampaign,
  repairAppendMissingInvoiceLineItems,
  repairDesyncedUngeneratedInvoiceHeaders,
  repairIncorrectlyFinanceLockedDraftInvoices,
  repairOrphanedInvoicedOperationalRows,
  repairStalePendingRegenerationInvoices,
} from "@/lib/billing/repair-orphaned-invoice-state";
import { repairVendorIoAmountDrift } from "@/lib/io/repair-vendor-io-amount-drift";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

type CampaignWorkspacePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CampaignWorkspacePage({
  params,
}: CampaignWorkspacePageProps) {
  const { id } = await params;

  if (!isUuid(id)) {
    return (
      <DashboardShell
        title="Campaign workspace"
        description="Operational command center for lines, vendors, deliverables, billing, and workflow."
      >
        <div className="space-y-4 rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm">
          <p className="font-medium text-destructive">Invalid campaign link</p>
          <p className="text-muted-foreground">
            The URL does not contain a valid campaign ID. Open a campaign from the{" "}
            <strong>Campaigns</strong> list instead of using a bookmark or preview link.
          </p>
          <PageBackButton
            fallbackHref="/campaigns"
            label="Back to campaigns"
            variant="text"
          />
        </div>
      </DashboardShell>
    );
  }

  let workspace;
  let formOptions: Awaited<ReturnType<typeof getCampaignFormOptions>> | null =
    null;
  let billingLines: Awaited<ReturnType<typeof getCampaignBillingLines>> = [];
  let billingGroups: Awaited<ReturnType<typeof getCampaignBillingGroups>> = [];
  let operationalBilling: Awaited<ReturnType<typeof getCampaignOperationalBillingDetail>> = null;
  let assignmentHierarchy: Awaited<ReturnType<typeof getCampaignAssignmentHierarchy>> = {
    groups: [],
    currency_code: "USD",
    load_error: null,
  };
  let publications: Awaited<ReturnType<typeof getCampaignPublications>>["publications"] =
    [];
  let publicationsLoadError: string | null = null;
  let campaignInvoiceRegister: Awaited<ReturnType<typeof getFinanceInvoiceRegister>> = [];
  let financeAudit: Awaited<ReturnType<typeof loadFinanceAuditTimeline>> = [];
  let errorMessage: string | null = null;

  try {
    workspace = await getCampaignWorkspace(id);
  } catch (error) {
    const { logCampaignWorkspaceLoadError } = await import(
      "@/lib/billing/operational-billing-trace"
    );
    logCampaignWorkspaceLoadError("getCampaignWorkspace", error, { campaignId: id });
    errorMessage =
      error instanceof Error ? error.message : "Failed to load campaign workspace.";
  }

  if (!workspace && !errorMessage) {
    notFound();
  }

  if (workspace) {
    const supabase = await createSupabaseServerClient();

    if (isBillingRepairOnLoadEnabled()) {
      try {
        const {
          data: { user: repairUser },
        } = await supabase.auth.getUser();
        await repairNonIoInvoiceLineItemsForCampaign(supabase, id);
        await repairLinesBillingWithoutVendorIo(supabase, id);
        await repairOrphanedInvoicedOperationalRows(supabase, id);
        await repairDesyncedUngeneratedInvoiceHeaders(supabase, id);
        await repairStalePendingRegenerationInvoices(supabase, id);
        await repairIncorrectlyFinanceLockedDraftInvoices(supabase, id);
        await repairActiveInvoiceOperationalRelock(supabase, id);
        await repairAppendMissingInvoiceLineItems(supabase, id);
        await repairVendorIoAmountDrift(supabase, id, repairUser?.id ?? null);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          devLog("[campaign-page] orphaned invoice repair skipped", error);
        }
      }
    }

    const settled = await Promise.allSettled([
      getCampaignFormOptions(),
      getCampaignBillingLines(id),
      getCampaignBillingGroups(id),
      getFinanceInvoiceRegister({ campaignHeaderId: id }),
      getCampaignOperationalBillingDetail(id),
      getCampaignAssignmentHierarchy(id, workspace),
      loadFinanceAuditTimeline(supabase, { campaign_id: id, limit: 40 }),
      getCampaignPublications(id),
    ]);

    if (settled[0].status === "fulfilled") {
      formOptions = settled[0].value;
    } else {
      formOptions = EMPTY_CAMPAIGN_FORM_OPTIONS;
      if (process.env.NODE_ENV === "development") {
        devLog("[dashboard-resilience] campaign form options fallback", settled[0].reason);
      }
    }

    if (settled[1].status === "fulfilled") {
      billingLines = settled[1].value;
    } else if (process.env.NODE_ENV === "development") {
      devLog("[dashboard-resilience] campaign billing lines fallback", settled[1].reason);
    }

    if (settled[2].status === "fulfilled") {
      billingGroups = settled[2].value;
    }

    if (settled[3].status === "fulfilled") {
      campaignInvoiceRegister = settled[3].value;
    } else if (process.env.NODE_ENV === "development") {
      devLog("[campaign-page] campaign invoice register fallback", settled[3].reason);
    }

    if (settled[4].status === "fulfilled") {
      operationalBilling = settled[4].value;
    } else {
      const { logCampaignWorkspaceLoadError } = await import(
        "@/lib/billing/operational-billing-trace"
      );
      logCampaignWorkspaceLoadError(
        "getCampaignOperationalBillingDetail",
        settled[4].reason,
        { campaignId: id }
      );
    }

    if (settled[5].status === "fulfilled") {
      assignmentHierarchy = toPlainAssignmentHierarchy(settled[5].value);
      logAssignmentsStage("page query success", {
        campaignId: id,
        groupCount: assignmentHierarchy.groups.length,
        skipped: assignmentHierarchy.skipped_line_ids?.length ?? 0,
        loadError: assignmentHierarchy.load_error ?? null,
      });
    } else {
      const message =
        settled[5].reason instanceof Error
          ? settled[5].reason.message
          : "Failed to load assignment hierarchy.";
      console.error("[Assignments] page hierarchy query failed", { campaignId: id, message });
      assignmentHierarchy = {
        groups: [],
        currency_code: workspace.currency_code,
        load_error: message,
        skipped_line_ids: [],
        sanitize_warnings: [],
      };
    }

    if (settled[6].status === "fulfilled") {
      financeAudit = settled[6].value;
    } else {
      devLog("[campaign-page] finance audit failed", {
        campaignId: id,
        error: settled[6].reason,
      });
    }

    if (settled[7].status === "fulfilled") {
      publications = settled[7].value.publications;
      publicationsLoadError = settled[7].value.load_error;
    } else {
      publicationsLoadError =
        settled[7].reason instanceof Error
          ? settled[7].reason.message
          : "Failed to load publications.";
      console.error("[campaign-page] publications failed", {
        campaignId: id,
        publicationsLoadError,
      });
    }
  }

  if (!workspace && !errorMessage) {
    notFound();
  }

  const teams = formOptions?.masterData?.teams ?? [];
  const currencyOptions = buildCurrencyOptions(formOptions?.masterData?.currencies ?? []);

  return (
    <DashboardShell
      title="Campaign workspace"
      hidePageHeader
      containedMain
      mainClassName="min-h-0 flex-1 flex-col p-3 md:px-6 md:py-4"
    >
      {errorMessage ? (
        <PageAlert>{errorMessage}</PageAlert>
      ) : workspace ? (
        <PlatformErrorBoundary surface="campaigns">
          <div className="flex min-h-0 flex-1 flex-col">
            <CampaignWorkspaceView
              workspace={workspace}
              accountManagers={
                (formOptions ?? EMPTY_CAMPAIGN_FORM_OPTIONS).accountManagers
              }
              teams={teams}
              billingLines={billingLines}
              billingGroups={billingGroups}
              operationalBilling={operationalBilling}
              campaignInvoiceRegister={campaignInvoiceRegister}
              assignmentHierarchy={assignmentHierarchy}
              publications={publications}
              publicationsLoadError={publicationsLoadError}
              currencyOptions={currencyOptions}
              financeAudit={financeAudit}
            />
          </div>
        </PlatformErrorBoundary>
      ) : null}
    </DashboardShell>
  );
}
