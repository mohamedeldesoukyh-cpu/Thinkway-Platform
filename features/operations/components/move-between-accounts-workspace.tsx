"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { ArrowRightLeftIcon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { useIsOperationalColumnVisible } from "@/components/tables/operational-table-column-context";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";
import { OPERATIONS_MOVE_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import {
  OperationalFloatingActionBar,
  operationalFloatingBarContentClass,
} from "@/components/workspace/operational-floating-action-bar";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableCellMono,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { Textarea } from "@/components/ui/textarea";
import {
  executeMovementAction,
  previewMovementAction,
} from "@/features/operations/actions";
import type {
  HierarchyOption,
  MovementCampaignRow,
  MovementPreview,
  MovementType,
} from "@/features/operations/types";
import { formatBillingMoney } from "@/features/billing/utils";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

export const OPERATIONS_MOVE_CAMPAIGNS_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "select", label: "Select", locked: true },
  { id: "campaign_number", label: "Campaign #" },
  { id: "name", label: "Name" },
  { id: "group", label: "Group" },
  { id: "client", label: "Client" },
  { id: "brand", label: "Brand" },
  { id: "revenue", label: "Revenue" },
  { id: "gp", label: "GP" },
  { id: "status", label: "Status" },
  { id: "billing", label: "Billing" },
  { id: "invoice", label: "Invoice" },
  { id: "live", label: "Live" },
];

type MoveBetweenAccountsWorkspaceProps = {
  hierarchy: {
    groups: HierarchyOption[];
    clients: HierarchyOption[];
    brands: HierarchyOption[];
  };
  initialCampaigns: MovementCampaignRow[];
  initialTotal: number;
};

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  brand_to_brand: "Brand → Brand",
  client_to_client: "Client → Client",
  group_to_group: "Group → Group",
  vendor_to_vendor: "Vendor → Vendor",
};

function MoveCampaignsTableHeader({
  allSelected,
  onToggleAll,
}: {
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
}) {
  const showSelect = useIsOperationalColumnVisible("select");
  const showCampaignNumber = useIsOperationalColumnVisible("campaign_number");
  const showName = useIsOperationalColumnVisible("name");
  const showGroup = useIsOperationalColumnVisible("group");
  const showClient = useIsOperationalColumnVisible("client");
  const showBrand = useIsOperationalColumnVisible("brand");
  const showRevenue = useIsOperationalColumnVisible("revenue");
  const showGp = useIsOperationalColumnVisible("gp");
  const showStatus = useIsOperationalColumnVisible("status");
  const showBilling = useIsOperationalColumnVisible("billing");
  const showInvoice = useIsOperationalColumnVisible("invoice");
  const showLive = useIsOperationalColumnVisible("live");

  return (
    <CampaignOperationalTableHeader>
      <CampaignOperationalTableHeaderRow>
        {showSelect ? (
          <CampaignOperationalTableHead className="w-10">
            <input
              type="checkbox"
              className="size-4 rounded border"
              checked={allSelected}
              onChange={(e) => onToggleAll(e.target.checked)}
              aria-label="Select all"
            />
          </CampaignOperationalTableHead>
        ) : null}
        {showCampaignNumber ? (
          <CampaignOperationalTableHead>Campaign #</CampaignOperationalTableHead>
        ) : null}
        {showName ? <CampaignOperationalTableHead>Name</CampaignOperationalTableHead> : null}
        {showGroup ? <CampaignOperationalTableHead>Group</CampaignOperationalTableHead> : null}
        {showClient ? <CampaignOperationalTableHead>Client</CampaignOperationalTableHead> : null}
        {showBrand ? <CampaignOperationalTableHead>Brand</CampaignOperationalTableHead> : null}
        {showRevenue ? (
          <CampaignOperationalTableHead className="text-right">Revenue</CampaignOperationalTableHead>
        ) : null}
        {showGp ? (
          <CampaignOperationalTableHead className="text-right">GP</CampaignOperationalTableHead>
        ) : null}
        {showStatus ? <CampaignOperationalTableHead>Status</CampaignOperationalTableHead> : null}
        {showBilling ? <CampaignOperationalTableHead>Billing</CampaignOperationalTableHead> : null}
        {showInvoice ? <CampaignOperationalTableHead>Invoice</CampaignOperationalTableHead> : null}
        {showLive ? <CampaignOperationalTableHead>Live</CampaignOperationalTableHead> : null}
      </CampaignOperationalTableHeaderRow>
    </CampaignOperationalTableHeader>
  );
}

function MoveCampaignsTableRow({
  campaign,
  selected,
  onToggle,
}: {
  campaign: MovementCampaignRow;
  selected: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const showSelect = useIsOperationalColumnVisible("select");
  const showCampaignNumber = useIsOperationalColumnVisible("campaign_number");
  const showName = useIsOperationalColumnVisible("name");
  const showGroup = useIsOperationalColumnVisible("group");
  const showClient = useIsOperationalColumnVisible("client");
  const showBrand = useIsOperationalColumnVisible("brand");
  const showRevenue = useIsOperationalColumnVisible("revenue");
  const showGp = useIsOperationalColumnVisible("gp");
  const showStatus = useIsOperationalColumnVisible("status");
  const showBilling = useIsOperationalColumnVisible("billing");
  const showInvoice = useIsOperationalColumnVisible("invoice");
  const showLive = useIsOperationalColumnVisible("live");

  return (
    <CampaignOperationalTableRow>
      {showSelect ? (
        <CampaignOperationalTableCell>
          <input
            type="checkbox"
            className="size-4 rounded border"
            checked={selected}
            onChange={(e) => onToggle(e.target.checked)}
            aria-label={`Select ${campaign.name}`}
          />
        </CampaignOperationalTableCell>
      ) : null}
      {showCampaignNumber ? (
        <CampaignOperationalTableCellMono>
          <DocumentNumber value={campaign.document_number} />
        </CampaignOperationalTableCellMono>
      ) : null}
      {showName ? (
        <CampaignOperationalTableCell className="font-medium">{campaign.name}</CampaignOperationalTableCell>
      ) : null}
      {showGroup ? (
        <CampaignOperationalTableCell>{campaign.group_name ?? "—"}</CampaignOperationalTableCell>
      ) : null}
      {showClient ? (
        <CampaignOperationalTableCell>{campaign.client_name ?? "—"}</CampaignOperationalTableCell>
      ) : null}
      {showBrand ? (
        <CampaignOperationalTableCell>{campaign.brand_name ?? "—"}</CampaignOperationalTableCell>
      ) : null}
      {showRevenue ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoney(campaign.revenue)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showGp ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoney(campaign.gp)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showStatus ? (
        <CampaignOperationalTableCell>
          <Badge variant="outline" className="capitalize">
            {campaign.status}
          </Badge>
        </CampaignOperationalTableCell>
      ) : null}
      {showBilling ? (
        <CampaignOperationalTableCell className="capitalize">
          {campaign.billing_status}
        </CampaignOperationalTableCell>
      ) : null}
      {showInvoice ? (
        <CampaignOperationalTableCell className="capitalize">
          {campaign.invoice_status.replace("_", " ")}
        </CampaignOperationalTableCell>
      ) : null}
      {showLive ? (
        <CampaignOperationalTableCell>
          {campaign.live_date
            ? format(new Date(campaign.live_date), "MMM d, yyyy")
            : "—"}
        </CampaignOperationalTableCell>
      ) : null}
    </CampaignOperationalTableRow>
  );
}

function MoveCampaignsTable({
  rows,
  selected,
  onToggleAll,
  onToggleOne,
}: {
  rows: MovementCampaignRow[];
  selected: Set<string>;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
}) {
  const displayRows =
    useOperationalTableDataContextOptional<MovementCampaignRow>()?.processedRows ?? rows;

  return (
    <CampaignOperationalTable>
      <MoveCampaignsTableHeader
        allSelected={displayRows.length > 0 && selected.size === displayRows.length}
        onToggleAll={onToggleAll}
      />
      <CampaignOperationalTableBody>
        {displayRows.map((campaign) => (
          <MoveCampaignsTableRow
            key={campaign.id}
            campaign={campaign}
            selected={selected.has(campaign.id)}
            onToggle={(checked) => onToggleOne(campaign.id, checked)}
          />
        ))}
      </CampaignOperationalTableBody>
    </CampaignOperationalTable>
  );
}

export function MoveBetweenAccountsWorkspace({
  hierarchy,
  initialCampaigns,
  initialTotal,
}: MoveBetweenAccountsWorkspaceProps) {
  const [movementType, setMovementType] = useState<MovementType>("brand_to_brand");
  const [sourceGroupId, setSourceGroupId] = useState("");
  const [sourceClientId, setSourceClientId] = useState("");
  const [sourceBrandId, setSourceBrandId] = useState("");
  const [destGroupId, setDestGroupId] = useState("");
  const [destClientId, setDestClientId] = useState("");
  const [destBrandId, setDestBrandId] = useState("");
  const [search, setSearch] = useState("");
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<MovementPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredClients = useMemo(() => {
    if (!sourceGroupId && !destGroupId) return hierarchy.clients;
    return hierarchy.clients.filter((c) => {
      const clientRow = c as HierarchyOption & { group_id?: string };
      if (sourceGroupId && clientRow.sublabel) {
        return true;
      }
      return true;
    });
  }, [hierarchy.clients, sourceGroupId, destGroupId]);

  const sourceBrands = useMemo(
    () =>
      hierarchy.brands.filter((b) =>
        sourceClientId ? b.sublabel : true
      ),
    [hierarchy.brands, sourceClientId]
  );

  const destBrands = useMemo(
    () =>
      hierarchy.brands.filter((b) =>
        destClientId ? true : true
      ),
    [hierarchy.brands, destClientId]
  );

  const moveCampaignColumns = useMemo(
    () =>
      operationalColumnsFromMetas(
        OPERATIONS_MOVE_CAMPAIGNS_COLUMN_METAS,
        OPERATIONS_MOVE_CAMPAIGNS_FILTER_ACCESSORS
      ),
    []
  );

  const selectedCampaigns = campaigns.filter((c) => selected.has(c.id));
  const selectedRevenue = selectedCampaigns.reduce((s, c) => s + c.revenue, 0);
  const selectedGp = selectedCampaigns.reduce((s, c) => s + c.gp, 0);

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(campaigns.map((c) => c.id)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const loadCampaigns = () => {
    startTransition(async () => {
      const params = new URLSearchParams({
        movementType,
        ...(sourceGroupId ? { groupId: sourceGroupId } : {}),
        ...(sourceClientId ? { clientId: sourceClientId } : {}),
        ...(sourceBrandId ? { brandId: sourceBrandId } : {}),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/operations/campaigns?${params}`);
      if (!res.ok) {
        toast.error("Failed to load campaigns.");
        return;
      }
      const data = (await res.json()) as { campaigns: MovementCampaignRow[] };
      setCampaigns(data.campaigns);
      setSelected(new Set());
    });
  };

  const handlePreview = () => {
    if (selected.size === 0) {
      toast.error("Select at least one campaign.");
      return;
    }
    if (!destGroupId || !destClientId || !destBrandId) {
      toast.error("Select destination group, client, and brand.");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("movement_type", movementType);
      fd.set("campaign_ids", [...selected].join(","));
      if (sourceGroupId) fd.set("source_group_id", sourceGroupId);
      if (sourceClientId) fd.set("source_client_id", sourceClientId);
      if (sourceBrandId) fd.set("source_brand_id", sourceBrandId);

      const result = await previewMovementAction({ ok: false }, fd);
      if (result.ok && result.preview) {
        setPreview(result.preview);
        setPreviewOpen(true);
      } else {
        toast.error(result.message ?? "Preview failed.");
      }
    });
  };

  const handleExecute = () => {
    if (!reason.trim()) {
      toast.error("Movement reason is required.");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("movement_type", movementType);
      fd.set("campaign_ids", [...selected].join(","));
      fd.set("destination_group_id", destGroupId);
      fd.set("destination_client_id", destClientId);
      fd.set("destination_brand_id", destBrandId);
      fd.set("reason", reason);
      if (sourceGroupId) fd.set("source_group_id", sourceGroupId);
      if (sourceClientId) fd.set("source_client_id", sourceClientId);
      if (sourceBrandId) fd.set("source_brand_id", sourceBrandId);

      const result = await executeMovementAction({ ok: false }, fd);
      if (result.ok) {
        toast.success(result.message);
        setPreviewOpen(false);
        setSelected(new Set());
        setReason("");
        loadCampaigns();
      } else {
        toast.error(result.message ?? "Movement failed.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <CampaignFlatSection
        title="Movement configuration"
        actions={<ArrowRightLeftIcon className="size-5 text-muted-foreground" />}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label>Movement type</Label>
            <Select
              value={movementType}
              onValueChange={(v) => setMovementType(v as MovementType)}
            >
              <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CampaignFlatSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <CampaignFlatSection
          title="Source"
          description="Select hierarchy — linked campaigns load below."
        >
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Group</Label>
              <SearchableSelect
                value={sourceGroupId}
                onValueChange={setSourceGroupId}
                options={[
                  { value: "", label: "All groups" },
                  ...hierarchy.groups.map((g) => ({
                    value: g.id,
                    label: g.label,
                  })),
                ]}
                placeholder="Select group"
              />
            </div>
            <div className="grid gap-2">
              <Label>Legal entity</Label>
              <SearchableSelect
                value={sourceClientId}
                onValueChange={setSourceClientId}
                options={[
                  { value: "", label: "All entities" },
                  ...filteredClients.map((c) => ({
                    value: c.id,
                    label: c.label,
                  })),
                ]}
                placeholder="Select client"
              />
            </div>
            <div className="grid gap-2">
              <Label>Brand</Label>
              <SearchableSelect
                value={sourceBrandId}
                onValueChange={setSourceBrandId}
                options={[
                  { value: "", label: "All brands" },
                  ...sourceBrands.map((b) => ({
                    value: b.id,
                    label: b.label,
                  })),
                ]}
                placeholder="Select brand"
              />
            </div>
            <Button type="button" variant="outline" onClick={loadCampaigns} disabled={isPending}>
              Load campaigns
            </Button>
          </div>
        </CampaignFlatSection>

        <CampaignFlatSection
          title="Destination"
          description="Target ownership hierarchy for selected campaigns."
        >
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Group</Label>
              <SearchableSelect
                value={destGroupId}
                onValueChange={setDestGroupId}
                options={hierarchy.groups.map((g) => ({
                  value: g.id,
                  label: g.label,
                }))}
                placeholder="Destination group"
              />
            </div>
            <div className="grid gap-2">
              <Label>Legal entity</Label>
              <SearchableSelect
                value={destClientId}
                onValueChange={setDestClientId}
                options={hierarchy.clients.map((c) => ({
                  value: c.id,
                  label: c.label,
                }))}
                placeholder="Destination client"
              />
            </div>
            <div className="grid gap-2">
              <Label>Brand</Label>
              <SearchableSelect
                value={destBrandId}
                onValueChange={setDestBrandId}
                options={destBrands.map((b) => ({
                  value: b.id,
                  label: b.label,
                }))}
                placeholder="Destination brand"
              />
            </div>
          </div>
        </CampaignFlatSection>
      </div>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.operationsMoveCampaigns}
        columns={moveCampaignColumns}
        rows={campaigns}
        filterAccessors={OPERATIONS_MOVE_CAMPAIGNS_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          className={operationalFloatingBarContentClass(selected.size > 0)}
          leading={
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CampaignOperationalSectionHeader title="Campaign selection" />
              <div className="flex flex-wrap items-center gap-2">
                <OperationalTableControlsSlot contextLabel="Move campaigns" />
                <div className="relative w-full max-w-xs">
                  <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className={cn(DETAIL_FORM_INPUT_CLASS, "pl-9")}
                    placeholder="Search campaigns…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadCampaigns()}
                  />
                </div>
              </div>
            </div>
          }
        >
          {campaigns.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              Select source hierarchy and load campaigns.
            </p>
          ) : (
            <MoveCampaignsTable
              rows={campaigns}
              selected={selected}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
            />
          )}
          <p className="mt-2 px-4 pb-4 text-xs text-muted-foreground md:px-5">
            Showing {campaigns.length} of {initialTotal} campaigns
          </p>
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <OperationalFloatingActionBar visible={selected.size > 0}>
        <div className="flex shrink-0 items-center gap-1.5 pr-1">
          <Badge
            variant="secondary"
            className="h-6 shrink-0 rounded-full px-2.5 text-[11px] font-semibold"
          >
            {selected.size} selected
          </Badge>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="size-6 shrink-0 rounded-full text-muted-foreground"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>

        <div className="hidden h-5 w-px shrink-0 bg-border/70 sm:block" aria-hidden />

        <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
          <span className="text-muted-foreground">
            Revenue{" "}
            <span className="font-semibold text-foreground">
              {formatBillingMoney(selectedRevenue)}
            </span>
          </span>
          <span className="hidden text-muted-foreground sm:inline">
            GP{" "}
            <span className="font-semibold text-foreground">
              {formatBillingMoney(selectedGp)}
            </span>
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 rounded-full text-xs"
            disabled={isPending}
            onClick={handlePreview}
          >
            Preview & move selected
          </Button>
        </div>
      </OperationalFloatingActionBar>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Movement preview</DialogTitle>
            <DialogDescription>
              Review impact before executing. Campaign numbers, invoices, and audit history are preserved.
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-2xl border p-4">
                <div>
                  <p className="text-muted-foreground">Campaigns</p>
                  <p className="text-lg font-semibold">{preview.campaign_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Invoices</p>
                  <p className="text-lg font-semibold">{preview.total_invoices}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Revenue</p>
                  <p className="text-lg font-semibold">
                    {formatBillingMoney(preview.total_revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">GP</p>
                  <p className="text-lg font-semibold">
                    {formatBillingMoney(preview.total_gp)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Affected collections</p>
                  <p className="text-lg font-semibold">{preview.affected_collections}</p>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="move_reason">Reason (required)</Label>
                <Textarea
                  id="move_reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Restructuring, merger, wrong setup correction…"
                  rows={3}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExecute} disabled={isPending || !reason.trim()}>
              {isPending ? "Moving…" : "Move selected campaigns"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
