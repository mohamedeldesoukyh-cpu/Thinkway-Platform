"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlatformV6EntityBreadcrumb,
  platformV6BadgeClass,
} from "@/components/platform/platform-v6-layout";
import { Tabs } from "@/components/ui/tabs";
import {
  OperationalWorkspaceTabContent,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  CLIENT_PROFILE_TAB_ORDER,
  CLIENT_PROFILE_TAB_STORAGE_KEY,
  isClientProfileTabId,
  type ClientProfileTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import type {
  AssignableClientProfileRow,
  ClientAccessEntityRow,
} from "@/features/client-access/types";
import type { ClientIoRow, ClientIoSendRecipient } from "@/features/io/types";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import {
  deriveOnboardingStatusFromCompletion,
  isClientOnboardingStatus,
  ONBOARDING_STATUS_LABELS,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";
import { computeClientProfileTabMissingCounts } from "@/lib/clients/client-profile-readiness";

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

function resolveEntityStatusBadge(client: ClientDetail): {
  label: string;
  className: string;
} {
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
    if (status === "active") {
      return { label: ONBOARDING_STATUS_LABELS.active, className: platformV6BadgeClass("outline-green") };
    }
    if (status === "legal_pending") {
      return {
        label: ONBOARDING_STATUS_LABELS.legal_pending,
        className: platformV6BadgeClass("outline-amber"),
      };
    }
    return { label: ONBOARDING_STATUS_LABELS[status], className: platformV6BadgeClass("gray") };
  }

  const label =
    CLIENT_STATUS_OPTIONS.find((option) => option.value === client.status)?.label ??
    client.status;
  const className =
    client.status === "active"
      ? platformV6BadgeClass("outline-green")
      : platformV6BadgeClass("gray");
  return { label, className };
}

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
}: ClientProfileProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ClientProfileTabId>("overview");
  const [clientRecord, setClientRecord] = useState(client);
  const currencyOptions = buildCurrencyOptions(masterData.currencies);

  useEffect(() => {
    setClientRecord(client);
  }, [client]);

  const applyClientPatch = useCallback((patch: ClientOverviewSavePatch) => {
    setClientRecord((current) => ({
      ...current,
      group_id: patch.group_id,
      group: patch.group,
      updated_at: patch.updated_at,
    }));
  }, []);  const { tabOrder } = useWorkspaceTabOrder({
    storageKey: CLIENT_PROFILE_TAB_STORAGE_KEY,
    defaultOrder: CLIENT_PROFILE_TAB_ORDER,
    isValidId: isClientProfileTabId,
  });

  const handleCancel = () => router.push("/clients");
  const entityBadge = resolveEntityStatusBadge(clientRecord);
  const tabMissingCounts = useMemo(
    () => computeClientProfileTabMissingCounts(clientRecord),
    [clientRecord]
  );
  const tabsById = useMemo(
    (): Record<ClientProfileTabId, OperationalWorkspaceTabDef> => ({
      overview: {
        value: "overview",
        label: "Overview",
        count: tabMissingCounts.overview,
      },
      brands: {
        value: "brands",
        label: "Brands",
        count: tabMissingCounts.brands,
      },
      legal: { value: "legal", label: "Legal", count: tabMissingCounts.legal },
      finance: { value: "finance", label: "Finance", count: tabMissingCounts.finance },
      "client-ios": {
        value: "client-ios",
        label: "Client IO",
      },
      campaigns: {
        value: "campaigns",
        label: "Campaign history",
      },
      access: { value: "access", label: "Client access" },
    }),
    [tabMissingCounts]
  );

  const tabPanelClassName =
    "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

  const tabPanels = (
    <>
      <OperationalWorkspaceTabContent value="overview" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ClientOverviewTab
            client={clientRecord}
            groups={groups}
            masterData={masterData}
            onCancel={handleCancel}
            shortcutsEnabled={activeTab === "overview"}
            onClientPatch={applyClientPatch}
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
                activatedAt={clientRecord.activated_at ?? null}                timeline={onboardingTimeline}
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
            onGoToOverview={() => setActiveTab("overview")}
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
    </>
  );

  return (
    <ClientProfilePlatformProvider platformV6>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isClientProfileTabId(value)) {
            setActiveTab(value);
          }
        }}
        className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <div className="platform-v6-entity-nav-bar">
          <div className="platform-v6-entity-nav-inner">
            <span className="platform-v6-entity-title">{clientRecord.name}</span>            <span className={entityBadge.className}>{entityBadge.label}</span>
            <span className="platform-v6-also-view">Also View</span>
          </div>
          <div className="platform-v6-entity-tabs-row" role="tablist">
            {tabOrder.map((tabId) => {
              const tab = tabsById[tabId];
              const isActive = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tabId)}
                  className={cn("platform-v6-etab", isActive && "active")}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 ? ` (${tab.count})` : ""}
                </button>
              );
            })}
          </div>
        </div>

        <PlatformV6EntityBreadcrumb
          crumbs={[
            { label: "Clients", href: "/clients" },
            { label: "Legal Entities", href: "/clients" },
            { label: clientRecord.name },
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
              {TAB_FORM_IDS[activeTab] ? (
                <button
                  type="submit"
                  form={TAB_FORM_IDS[activeTab]}
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

        <div className="min-h-0 flex-1 overflow-y-auto">{tabPanels}</div>
      </Tabs>
    </div>
    </ClientProfilePlatformProvider>
  );
}
