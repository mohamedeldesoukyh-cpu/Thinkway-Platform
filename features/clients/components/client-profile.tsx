"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";

import "@/app/styles/client-detail-suite.css";

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
import type {
  AssignableClientProfileRow,
  ClientAccessEntityRow,
} from "@/features/client-access/types";
import type { ClientIoRow, ClientIoSendRecipient } from "@/features/io/types";
import type { ClientDetail } from "@/types/database";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import {
  computeOnboardingProgress,
  deriveOnboardingStatusFromCompletion,
  formatOnboardingProgressDetail,
  isClientOnboardingStatus,
  ONBOARDING_STATUS_LABELS,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";
import { computeClientProfileTabMissingCounts } from "@/lib/clients/client-profile-readiness";
import {
  CLIENT_PROFILE_TAB_ORDER,
  isClientProfileTabId,
  type ClientProfileTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { cn } from "@/lib/utils";

import { ClientProfileTabShell, ClientProfilePlatformProvider } from "./client-form-ui";
import { ClientAccessTab } from "./tabs/client-access-tab";
import { ClientBrandsTab } from "./tabs/client-brands-tab";
import { ClientCampaignsTab } from "./tabs/client-campaigns-tab";
import { ClientClientIosTab, CLIENT_IO_SAVE_FORM_ID } from "./tabs/client-client-ios-tab";
import { ClientFinanceTab } from "./tabs/client-finance-tab";
import { ClientLegalTab } from "./tabs/client-legal-tab";
import { ClientOverviewTab } from "./tabs/client-overview-tab";
import { OnboardingWorkspace } from "./onboarding-workspace";
import type { ClientOverviewSavePatch } from "@/features/clients/actions";

type ClientProfileProps = {
  client: ClientDetail;
  groups: { id: string; name: string; document_number: string }[];
  masterData: MasterDataOptions;
  clientIos: ClientIoRow[];
  clientIoRecipients: ClientIoSendRecipient[];
  clientAccessEntity: ClientAccessEntityRow | null;
  assignableClientProfiles: AssignableClientProfileRow[];
  onboardingTimeline?: import("@/features/clients/onboarding-queries").ClientOnboardingTimelineEvent[];
  canEditOnboardingChecklist?: boolean;
  canOverrideOnboardingStatus?: boolean;
  defaultTab?: string;
};

const TAB_SAVE_LABELS: Record<ClientProfileTabId, string> = {
  overview: "Save changes",
  brands: "Save",
  legal: "Save legal",
  finance: "Save finance",
  "client-ios": "Save draft",
  campaigns: "Save",
  access: "Save",
};

const TAB_FORM_IDS: Partial<Record<ClientProfileTabId, string>> = {
  overview: "client-overview-form",
  legal: "client-legal-form",
  finance: "client-finance-form",
  "client-ios": CLIENT_IO_SAVE_FORM_ID,
};

const TAB_LABELS: Record<ClientProfileTabId, string> = {
  overview: "Overview",
  brands: "Brands",
  legal: "Legal",
  finance: "Finance",
  "client-ios": "Client IO",
  campaigns: "Campaign history",
  access: "Client access",
};

function resolveEntityStatusLabel(client: ClientDetail): string {
  if (isClientOnboardingStatus(client.onboarding_status)) {
    const storedStatus = client.onboarding_status as ClientOnboardingStatus;
    const status = deriveOnboardingStatusFromCompletion(
      {
        legal_completed_at: client.legal_completed_at,
        finance_completed_at: client.finance_completed_at,
        contracts_completed_at: client.contracts_completed_at,
        tax_completed_at: client.tax_completed_at,
        credit_limit_active: client.credit_limit_active ?? false,
      },
      storedStatus
    );
    return ONBOARDING_STATUS_LABELS[status];
  }

  return (
    CLIENT_STATUS_OPTIONS.find((option) => option.value === client.status)?.label ??
    client.status
  );
}

function statusTone(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("ready") || lower === "active") return "";
  if (lower.includes("pending") || lower === "prospect" || lower === "draft") return "r";
  return "";
}

const tabPanelClassName =
  "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

export function ClientProfile({
  client,
  groups,
  masterData,
  clientIos,
  clientIoRecipients,
  clientAccessEntity,
  assignableClientProfiles,
  onboardingTimeline = [],
  canEditOnboardingChecklist = false,
  canOverrideOnboardingStatus = false,
  defaultTab = "overview",
}: ClientProfileProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [clientRecord, setClientRecord] = useState(client);
  const currencyOptions = buildCurrencyOptions(masterData.currencies);

  const initialTab = isClientProfileTabId(defaultTab) ? defaultTab : "overview";
  const [activeTab, setActiveTab] = useState<ClientProfileTabId>(initialTab);

  useEffect(() => {
    setClientRecord(client);
  }, [client]);

  useEffect(() => {
    setActiveTab(isClientProfileTabId(defaultTab) ? defaultTab : "overview");
  }, [defaultTab]);

  const applyClientPatch = useCallback((patch: ClientOverviewSavePatch) => {
    setClientRecord((current) => ({
      ...current,
      group_id: patch.group_id,
      group: patch.group,
      updated_at: patch.updated_at,
    }));
  }, []);
  const applyLogoUrl = useCallback((logoUrl: string | null) => {
    setClientRecord((current) => ({ ...current, logo_url: logoUrl }));
  }, []);

  const handleCancel = useCallback(() => {
    router.push("/clients");
  }, [router]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isClientProfileTabId(value)) {
        return;
      }
      setActiveTab(value);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const statusLabel = resolveEntityStatusLabel(clientRecord);
  const tabMissingCounts = useMemo(
    () => computeClientProfileTabMissingCounts(clientRecord),
    [clientRecord]
  );

  const onboardingInput = useMemo(
    () => ({
      legal_completed_at: clientRecord.legal_completed_at,
      finance_completed_at: clientRecord.finance_completed_at,
      contracts_completed_at: clientRecord.contracts_completed_at,
      tax_completed_at: clientRecord.tax_completed_at,
      credit_limit_active: clientRecord.credit_limit_active ?? false,
    }),
    [clientRecord]
  );
  const onboardingProgress = useMemo(
    () => computeOnboardingProgress(onboardingInput),
    [onboardingInput]
  );
  const onboardingDetail = formatOnboardingProgressDetail(
    onboardingProgress,
    onboardingInput
  );

  const acceptedIoCount = useMemo(
    () =>
      clientIos.filter((row) => {
        const status = String(row.status ?? "").toLowerCase();
        return status === "approved";
      }).length,
    [clientIos]
  );

  const brandsWithVr = useMemo(
    () =>
      clientRecord.brands.filter(
        (brand) => brand.vr_rate_percent != null && Number.isFinite(brand.vr_rate_percent)
      ).length,
    [clientRecord.brands]
  );

  const portalUserCount = clientAccessEntity?.users.length ?? 0;

  const kpiItems = useMemo(
    () =>
      [
        ["Brands", String(clientRecord.brands.length), ""],
        ["Campaigns", String(clientRecord.campaigns.length), ""],
        ["Client IOs", String(clientIos.length), clientIos.length > 0 ? "g" : ""],
        ["Accepted", String(acceptedIoCount), acceptedIoCount > 0 ? "g" : ""],
        ["Currency", clientRecord.currency || "—", ""],
        ["Terms", clientRecord.payment_terms ? String(clientRecord.payment_terms) : "—", ""],
        [
          "Credit limit",
          clientRecord.credit_limit != null
            ? String(clientRecord.credit_limit)
            : "none",
          clientRecord.credit_limit == null ? "r" : "",
        ],
        [
          "Portal users",
          String(portalUserCount),
          portalUserCount === 0 ? "r" : "",
        ],
        [
          "VR% set",
          `${brandsWithVr} of ${clientRecord.brands.length}`,
          brandsWithVr < clientRecord.brands.length ? "r" : "",
        ],
        [
          "Onboarding",
          `${onboardingProgress.percentage}%`,
          onboardingProgress.percentage < 100 ? "r" : "g",
        ],
      ] as const,
    [
      acceptedIoCount,
      brandsWithVr,
      clientIos.length,
      clientRecord.brands.length,
      clientRecord.campaigns.length,
      clientRecord.credit_limit,
      clientRecord.currency,
      clientRecord.payment_terms,
      onboardingProgress.percentage,
      portalUserCount,
    ]
  );

  const tabs = useMemo(
    () =>
      CLIENT_PROFILE_TAB_ORDER.map((id) => {
        const missing = tabMissingCounts[id] ?? 0;
        let count = "";
        if (id === "brands") count = String(clientRecord.brands.length);
        else if (id === "client-ios") count = String(clientIos.length);
        else if (id === "campaigns") count = String(clientRecord.campaigns.length);
        else if (id === "access") count = String(portalUserCount);
        else if (id === "legal" && missing > 0) count = "!";
        else if (missing > 0) count = String(missing);
        return { id, label: TAB_LABELS[id], count };
      }),
    [
      clientIos.length,
      clientRecord.brands.length,
      clientRecord.campaigns.length,
      portalUserCount,
      tabMissingCounts,
    ]
  );

  const metaParts = [
    clientRecord.city,
    clientRecord.country,
    clientRecord.agency_or_direct,
    clientRecord.group?.name ?? "no holding group",
  ].filter(Boolean);

  const saveFormId = TAB_FORM_IDS[activeTab];

  return (
    <ClientProfilePlatformProvider platformV6>
      <div className="client-detail-suite">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          <div className="tw-frozen">
            <div className="tw-mast">
              <div className="tw-mh">
                <Link href="/clients" className="tw-hmk" aria-label="Back to clients">
                  <i />
                  <u />
                </Link>
                <span className="tw-hwd">
                  THINK<em>WAY</em>
                </span>
                <span className="tw-hdv" />
                <span className="id">
                  <DocumentNumber value={clientRecord.document_number} />
                </span>
                <h1>{clientRecord.name}</h1>
                <span className={cn("st", statusTone(statusLabel))}>{statusLabel}</span>
                {metaParts.length > 0 ? (
                  <span className="sub">{metaParts.join(" · ")}</span>
                ) : null}
                <span style={{ flex: 1 }} />
                {onboardingProgress.percentage < 100 ? (
                  <button
                    type="button"
                    className="st r"
                    style={{ cursor: "pointer" }}
                    onClick={() => handleTabChange("legal")}
                  >
                    {onboardingDetail}
                  </button>
                ) : null}
                <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="tw-b sm" aria-label="Actions">
                      <MoreHorizontalIcon className="size-3.5" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleTabChange("client-ios")}>
                      Open IO register
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTabChange("brands")}>
                      Add brand
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/clients">Back to clients</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button type="button" className="tw-b sm" onClick={handleCancel}>
                  Cancel
                </button>
                {saveFormId ? (
                  <button type="submit" form={saveFormId} className="tw-b sm pri">
                    {TAB_SAVE_LABELS[activeTab]}
                  </button>
                ) : (
                  <button type="button" className="tw-b sm pri">
                    {TAB_SAVE_LABELS[activeTab]}
                  </button>
                )}
              </div>

              <div className="tw-ms2" aria-label="Legal entity metrics">
                {kpiItems.map(([label, value, tone]) => (
                  <div key={label}>
                    <i>{label}</i>
                    <b className={tone || undefined}>{value}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="tw-step2" role="tablist" aria-label="Legal entity tabs">
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
                      <em className={tab.count === "!" || tab.count === "0" ? "r" : undefined}>
                        {tab.count === "!" ? "action" : tab.count}
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
                <ClientOverviewTab
                  client={clientRecord}
                  groups={groups}
                  masterData={masterData}
                  onCancel={handleCancel}
                  shortcutsEnabled={activeTab === "overview"}
                  onClientPatch={applyClientPatch}
                  onLogoUrlChange={applyLogoUrl}
                  onboardingSlot={
                    <OnboardingWorkspace
                      clientId={clientRecord.id}
                      status={clientRecord.onboarding_status}
                      creditLimitActive={clientRecord.credit_limit_active ?? false}
                      completion={{
                        legal_completed_at: clientRecord.legal_completed_at,
                        finance_completed_at: clientRecord.finance_completed_at,
                        contracts_completed_at: clientRecord.contracts_completed_at,
                        tax_completed_at: clientRecord.tax_completed_at,
                      }}
                      activatedAt={clientRecord.activated_at ?? null}
                      timeline={onboardingTimeline}
                      canEditChecklist={canEditOnboardingChecklist}
                      canOverrideStatus={canOverrideOnboardingStatus}
                      platformV6
                    />
                  }
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="brands" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ClientBrandsTab
                  client={clientRecord}
                  masterData={masterData}
                  onCancel={handleCancel}
                  shortcutsEnabled={activeTab === "brands"}
                  onGoToOverview={() => handleTabChange("overview")}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="legal" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ClientLegalTab
                  client={clientRecord}
                  onCancel={handleCancel}
                  shortcutsEnabled={activeTab === "legal"}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="finance" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ClientFinanceTab
                  client={clientRecord}
                  currencyOptions={currencyOptions}
                  onCancel={handleCancel}
                  shortcutsEnabled={activeTab === "finance"}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="client-ios" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ClientClientIosTab
                  clientId={clientRecord.id}
                  clientName={clientRecord.name}
                  clientIoTermsText={clientRecord.client_io_terms_text}
                  rows={clientIos}
                  recipients={clientIoRecipients}
                  onCancel={handleCancel}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="campaigns" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ClientCampaignsTab client={clientRecord} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="access" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ClientProfileTabShell
                  title="Client access"
                  description="Manage portal users and roles for this legal entity."
                  onCancel={handleCancel}
                >
                  <ClientAccessTab
                    entity={clientAccessEntity}
                    assignable={assignableClientProfiles}
                  />
                </ClientProfileTabShell>
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
          </div>
        </Tabs>
      </div>
    </ClientProfilePlatformProvider>
  );
}
