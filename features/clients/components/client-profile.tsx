"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

import { ClientProfileTabShell } from "./client-form-ui";
import { ClientAccessTab } from "./tabs/client-access-tab";
import { ClientBrandsTab } from "./tabs/client-brands-tab";
import { ClientCampaignsTab } from "./tabs/client-campaigns-tab";
import { ClientClientIosTab } from "./tabs/client-client-ios-tab";
import { ClientFinanceTab } from "./tabs/client-finance-tab";
import { ClientLegalTab } from "./tabs/client-legal-tab";
import { ClientOverviewTab } from "./tabs/client-overview-tab";

type ClientProfileProps = {
  client: ClientDetail;
  groups: { id: string; name: string; document_number: string }[];
  masterData: MasterDataOptions;
  clientIos: ClientIoRow[];
  clientIoRecipients: ClientIoSendRecipient[];
  clientAccessEntity: ClientAccessEntityRow | null;
  assignableClientProfiles: AssignableClientProfileRow[];
};

export function ClientProfile({
  client,
  groups,
  masterData,
  clientIos,
  clientIoRecipients,
  clientAccessEntity,
  assignableClientProfiles,
}: ClientProfileProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ClientProfileTabId>("overview");
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const { tabOrder } = useWorkspaceTabOrder({
    storageKey: CLIENT_PROFILE_TAB_STORAGE_KEY,
    defaultOrder: CLIENT_PROFILE_TAB_ORDER,
    isValidId: isClientProfileTabId,
  });

  const handleCancel = () => router.push("/clients");

  const tabsById = useMemo(
    (): Record<ClientProfileTabId, OperationalWorkspaceTabDef> => ({
      overview: { value: "overview", label: "Overview" },
      brands: { value: "brands", label: "Brands", count: client.brands.length },
      legal: { value: "legal", label: "Legal" },
      finance: { value: "finance", label: "Finance" },
      "client-ios": {
        value: "client-ios",
        label: "Client IO",
        count: clientIos.length,
      },
      campaigns: {
        value: "campaigns",
        label: "Campaign history",
        count: client.campaigns.length,
      },
      access: { value: "access", label: "Client access" },
    }),
    [client.brands.length, clientIos.length, client.campaigns.length]
  );

  const tabPanelClassName =
    "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

  const tabPanels = (
    <>
      <OperationalWorkspaceTabContent value="overview" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col min-h-0 overflow-hidden">
          <ClientOverviewTab
            client={client}
            groups={groups}
            masterData={masterData}
            onCancel={handleCancel}
            shortcutsEnabled={activeTab === "overview"}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="brands" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col min-h-0 overflow-hidden">
          <ClientBrandsTab
            client={client}
            masterData={masterData}
            onCancel={handleCancel}
            shortcutsEnabled={activeTab === "brands"}
            onGoToOverview={() => setActiveTab("overview")}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="legal" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col min-h-0 overflow-hidden">
          <ClientLegalTab
            client={client}
            onCancel={handleCancel}
            shortcutsEnabled={activeTab === "legal"}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="finance" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col min-h-0 overflow-hidden">
          <ClientFinanceTab
            client={client}
            currencyOptions={currencyOptions}
            onCancel={handleCancel}
            shortcutsEnabled={activeTab === "finance"}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="client-ios" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col min-h-0 overflow-hidden">
          <ClientClientIosTab
            clientId={client.id}
            clientName={client.name}
            clientIoTermsText={client.client_io_terms_text}
            rows={clientIos}
            recipients={clientIoRecipients}
            onCancel={handleCancel}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="campaigns" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col min-h-0 overflow-hidden">
          <ClientCampaignsTab client={client} onCancel={handleCancel} />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="access" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col min-h-0 overflow-hidden">
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
    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isClientProfileTabId(value)) {
            setActiveTab(value);
          }
        }}
        className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <nav
          aria-label="Legal entity workspace sections"
          className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#E6EAF2] px-[26px] py-2.5"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9099A8]">
            Also view
          </span>
          {tabOrder.map((tabId) => {
            const tab = tabsById[tabId];
            const isActive = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={cn(
                  "text-[13px] font-medium transition-colors",
                  isActive
                    ? "font-semibold text-[#0057FF]"
                    : "text-[#5B6575] hover:text-[#0057FF]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
                {tab.count != null ? ` (${tab.count})` : ""}
              </button>
            );
          })}
        </nav>

        {tabPanels}
      </Tabs>
    </div>
  );
}
