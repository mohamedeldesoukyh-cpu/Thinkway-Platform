"use client";

import { useMemo } from "react";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS,
  OperationalWorkspaceChrome,
  OperationalWorkspaceSortableTabsBar,
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
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

      <Tabs
        defaultValue="overview"
        className="mt-4 flex min-h-0 flex-1 flex-col gap-0"
      >
        <OperationalWorkspaceSortableTabsBar
          sectionLabel="Legal entity workspace"
          tabOrder={tabOrder}
          tabsById={tabsById}
          onReorder={moveTab}
        />

        <TabsContent value="overview" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <ClientOverviewTab client={client} groups={groups} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="brands" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <ClientBrandsTab client={client} masterData={masterData} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="legal" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <ClientLegalTab client={client} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="finance" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <ClientFinanceTab client={client} currencyOptions={currencyOptions} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="client-ios" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <ClientClientIosTab
              clientId={client.id}
              clientName={client.name}
              clientIoTermsText={client.client_io_terms_text}
              rows={clientIos}
              recipients={clientIoRecipients}
            />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="campaigns" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <ClientCampaignsTab client={client} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="access" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            {clientAccessPanel ?? (
              <p className="text-[11px] text-muted-foreground">Client access is loading…</p>
            )}
          </OperationalWorkspaceTabPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
