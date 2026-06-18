"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Tabs } from "@/components/ui/tabs";
import {
  OperationalWorkspaceChrome,
  OperationalWorkspaceSortableTabsBar,
  OperationalWorkspaceTabContent,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { DocumentNumber } from "@/components/ui/document-number";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  CLIENT_PROFILE_TAB_ORDER,
  CLIENT_PROFILE_TAB_STORAGE_KEY,
  isClientProfileTabId,
  type ClientProfileTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import type { ClientIoRow, ClientIoSendRecipient } from "@/features/io/types";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

import { ClientStatusBadge } from "./client-status-badge";
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
  clientAccessPanel?: React.ReactNode;
};

export function ClientProfile({
  client,
  groups,
  masterData,
  clientIos,
  clientIoRecipients,
  clientAccessPanel,
}: ClientProfileProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ClientProfileTabId>("overview");
  const isEditView = activeTab === "overview";
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const { tabOrder, moveTab } = useWorkspaceTabOrder({
    storageKey: CLIENT_PROFILE_TAB_STORAGE_KEY,
    defaultOrder: CLIENT_PROFILE_TAB_ORDER,
    isValidId: isClientProfileTabId,
  });

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

  const tabPanels = (
    <>
      <OperationalWorkspaceTabContent
        value="overview"
        className={
          isEditView
            ? "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none"
            : undefined
        }
      >
        <OperationalWorkspaceTabPanel
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            isEditView ? "min-h-0 overflow-hidden" : undefined
          )}
        >
          <ClientOverviewTab
            client={client}
            groups={groups}
            masterData={masterData}
            onCancel={() => router.push("/clients")}
            shortcutsEnabled={activeTab === "overview"}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="brands">
        <OperationalWorkspaceTabPanel>
          <ClientBrandsTab client={client} masterData={masterData} />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="legal">
        <OperationalWorkspaceTabPanel className="p-4 md:p-5">
          <ClientLegalTab client={client} />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="finance">
        <OperationalWorkspaceTabPanel className="p-4 md:p-5">
          <ClientFinanceTab client={client} currencyOptions={currencyOptions} />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="client-ios">
        <OperationalWorkspaceTabPanel className="p-4 md:p-5">
          <ClientClientIosTab
            clientId={client.id}
            clientName={client.name}
            clientIoTermsText={client.client_io_terms_text}
            rows={clientIos}
            recipients={clientIoRecipients}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="campaigns">
        <OperationalWorkspaceTabPanel>
          <ClientCampaignsTab client={client} />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="access">
        <OperationalWorkspaceTabPanel className="p-4 md:p-5">
          {clientAccessPanel ?? (
            <p className="text-[11px] text-muted-foreground">Client access is loading…</p>
          )}
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
      {!isEditView ? (
        <OperationalWorkspaceChrome
          backButton={
            <PageBackButton fallbackHref="/clients" label="Back to clients" />
          }
          title={client.name}
          badges={<ClientStatusBadge status={client.status} />}
          meta={
            <>
              <DocumentNumber value={client.document_number} />
              {client.group ? ` · ${client.group.name}` : null}
            </>
          }
        />
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isClientProfileTabId(value)) {
            setActiveTab(value);
          }
        }}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-0 overflow-hidden",
          isEditView ? "mt-0" : "mt-4"
        )}
      >
        {!isEditView ? (
          <OperationalWorkspaceSortableTabsBar
            sectionLabel="Legal entity workspace"
            tabOrder={tabOrder}
            tabsById={tabsById}
            onReorder={moveTab}
          />
        ) : (
          <nav
            aria-label="Legal entity workspace sections"
            className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#E6EAF2] px-[26px] py-2.5"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9099A8]">
              Also view
            </span>
            {tabOrder
              .filter((tabId) => tabId !== "overview")
              .map((tabId) => {
                const tab = tabsById[tabId];
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setActiveTab(tabId)}
                    className="text-[13px] font-medium text-[#5B6575] transition-colors hover:text-[#0057FF]"
                  >
                    {tab.label}
                    {tab.count != null ? ` (${tab.count})` : ""}
                  </button>
                );
              })}
          </nav>
        )}

        {isEditView ? tabPanels : (
          <div className="h-0 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
            {tabPanels}
          </div>
        )}
      </Tabs>
    </div>
  );
}
