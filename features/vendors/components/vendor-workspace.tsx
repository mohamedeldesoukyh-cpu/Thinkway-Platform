"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";

import "@/app/styles/vendor-detail-suite.css";

import {
  CreatorIdentityCell,
  creatorProfileSourceFromAccounts,
} from "@/components/creator/creator-profile-link";
import { DocumentNumber } from "@/components/ui/document-number";
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
import { ClientProfilePlatformProvider } from "@/features/clients/components/client-form-ui";
import { VendorDependencyDialog } from "@/features/vendors/components/vendor-dependency-dialog";
import { VendorActivityTab } from "@/features/vendors/components/tabs/vendor-activity-tab";
import { VendorAssignmentsTab } from "@/features/vendors/components/tabs/vendor-assignments-tab";
import { VendorBillingTab } from "@/features/vendors/components/tabs/vendor-billing-tab";
import { VendorCommercialTab } from "@/features/vendors/components/tabs/vendor-commercial-tab";
import { VendorContractsTab } from "@/features/vendors/components/tabs/vendor-contracts-tab";
import { VendorDocumentsTab } from "@/features/vendors/components/tabs/vendor-documents-tab";
import { VendorOverviewTab } from "@/features/vendors/components/tabs/vendor-overview-tab";
import { VendorPlatformsTab } from "@/features/vendors/components/tabs/vendor-platforms-tab";
import { VendorQuotationsTab } from "@/features/vendors/components/tabs/vendor-quotations-tab";
import { VENDOR_STATUS_OPTIONS } from "@/features/vendors/constants";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, formatPercent } from "@/features/vendors/utils";
import { formatCreatorCountryLabels } from "@/lib/creators/creator-display-utils";
import type { CompletenessBreakdown } from "@/lib/creators/crm/completeness";
import { cn } from "@/lib/utils";
import type { InfluencerStatus } from "@/types/database";

type VendorWorkspaceViewProps = {
  workspace: VendorWorkspace;
  defaultTab?: string;
  portalAccessPanel?: React.ReactNode;
  creatorSocialPanel?: React.ReactNode;
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

function statusTone(status: InfluencerStatus): string {
  if (status === "active") return "";
  if (status === "blacklisted") return "r";
  return "";
}

function statusLabel(status: InfluencerStatus): string {
  return VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function dimTone(value: number): "r" | "y" | "g" {
  if (value >= 80) return "g";
  if (value >= 40) return "y";
  return "r";
}

function CompletenessPill({
  completeness,
}: {
  completeness: CompletenessBreakdown | null;
}) {
  const [open, setOpen] = useState(false);
  const overall = Math.round(completeness?.overall ?? 0);
  const missing = completeness?.missing ?? [];
  const dims = completeness?.dimensions;

  return (
    <span style={{ position: "relative" }}>
      <button
        type="button"
        className="tw-cpill"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <span className="tw-cpill__r" style={{ ["--cpill-pct" as string]: overall }} />
        {overall}% complete
        {missing.length > 0 ? ` · ${missing.length} missing` : ""}
      </button>
      {open ? (
        <span
          className="tw-cpop"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          role="dialog"
          aria-label="Profile completeness"
        >
          <h5>Profile completeness</h5>
          <p>
            Completeness is informational. Missing fields block invites and payouts where
            noted — they do not hide the creator from Discovery.
          </p>
          {dims ? (
            <div className="tw-cgrid">
              {(
                [
                  ["Overall", overall],
                  ["Identity", dims.identity],
                  ["Commercial", dims.commercial],
                  ["Legal", dims.legal],
                  ["Finance", dims.finance],
                  ["Client compliance", dims.client_compliance],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <i>{label}</i>
                  <b className={dimTone(value)}>{Math.round(value)}%</b>
                </div>
              ))}
            </div>
          ) : null}
          {missing.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {missing.slice(0, 10).map((item) => (
                <span key={item.code} className="tw-mchip">
                  {item.label.replace(/^Missing /i, "")}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0 }}>No missing fields on file.</p>
          )}
        </span>
      ) : null}
    </span>
  );
}

const tabPanelClassName =
  "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

export function VendorWorkspaceView({
  workspace,
  defaultTab = "overview",
  portalAccessPanel,
  creatorSocialPanel,
  currencyOptions = [],
}: VendorWorkspaceViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [depOpen, setDepOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

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

  const currency =
    (workspace.payment_details as { currency?: string } | null)?.currency ?? "EGP";
  const { counts, financials } = workspace;

  const kpiItems = useMemo(
    () =>
      [
        ["Assignments", String(counts.assignments), ""],
        ["Campaigns", String(counts.campaigns), ""],
        ["Deliverables", String(counts.deliverables), counts.deliverables === 0 ? "r" : ""],
        ["Platforms", String(counts.platforms), ""],
        ["Revenue", formatMoney(financials.total_revenue, currency), ""],
        ["GP", formatMoney(financials.total_gp, currency), ""],
        ["Margin", formatPercent(financials.margin_percent), "g"],
        [
          "Pending payout",
          formatMoney(financials.pending_payout, currency),
          financials.pending_payout > 0 ? "r" : "",
        ],
      ] as const,
    [counts, currency, financials]
  );

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview", count: "" },
        { id: "commercial" as const, label: "Commercial", count: "" },
        {
          id: "platforms" as const,
          label: "Platforms",
          count: String(counts.platforms),
        },
        {
          id: "assignments" as const,
          label: "Assignments",
          count: String(counts.assignments),
        },
        {
          id: "quotations" as const,
          label: "Quotations",
          count: String(workspace.quotation_history?.length ?? 0),
        },
        { id: "billing" as const, label: "Payments", count: financials.pending_payout > 0 ? "!" : "" },
        {
          id: "documents" as const,
          label: "Documents",
          count: String(workspace.documents.length),
        },
        { id: "contracts" as const, label: "Legal & contracts", count: "" },
        {
          id: "activity" as const,
          label: "Timeline",
          count: String(workspace.activity.length),
        },
      ] satisfies Array<{
        id: VendorWorkspaceTabId;
        label: string;
        count: string;
      }>,
    [
      counts.assignments,
      counts.platforms,
      financials.pending_payout,
      workspace.activity.length,
      workspace.documents.length,
      workspace.quotation_history?.length,
    ]
  );

  const saveFormId = TAB_FORM_IDS[activeTab];
  const metaParts = [
    countryLabel !== "—" ? countryLabel : null,
    counts.platforms ? `${counts.platforms} platforms` : null,
    counts.campaigns ? `${counts.campaigns} campaigns` : null,
  ].filter(Boolean);

  return (
    <ClientProfilePlatformProvider platformV6>
      <div className="vendor-detail-suite">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          <div className="tw-frozen">
            <div className="tw-mast">
              <div className="tw-mh">
                <Link href="/vendors" className="tw-hmk" aria-label="Back to vendors">
                  <i />
                  <u />
                </Link>
                <span className="tw-hwd">
                  THINK<em>WAY</em>
                </span>
                <span className="tw-hdv" />
                <span className="tw-vav tw-vav--photo" aria-hidden={false}>
                  <CreatorIdentityCell
                    source={creatorProfileSourceFromAccounts(
                      workspace.display_name,
                      workspace.platform_accounts,
                      { avatarUrl: workspace.primary_avatar_url }
                    )}
                    size="sm"
                    showName={false}
                    showHandle={false}
                    showPlatformBadge={false}
                    avatarBadge="none"
                    stopPropagation
                  />
                </span>
                <span className="id">
                  <DocumentNumber value={workspace.document_number} />
                </span>
                <h1>{workspace.display_name}</h1>
                <span className={cn("st", statusTone(workspace.status))}>
                  {statusLabel(workspace.status)}
                </span>
                {metaParts.length > 0 ? (
                  <span className="sub">{metaParts.join(" · ")}</span>
                ) : null}
                <span style={{ flex: 1 }} />
                <CompletenessPill completeness={workspace.crm_completeness} />
                <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="tw-b sm" aria-label="Actions">
                      <MoreHorizontalIcon className="size-3.5" aria-hidden />
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
                <button type="button" className="tw-b sm" onClick={handleCancel}>
                  Cancel
                </button>
                {saveFormId ? (
                  <button
                    type="submit"
                    form={saveFormId}
                    className="tw-b sm pri"
                  >
                    {TAB_SAVE_LABELS[activeTab]}
                  </button>
                ) : (
                  <button type="button" className="tw-b sm pri">
                    {TAB_SAVE_LABELS[activeTab]}
                  </button>
                )}
              </div>

              <div className="tw-ms2" aria-label="Creator metrics">
                {kpiItems.map(([label, value, tone]) => (
                  <div key={label}>
                    <i>{label}</i>
                    <b className={tone || undefined}>{value}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="tw-step2" role="tablist" aria-label="Creator profile tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className="tw-sb"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                >
                  <span className="tw-sb__d" />
                  <span className="tw-sb__l">
                    {tab.label}
                    {tab.count ? (
                      <em className={tab.count === "!" ? "r" : undefined}>
                        {tab.count === "!" ? "blocked" : tab.count}
                      </em>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="tw-main">
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
                <VendorPlatformsTab
                  vendor={workspace}
                  onCancel={handleCancel}
                  creatorSocialPanel={creatorSocialPanel}
                />
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
