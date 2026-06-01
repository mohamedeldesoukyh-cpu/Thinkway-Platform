"use client";

import { PencilIcon, PlusIcon, UserIcon } from "lucide-react";
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
import { AssignmentStatusBadge } from "@/features/campaigns/components/assignment-status-badge";
import { CampaignLineSheet } from "@/features/campaigns/components/campaign-line-sheet";
import {
  LINE_BILLING_STATUS_LABELS,
  VENDOR_PAYMENT_STATUS_LABELS,
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
            <CardTitle>Creator assignments</CardTitle>
            <p className="text-sm text-muted-foreground">
              Single operational workflow — influencer, platforms, deliverables,
              billing, and creator payout on one assignment line.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Assign influencer
          </Button>
        </CardHeader>
        <CardContent>
          {workspace.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No creator assignments yet. Search for an influencer to build the
              first assignment package.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Influencer</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead className="text-right">Deliverables</TableHead>
                    <TableHead>Ops status</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">GP</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Creator payout</TableHead>
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
                      <TableCell>
                        {line.influencer_name ? (
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="size-3.5 text-muted-foreground" />
                            <span>{line.influencer_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {line.platform_summary ??
                            formatPlatformLabel(line.platform)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {line.deliverable_count || "—"}
                      </TableCell>
                      <TableCell>
                        <AssignmentStatusBadge status={line.assignment_status} />
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
                      <TableCell>
                        <Badge variant="outline">
                          {LINE_BILLING_STATUS_LABELS[line.billing_status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {line.vendor_payment_status ? (
                          <Badge variant="secondary">
                            {VENDOR_PAYMENT_STATUS_LABELS[line.vendor_payment_status]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
        defaultRevenueVatPercent={workspace.vat_context.default_revenue_vat_percent}
        clientCountryCode={workspace.vat_context.client_country_code}
        line={editing}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
