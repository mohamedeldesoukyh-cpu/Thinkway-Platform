"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampaignLineSheet } from "@/features/campaigns/components/campaign-line-sheet";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import {
  LINE_BILLING_STATUS_LABELS,
  LINE_PAYMENT_STATUS_LABELS,
} from "@/features/campaigns/constants";
import type { CampaignLineWorkspace, CampaignWorkspace } from "@/features/campaigns/types";
import {
  formatMoney,
  formatPercent,
  formatPlatformLabel,
} from "@/features/campaigns/utils";

type CampaignLinesTabProps = {
  workspace: CampaignWorkspace;
};

export function CampaignLinesTab({ workspace }: CampaignLinesTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignLineWorkspace | null>(null);
  const currency = workspace.currency_code;

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(line: CampaignLineWorkspace) {
    setEditing(line);
    setSheetOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Campaign lines</CardTitle>
            <p className="text-sm text-muted-foreground">
              Multi-line PO tracking with platform, financials, and billing status.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Add line
          </Button>
        </CardHeader>
        <CardContent>
          {workspace.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lines yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Influencers</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">GP</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">PO</TableHead>
                    <TableHead className="text-right">Remaining PO</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-medium">{line.name}</span>
                          <p className="font-mono text-xs text-muted-foreground">
                            {line.document_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{formatPlatformLabel(line.platform)}</TableCell>
                      <TableCell className="text-right">
                        {line.influencer_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(line.revenue, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(line.cost, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(line.gp, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(line.margin_percent)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(line.po_amount, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(line.remaining_po, currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {LINE_BILLING_STATUS_LABELS[line.billing_status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {LINE_PAYMENT_STATUS_LABELS[line.payment_status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <CampaignStatusBadge status={line.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(line)}
                        >
                          <PencilIcon className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CampaignLineSheet
        campaignId={workspace.id}
        currencyCode={workspace.currency_code}
        line={editing}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
