"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBackButton } from "@/components/navigation/page-back-button";
import {
  CreatorIdentityCell,
  creatorProfileSourceFromAccounts,
} from "@/components/creator/creator-profile-link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";

import {
  PlatformV6EntityBreadcrumb,
  platformV6BadgeClass,
} from "@/components/platform/platform-v6-layout";
import { ClientProfilePlatformProvider } from "@/features/clients/components/client-form-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs } from "@/components/ui/tabs";
import {
  OperationalWorkspaceTabContent,
  OperationalWorkspaceTabPanel,
} from "@/components/workspace/operational-workspace-ui";
import { VENDOR_STATUS_OPTIONS } from "@/features/vendors/constants";
import { VendorDependencyDialog } from "@/features/vendors/components/vendor-dependency-dialog";
import { VendorKpiStrip } from "@/features/vendors/components/vendor-kpi-strip";
import { CrmCompletenessStrip } from "@/features/vendors/components/crm-completeness-strip";
import { VendorActivityTab } from "@/features/vendors/components/tabs/vendor-activity-tab";
import { VendorAssignmentsTab } from "@/features/vendors/components/tabs/vendor-assignments-tab";
import { VendorBillingTab } from "@/features/vendors/components/tabs/vendor-billing-tab";
import { VendorCommercialTab } from "@/features/vendors/components/tabs/vendor-commercial-tab";
import { VendorContractsTab } from "@/features/vendors/components/tabs/vendor-contracts-tab";
import { VendorDocumentsTab } from "@/features/vendors/components/tabs/vendor-documents-tab";
import { VendorOverviewTab } from "@/features/vendors/components/tabs/vendor-overview-tab";
import { VendorPlatformsTab } from "@/features/vendors/components/tabs/vendor-platforms-tab";
import { VendorQuotationsTab } from "@/features/vendors/components/tabs/vendor-quotations-tab";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatCreatorCountryLabels } from "@/lib/creators/creator-display-utils";
import type { VendorWorkspace } from "@/features/vendors/types";
import type { InfluencerStatus } from "@/types/database";
import { cn } from "@/lib/utils";

type VendorWorkspaceViewProps = {
  workspace: VendorWorkspace;
  defaultTab?: string;
  portalAccessPanel?: React.ReactNode;
  currencyOptions?: { value: string; label: string }[];
};

const VENDOR_WORKSPACE_TAB_IDS = [
  "overview",
  "commercial",
  "platforms",
  "assignments",
  "quotations",
  "billing",
  "documents",
  "contracts",
  "activity",
] as const;

type VendorWorkspaceTabId = (typeof VENDOR_WORKSPACE_TAB_IDS)[number];

function isVendorWorkspaceTabId(value: string): value is VendorWorkspaceTabId {
  return (VENDOR_WORKSPACE_TAB_IDS as readonly string[]).includes(value);
}

const TAB_SAVE_LABELS: Record<VendorWorkspaceTabId, string> = {
  overview: "Save overview",
  commercial: "Save commercial",
  platforms: "Save platforms",
  assignments: "Save",
  quotations: "Save",
  billing: "Save billing",
  documents: "Save",
  contracts: "Save legal",
  activity: "Save",
};

const TAB_FORM_IDS: Partial<Record<VendorWorkspaceTabId, string>> = {
  overview: "vendor-overview-form",
  commercial: "vendor-commercial-form",
  platforms: "platform-accounts-form",
  billing: "vendor-bank-details-form",
  contracts: "vendor-legal-form",
};

function resolveEntityStatusBadge(status: InfluencerStatus): {
  label: string;
  className: string;
} {
  const label =
    VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;

  if (status === "active") {
    return { label, className: platformV6BadgeClass("outline-green") };
  }
  if (status === "blacklisted") {
    return { label, className: platformV6BadgeClass("red") };
  }
  if (status === "prospect") {
    return { label, className: platformV6BadgeClass("blue") };
  }
  return { label, className: platformV6BadgeClass("gray") };
}

const tabPanelClassName =
  "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

export function VendorWorkspaceView({
  workspace,
  defaultTab = "overview",
  portalAccessPanel,
  currencyOptions = [],
}: VendorWorkspaceViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [depOpen, setDepOpen] = useState(false);
  const countryLabel = useMemo(() => {
    return formatCreatorCountryLabels({
      country_code: workspace.country_code,
      country_codes: workspace.country_codes,
      estimated_country: null,
      platforms: (workspace.platform_accounts ?? []).map((account) => ({
        id: account.id,
        platform: account.platform,
        handle: account.handle,
        profile_url: account.profile_url ?? null,
        follower_count: account.follower_count,
        engagement_rate: account.engagement_rate,
        audience_country: account.audience_country ?? null,
      })),
    });
  }, [workspace.country_code, workspace.country_codes, workspace.platform_accounts]);
  const initialTab = isVendorWorkspaceTabId(defaultTab) ? defaultTab : "overview";
  const [activeTab, setActiveTab] = useState<VendorWorkspaceTabId>(initialTab);

  useEffect(() => {
    setActiveTab(isVendorWorkspaceTabId(defaultTab) ? defaultTab : "overview");
  }, [defaultTab]);

  const handleCancel = useCallback(() => {
    router.push("/vendors");
  }, [router]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isVendorWorkspaceTabId(value)) {
        return;
      }
      setActiveTab(value);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const tabCounts = useMemo(
    () => ({
      platforms: workspace.counts.platforms,
      assignments: workspace.counts.assignments,
      documents: workspace.documents.length,
      activity: workspace.activity.length,
    }),
    [
      workspace.counts.platforms,
      workspace.counts.assignments,
      workspace.documents.length,
      workspace.activity.length,
    ]
  );

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview" },
        { id: "commercial" as const, label: "Commercial" },
        { id: "platforms" as const, label: "Platforms", count: tabCounts.platforms },
        {
          id: "assignments" as const,
          label: "Campaigns",
          count: tabCounts.assignments,
        },
        {
          id: "quotations" as const,
          label: "Quotations",
          count: workspace.quotation_history?.length ?? 0,
        },
        { id: "billing" as const, label: "Payments" },
        { id: "documents" as const, label: "Documents", count: tabCounts.documents },
        { id: "contracts" as const, label: "Legal & Contracts" },
        {
          id: "activity" as const,
          label: "Timeline",
          count: tabCounts.activity,
        },
      ] satisfies Array<{
        id: VendorWorkspaceTabId;
        label: string;
        count?: number;
      }>,
    [tabCounts, workspace.quotation_history?.length]
  );

  const entityBadge = resolveEntityStatusBadge(workspace.status);
  const saveFormId = TAB_FORM_IDS[activeTab];

  return (
    <ClientProfilePlatformProvider platformV6>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          <div className="platform-v6-entity-nav-bar shrink-0">
            <div className="flex items-start justify-between gap-3 px-5 pb-2.5 pt-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <PageBackButton fallbackHref="/vendors" label="Back to vendors" />
                <CreatorIdentityCell
                  source={creatorProfileSourceFromAccounts(
                    workspace.display_name,
                    workspace.platform_accounts
                  )}
                  size="md"
                  showHandle={false}
                  stopPropagation
                />
                <span className={entityBadge.className}>{entityBadge.label}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="platform-v6-btn platform-v6-btn-sm shrink-0"
                  >
                    <MoreHorizontalIcon className="size-3.5" aria-hidden />
                    Actions
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDepOpen(true)}>
                    View dependencies
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/operations/move?vendor=${workspace.id}`}>
                      Reassign via Move
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="px-5 pb-2.5 text-[11px] text-muted-foreground">
              <DocumentNumber value={workspace.document_number} />
              {countryLabel !== "—" ? ` · ${countryLabel}` : null}
            </p>

            <div className="space-y-2 border-b border-border px-5 pb-2.5">
              <VendorKpiStrip workspace={workspace} />
              <CrmCompletenessStrip
                profile={workspace.crm_profile}
                completeness={workspace.crm_completeness}
              />
            </div>

            <div className="flex items-center px-5">
              <span className="platform-v6-also-view">Also view</span>
              <div className="platform-v6-entity-tabs-row flex-1" role="tablist">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleTabChange(tab.id)}
                      className={cn("platform-v6-etab", isActive && "active")}
                    >
                      {tab.label}
                      {tab.count != null ? ` (${tab.count})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <PlatformV6EntityBreadcrumb
            crumbs={[
              { label: "Vendors", href: "/vendors" },
              { label: workspace.display_name },
            ]}
            actions={
              <>
                <button
                  type="button"
                  className="platform-v6-btn platform-v6-btn-sm"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                {saveFormId ? (
                  <button
                    type="submit"
                    form={saveFormId}
                    className="platform-v6-btn platform-v6-btn-primary platform-v6-btn-sm"
                  >
                    {TAB_SAVE_LABELS[activeTab]}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="platform-v6-btn platform-v6-btn-primary platform-v6-btn-sm"
                  >
                    {TAB_SAVE_LABELS[activeTab]}
                  </button>
                )}
              </>
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <OperationalWorkspaceTabContent value="overview" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorOverviewTab
                  vendor={workspace}
                  portalAccessPanel={portalAccessPanel}
                  onCancel={handleCancel}
                  shortcutsEnabled={activeTab === "overview"}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="commercial" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorCommercialTab workspace={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="platforms" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorPlatformsTab vendor={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="assignments" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorAssignmentsTab workspace={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="quotations" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorQuotationsTab workspace={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="billing" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {activeTab === "billing" ? (
                  <VendorBillingTab
                    workspace={workspace}
                    currencyOptions={currencyOptions}
                    onCancel={handleCancel}
                  />
                ) : null}
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="documents" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorDocumentsTab vendor={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="contracts" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorContractsTab
                  vendor={workspace}
                  onCancel={handleCancel}
                  shortcutsEnabled={activeTab === "contracts"}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="activity" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorActivityTab workspace={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
          </div>
        </Tabs>

        <VendorDependencyDialog
          vendorId={workspace.id}
          vendorName={workspace.display_name}
          open={depOpen}
          onOpenChange={setDepOpen}
          onArchive={
            workspace.counts.assignments === 0 ? () => setDepOpen(false) : undefined
          }
        />
      </div>
    </ClientProfilePlatformProvider>
  );
}
