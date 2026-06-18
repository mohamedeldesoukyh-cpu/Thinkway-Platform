"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS,
  OperationalWorkspaceSortableTabsBar,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  AGING_WORKSPACE_TAB_ORDER,
  AGING_WORKSPACE_TAB_STORAGE_KEY,
  agingTabToQuery,
  isAgingWorkspaceTabId,
  queryToAgingTab,
  type AgingWorkspaceTabId,
} from "@/lib/workspace/platform-workspace-tabs";

import { buildAgingCsv } from "@/features/finance/aging/export";
import type { AgingWorkspaceData } from "@/features/finance/aging/types";
import { AgingDetailTable } from "./aging-detail-table";
import { AgingKpiStrip } from "./aging-kpi-strip";
import { AgingSummaryTable } from "./aging-summary-table";

type AgingWorkspaceProps = {
  data: AgingWorkspaceData;
};

const TAB_LABELS: Record<AgingWorkspaceTabId, string> = {
  "client-summary": "Client summary",
  "client-detailed": "Client detailed",
  "overdue-summary": "Overdue summary",
  "overdue-detailed": "Overdue detailed",
};

const TAB_DESCRIPTIONS: Record<AgingWorkspaceTabId, string> = {
  "client-summary":
    "Outstanding receivables by legal entity, aged from invoice date.",
  "client-detailed":
    "Per-client bucket totals with expandable invoice drill-down.",
  "overdue-summary":
    "Outstanding receivables by legal entity, aged from due date (days past due).",
  "overdue-detailed":
    "Per-invoice overdue aging with expandable client groups.",
};

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AgingWorkspace({ data }: AgingWorkspaceProps) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const activeTab = queryToAgingTab(data.mode, data.view);

  const { tabOrder, moveTab } = useWorkspaceTabOrder({
    storageKey: AGING_WORKSPACE_TAB_STORAGE_KEY,
    defaultOrder: AGING_WORKSPACE_TAB_ORDER,
    isValidId: isAgingWorkspaceTabId,
  });

  const tabsById = useMemo(
    (): Record<AgingWorkspaceTabId, OperationalWorkspaceTabDef> => ({
      "client-summary": { id: "client-summary", label: TAB_LABELS["client-summary"] },
      "client-detailed": { id: "client-detailed", label: TAB_LABELS["client-detailed"] },
      "overdue-summary": { id: "overdue-summary", label: TAB_LABELS["overdue-summary"] },
      "overdue-detailed": { id: "overdue-detailed", label: TAB_LABELS["overdue-detailed"] },
    }),
    []
  );

  const orderedTabs = tabOrder.map((id) => tabsById[id]);

  function handleTabChange(tab: string) {
    if (!isAgingWorkspaceTabId(tab)) return;
    const { mode, view } = agingTabToQuery(tab);
    const params = new URLSearchParams();
    params.set("mode", mode);
    params.set("view", view);
    router.push(`/finance/aging?${params.toString()}`);
  }

  function handleExport() {
    setExporting(true);
    try {
      const csv = buildAgingCsv(data);
      const filename = `thinkway-aging-${data.mode}-${data.view}-${data.as_of}.csv`;
      downloadCsv(filename, csv);
    } finally {
      setExporting(false);
    }
  }

  const primaryCurrency = data.currencies.length === 1 ? data.currencies[0] : undefined;

  return (
    <div className="space-y-6">
      <CampaignFlatSection
        title="A/R aging reports"
        description={`As of ${data.as_of} · ${data.client_count} legal entit${data.client_count === 1 ? "y" : "ies"} · ${data.invoice_count} open invoice${data.invoice_count === 1 ? "" : "s"}`}
        actions={
          <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
            <DownloadIcon data-icon="inline-start" className="size-3.5" />
            Export CSV
          </Button>
        }
      >
        <AgingKpiStrip
          summary={data.summary}
          mixedCurrency={data.mixed_currency}
          primaryCurrency={primaryCurrency}
          basisLabel={data.basis_label}
        />
      </CampaignFlatSection>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <OperationalWorkspaceSortableTabsBar
          tabs={orderedTabs}
          activeTab={activeTab}
          onMoveTab={moveTab}
        />

        {AGING_WORKSPACE_TAB_ORDER.map((tabId) => (
          <TabsContent key={tabId} value={tabId} className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
            <OperationalWorkspaceTabPanel>
              <p className="mb-4 text-xs text-muted-foreground">{TAB_DESCRIPTIONS[tabId]}</p>
              {tabId.endsWith("detailed") ? (
                <AgingDetailTable rows={data.detail_rows} />
              ) : (
                <AgingSummaryTable
                  rows={data.client_rows}
                  mixedCurrency={data.mixed_currency}
                />
              )}
            </OperationalWorkspaceTabPanel>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
