"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { executeVendorMovementAction } from "@/features/operations/actions";
import type {
  HierarchyOption,
  VendorMovementAssignmentRow,
} from "@/features/operations/types";
import { formatBillingMoney } from "@/features/billing/utils";

type VendorMovementWorkspaceProps = {
  vendors: HierarchyOption[];
  initialSourceVendorId?: string;
  initialAssignments: VendorMovementAssignmentRow[];
};

export function VendorMovementWorkspace({
  vendors,
  initialSourceVendorId = "",
  initialAssignments,
}: VendorMovementWorkspaceProps) {
  const [sourceVendorId, setSourceVendorId] = useState(initialSourceVendorId);
  const [destVendorId, setDestVendorId] = useState("");
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const vendorOptions = vendors.map((v) => ({
    value: v.id,
    label: v.sublabel ? `${v.label} (${v.sublabel})` : v.label,
  }));

  const destOptions = vendorOptions.filter((v) => v.value !== sourceVendorId);

  useEffect(() => {
    if (!sourceVendorId) {
      setAssignments([]);
      setSelected(new Set());
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/operations/vendors/${sourceVendorId}/assignments`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        assignments?: VendorMovementAssignmentRow[];
      };
      setAssignments(data.assignments ?? []);
      setSelected(new Set());
    });
  }, [sourceVendorId]);

  const selectedRows = assignments.filter((a) => selected.has(a.id));
  const selectedRevenue = selectedRows.reduce((s, a) => s + a.revenue, 0);

  const toggleAll = (checked: boolean) => {
    setSelected(
      checked ? new Set(assignments.map((a) => a.id)) : new Set()
    );
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const onExecute = () => {
    if (!sourceVendorId || !destVendorId || selected.size === 0) {
      toast.error("Select source, destination, and at least one assignment.");
      return;
    }
    const fd = new FormData();
    fd.set("movement_type", "vendor_to_vendor");
    fd.set("source_influencer_id", sourceVendorId);
    fd.set("destination_influencer_id", destVendorId);
    fd.set("assignment_ids", [...selected].join(","));
    fd.set("reason", reason);

    startTransition(async () => {
      const result = await executeVendorMovementAction({ ok: false }, fd);
      if (result.ok) {
        toast.success(result.message);
        setSelected(new Set());
        setReason("");
      } else {
        toast.error(result.message ?? "Movement failed.");
      }
    });
  };

  const filtered = useMemo(() => assignments, [assignments]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Vendor → Vendor reassignment</CardTitle>
          <p className="text-sm text-muted-foreground">
            Transfer campaign assignments between creators. Preserves campaign
            numbering, invoice linkage, audit history, and payment records.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Source vendor</Label>
            <SearchableSelect
              value={sourceVendorId}
              onValueChange={setSourceVendorId}
              options={vendorOptions}
              placeholder="Select source creator"
            />
          </div>
          <div className="grid gap-2">
            <Label>Destination vendor</Label>
            <SearchableSelect
              value={destVendorId}
              onValueChange={setDestVendorId}
              options={destOptions}
              placeholder="Select destination creator"
              disabled={!sourceVendorId}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignments to move</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Select a source vendor to load assignments.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="size-4 rounded border"
                        checked={selected.size === filtered.length}
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                    </TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead>Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-4 rounded border"
                          checked={selected.has(a.id)}
                          onChange={(e) => toggleOne(a.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{a.campaign_name}</span>
                          <p className="font-mono text-xs text-muted-foreground">
                            {a.campaign_document_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {a.line_document_number ?? "—"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {a.billing_status?.replace(/_/g, " ") ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBillingMoney(a.revenue)}
                      </TableCell>
                      <TableCell className="capitalize">
                        {a.vendor_payment_status ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-muted-foreground">
            Selected: {selected.size} assignment(s) ·{" "}
            {formatBillingMoney(selectedRevenue)} revenue
          </p>
          <div className="grid gap-2">
            <Label htmlFor="vendor_move_reason">Reason *</Label>
            <Textarea
              id="vendor_move_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Operational reason for reassignment (min 3 characters)"
              rows={3}
            />
          </div>
          <Button
            onClick={onExecute}
            disabled={
              isPending ||
              !sourceVendorId ||
              !destVendorId ||
              selected.size === 0 ||
              reason.trim().length < 3
            }
          >
            {isPending ? "Executing…" : "Execute vendor reassignment"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
