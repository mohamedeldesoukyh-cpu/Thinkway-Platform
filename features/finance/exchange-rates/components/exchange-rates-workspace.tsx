"use client";

import { format } from "date-fns";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  EXCHANGE_RATES_TAB_ORDER,
  EXCHANGE_RATES_TAB_STORAGE_KEY,
  isExchangeRatesTabId,
  type ExchangeRatesTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS,
  OperationalFormSection,
  OperationalWorkspaceSortableTabsBar,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertCurrencyAction,
  upsertExchangeRateAction,
  type FinanceActionState,
} from "@/features/finance/exchange-rates/actions";
import type { ExchangeRatesWorkspaceData } from "@/features/finance/exchange-rates/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type CurrencyRow = ExchangeRatesWorkspaceData["currencies"][number];
type ExchangeRateRow = ExchangeRatesWorkspaceData["rates"][number];

const CURRENCY_COLUMNS: OperationalConfigurableColumnDef<CurrencyRow>[] = [
  { id: "code", label: "Code", monoCell: true, renderCell: (c) => c.code },
  { id: "name", label: "Name", renderCell: (c) => c.name },
  { id: "symbol", label: "Symbol", renderCell: (c) => c.symbol ?? "—" },
  { id: "decimals", label: "Decimals", renderCell: (c) => c.decimal_places },
  {
    id: "status",
    label: "Status",
    renderCell: (c) => (
      <Badge variant={c.is_active ? "default" : "outline"}>
        {c.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];

const EXCHANGE_RATE_COLUMNS: OperationalConfigurableColumnDef<ExchangeRateRow>[] = [
  { id: "from", label: "From", monoCell: true, renderCell: (r) => r.from_currency },
  { id: "to", label: "To", monoCell: true, renderCell: (r) => r.to_currency },
  {
    id: "rate",
    label: "Rate",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (r) => r.exchange_rate.toFixed(6),
  },
  { id: "effective_from", label: "Effective from", renderCell: (r) => r.effective_start_date },
  {
    id: "effective_to",
    label: "Effective to",
    renderCell: (r) => r.effective_end_date ?? "Open-ended",
  },
  { id: "source", label: "Source", renderCell: (r) => r.source ?? "—" },
  {
    id: "status",
    label: "Status",
    renderCell: (r) => (
      <Badge variant={r.is_active ? "default" : "outline"}>
        {r.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];

const CURRENCY_COLUMN_METAS = getOperationalTableColumnMetas(CURRENCY_COLUMNS);
const EXCHANGE_RATE_COLUMN_METAS = getOperationalTableColumnMetas(EXCHANGE_RATE_COLUMNS);

type ExchangeRatesWorkspaceProps = {
  data: ExchangeRatesWorkspaceData;
};

export function ExchangeRatesWorkspace({ data }: ExchangeRatesWorkspaceProps) {
  const [tab, setTab] = useState("currencies");

  const { tabOrder, moveTab } = useWorkspaceTabOrder({
    storageKey: EXCHANGE_RATES_TAB_STORAGE_KEY,
    defaultOrder: EXCHANGE_RATES_TAB_ORDER,
    isValidId: isExchangeRatesTabId,
  });

  const tabsById = useMemo(
    (): Record<ExchangeRatesTabId, OperationalWorkspaceTabDef> => ({
      currencies: { value: "currencies", label: "Currencies" },
      rates: { value: "rates", label: "Exchange rates" },
      history: { value: "history", label: "FX history" },
    }),
    []
  );

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-0">
      <OperationalWorkspaceSortableTabsBar
        sectionLabel="Exchange rates"
        tabOrder={tabOrder}
        tabsById={tabsById}
        onReorder={moveTab}
      />

      <TabsContent value="currencies" className={cn(OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS, "space-y-4")}>
        <OperationalWorkspaceTabPanel className="space-y-4">
        <CurrencyForm currencies={data.currencies} />
        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.financeCurrencies}
          columns={CURRENCY_COLUMNS}
          rows={data.currencies}
          filterAccessors={{
            code: (row) => row.code,
            name: (row) => row.name,
            symbol: (row) => row.symbol,
            decimals: (row) => row.decimal_places,
            status: (row) => row.is_active,
          }}
        >
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            leading={
              <CampaignOperationalSectionHeader
                title="Currency master"
                actions={<OperationalTableControlsSlot contextLabel="Finance currencies" />}
              />
            }
          >
            <OperationalConfigurableTable
              columns={CURRENCY_COLUMNS}
              rows={data.currencies}
              rowKey={(currency) => currency.code}
            />
          </OperationalTableSection>
        </OperationalTableSuiteProvider>
        </OperationalWorkspaceTabPanel>
      </TabsContent>

      <TabsContent value="rates" className={cn(OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS, "space-y-4")}>
        <OperationalWorkspaceTabPanel className="space-y-4">
        <ExchangeRateForm currencies={data.currencies} />
        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.financeExchangeRates}
          columns={EXCHANGE_RATE_COLUMNS}
          rows={data.rates}
          filterAccessors={{
            from: (row) => row.from_currency,
            to: (row) => row.to_currency,
            rate: (row) => row.exchange_rate,
            effective_from: (row) => row.effective_start_date,
            effective_to: (row) => row.effective_end_date,
            source: (row) => row.source,
            status: (row) => row.is_active,
          }}
        >
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            leading={
              <CampaignOperationalSectionHeader
                title="Effective-dated rates"
                actions={<OperationalTableControlsSlot contextLabel="Finance exchange rates" />}
              />
            }
          >
            <OperationalConfigurableTable
              columns={EXCHANGE_RATE_COLUMNS}
              rows={data.rates}
              rowKey={(rate) => rate.id}
            />
          </OperationalTableSection>
        </OperationalTableSuiteProvider>
        </OperationalWorkspaceTabPanel>
      </TabsContent>

      <TabsContent value="history" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
        <OperationalWorkspaceTabPanel>
        <CampaignFlatSection title="FX audit & override history">
          <div className="space-y-3">
            {data.fx_history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No FX changes logged yet.</p>
            ) : (
              data.fx_history.map((entry) => (
                <div key={entry.id} className="rounded-2xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), "PPp")}
                    </p>
                  </div>
                  <p className="text-muted-foreground">
                    {entry.changed_by_name ?? "System"}
                    {entry.recalculation_scope
                      ? ` · ${entry.recalculation_scope}`
                      : ""}
                  </p>
                  {entry.override_reason ? (
                    <p className="mt-1 text-amber-700 dark:text-amber-400">
                      {entry.override_reason}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </CampaignFlatSection>
        </OperationalWorkspaceTabPanel>
      </TabsContent>
    </Tabs>
  );
}

function CurrencyForm({
  currencies,
}: {
  currencies: ExchangeRatesWorkspaceData["currencies"];
}) {
  const [state, action, pending] = useActionState(upsertCurrencyAction, {
    ok: false,
  } satisfies FinanceActionState);

  useEffect(() => {
    if (!state.message) return;
    toast[state.ok ? "success" : "error"](state.message);
  }, [state]);

  return (
    <OperationalFormSection
      title="Add / update currency"
      footer={
        <Button type="submit" form="currency-form" disabled={pending}>
          {pending ? "Saving…" : "Save currency"}
        </Button>
      }
    >
      <form id="currency-form" action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="grid gap-2">
          <Label htmlFor="currency_code">Code</Label>
          <Input id="currency_code" name="code" className={DETAIL_FORM_INPUT_CLASS} placeholder="USD" maxLength={3} required />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="currency_name">Name</Label>
          <Input id="currency_name" name="name" className={DETAIL_FORM_INPUT_CLASS} placeholder="US Dollar" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency_symbol">Symbol</Label>
          <Input id="currency_symbol" name="symbol" className={DETAIL_FORM_INPUT_CLASS} placeholder="$" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="decimal_places">Decimals</Label>
          <Input id="decimal_places" name="decimal_places" type="number" className={DETAIL_FORM_INPUT_CLASS} defaultValue={2} />
        </div>
      </form>
      <p className="text-xs text-muted-foreground">
        {currencies.length} currencies loaded dynamically for campaigns, billing, PO tracker, and VAT.
      </p>
    </OperationalFormSection>
  );
}

function ExchangeRateForm({
  currencies,
}: {
  currencies: ExchangeRatesWorkspaceData["currencies"];
}) {
  const [applyMode, setApplyMode] = useState<"future" | "override_historical">("future");
  const [state, action, pending] = useActionState(upsertExchangeRateAction, {
    ok: false,
  } satisfies FinanceActionState);

  useEffect(() => {
    if (!state.message) return;
    toast[state.ok ? "success" : "error"](state.message);
  }, [state]);

  return (
    <OperationalFormSection
      title="Add exchange rate"
      footer={
        <Button type="submit" form="exchange-rate-form" disabled={pending}>
          {pending ? "Saving…" : "Save rate"}
        </Button>
      }
    >
      <form id="exchange-rate-form" action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="apply_mode" value={applyMode} />
          <div className="grid gap-2">
            <Label>From</Label>
            <Select name="from_currency" defaultValue="USD">
              <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.filter((c) => c.is_active).map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>To</Label>
            <Select name="to_currency" defaultValue="EGP">
              <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.filter((c) => c.is_active).map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exchange_rate">Rate</Label>
            <Input id="exchange_rate" name="exchange_rate" type="number" step="0.000001" className={DETAIL_FORM_INPUT_CLASS} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="effective_start_date">Effective from</Label>
            <Input id="effective_start_date" name="effective_start_date" type="date" className={DETAIL_FORM_INPUT_CLASS} required />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Apply mode</Label>
            <Select
              value={applyMode}
              onValueChange={(v) =>
                setApplyMode(v as "future" | "override_historical")
              }
            >
              <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="future">Apply starting from new date</SelectItem>
                <SelectItem value="override_historical">
                  Override all historical records
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {applyMode === "override_historical" ? (
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="override_reason">Override reason</Label>
              <Textarea id="override_reason" name="override_reason" rows={2} required />
            </div>
          ) : null}
        </form>
      <p className="text-xs text-muted-foreground">
        Historical campaigns preserve FX snapshots. New effective-dated rates apply forward without recalculating frozen records.
      </p>
    </OperationalFormSection>
  );
}
