"use client";

import { format } from "date-fns";
import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  updateDeliverableStatusAction,
  type FormActionState,
} from "@/features/campaigns/actions";
import { CampaignDeliverableSheet } from "@/features/campaigns/components/campaign-deliverable-sheet";
import {
  DELIVERABLE_DISPLAY_STATUS_OPTIONS,
  DELIVERABLE_TYPE_OPTIONS,
} from "@/features/campaigns/constants";
import type { CampaignDeliverableRow, CampaignWorkspace } from "@/features/campaigns/types";
import { formatPlatformLabel } from "@/features/campaigns/utils";
import { labelForOption } from "@/lib/master-data/constants";

type CampaignDeliverablesTabProps = {
  workspace: CampaignWorkspace;
};

export function CampaignDeliverablesTab({ workspace }: CampaignDeliverablesTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspace.deliverables.filter((d) => {
      if (statusFilter && d.display_status !== statusFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.influencer_name.toLowerCase().includes(q)
      );
    });
  }, [workspace.deliverables, search, statusFilter]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Deliverables</CardTitle>
            <p className="text-sm text-muted-foreground">
              Posts, reels, stories, TikTok, and YouTube integrations.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setSheetOpen(true)}
            disabled={workspace.vendors.length === 0}
          >
            <PlusIcon data-icon="inline-start" />
            Add deliverable
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="deliverable_search">Search</Label>
              <Input
                id="deliverable_search"
                placeholder="Title or vendor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  {DELIVERABLE_DISPLAY_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliverables found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deliverable</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead className="text-right">Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <DeliverableRow
                      key={d.id}
                      deliverable={d}
                      campaignId={workspace.id}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CampaignDeliverableSheet
        campaignId={workspace.id}
        vendors={workspace.vendors}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}

function DeliverableRow({
  deliverable,
  campaignId,
}: {
  deliverable: CampaignDeliverableRow;
  campaignId: string;
}) {
  const [status, setStatus] = useState(deliverable.status);
  const [state, action, isPending] = useActionState(updateDeliverableStatusAction, {
    ok: false,
  } satisfies FormActionState);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  const displayLabel =
    DELIVERABLE_DISPLAY_STATUS_OPTIONS.find(
      (o) => o.value === deliverable.display_status
    )?.label ?? deliverable.display_status;

  return (
    <TableRow>
      <TableCell>
        <div className="space-y-0.5">
          <span className="font-medium">{deliverable.title}</span>
          <p className="font-mono text-xs text-muted-foreground">
            {deliverable.document_number}
          </p>
        </div>
      </TableCell>
      <TableCell>
        {labelForOption(DELIVERABLE_TYPE_OPTIONS, deliverable.deliverable_type)}
      </TableCell>
      <TableCell>{deliverable.influencer_name}</TableCell>
      <TableCell>{formatPlatformLabel(deliverable.platform)}</TableCell>
      <TableCell className="text-muted-foreground">
        {deliverable.due_date
          ? format(new Date(deliverable.due_date), "MMM d, yyyy")
          : "—"}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{displayLabel}</Badge>
      </TableCell>
      <TableCell>
        {deliverable.content_url ? (
          <a
            href={deliverable.content_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline"
          >
            View
          </a>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-right">
        <form action={action} className="inline-flex gap-1">
          <input type="hidden" name="deliverable_id" value={deliverable.id} />
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="status" value={status} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[130px]" disabled={isPending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="published">Posted</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" variant="outline" disabled={isPending}>
            Save
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}
