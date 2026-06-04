"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { ArrowRightLeftIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeftIcon className="size-5" />
            Movement configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label>Movement type</Label>
            <Select
              value={movementType}
              onValueChange={(v) => setMovementType(v as MovementType)}
            >
              <SelectTrigger>
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
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Source</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select hierarchy — linked campaigns load below.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Destination</CardTitle>
            <p className="text-sm text-muted-foreground">
              Target ownership hierarchy for selected campaigns.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
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
          </CardContent>
        </Card>
      </div>

      <Card className="sticky top-0 z-10 border-primary/20 bg-background/95 backdrop-blur">
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Selected</p>
            <p className="font-semibold">{selected.size} campaigns</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="font-semibold">{formatBillingMoney(selectedRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">GP</p>
            <p className="font-semibold">{formatBillingMoney(selectedGp)}</p>
          </div>
          <Button
            className="ml-auto"
            disabled={selected.size === 0 || isPending}
            onClick={handlePreview}
          >
            Preview & move selected
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Campaign selection</CardTitle>
          <div className="relative w-full max-w-xs">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search campaigns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadCampaigns()}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="size-4 rounded border"
                      checked={campaigns.length > 0 && selected.size === campaigns.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Campaign #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">GP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Live</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground">
                      Select source hierarchy and load campaigns.
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-4 rounded border"
                          checked={selected.has(c.id)}
                          onChange={(e) => toggleOne(c.id, e.target.checked)}
                          aria-label={`Select ${c.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <DocumentNumber value={c.document_number} />
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.group_name ?? "—"}</TableCell>
                      <TableCell>{c.client_name ?? "—"}</TableCell>
                      <TableCell>{c.brand_name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {formatBillingMoney(c.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBillingMoney(c.gp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{c.billing_status}</TableCell>
                      <TableCell className="capitalize">{c.invoice_status.replace("_", " ")}</TableCell>
                      <TableCell>
                        {c.live_date
                          ? format(new Date(c.live_date), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Showing {campaigns.length} of {initialTotal} campaigns
          </p>
        </CardContent>
      </Card>

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
