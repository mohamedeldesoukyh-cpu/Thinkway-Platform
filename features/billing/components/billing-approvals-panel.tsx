"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

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
import {
  decideFinancialApprovalAction,
  type BillingActionState,
} from "@/features/billing/actions";
import { FINANCIAL_APPROVAL_STAGE_LABELS } from "@/features/billing/constants";
import type { FinancialApprovalRow } from "@/features/billing/types";

type BillingApprovalsPanelProps = {
  approvals: FinancialApprovalRow[];
};

export function BillingApprovalsPanel({ approvals }: BillingApprovalsPanelProps) {
  if (approvals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Financial approvals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pending approvals.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Financial approvals</CardTitle>
        <p className="text-sm text-muted-foreground">
          Campaign Manager → Finance → CFO/Admin
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((approval) => (
                <ApprovalRow key={approval.id} approval={approval} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovalRow({ approval }: { approval: FinancialApprovalRow }) {
  const [state, formAction, pending] = useActionState(
    decideFinancialApprovalAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{approval.title}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {approval.document_number}
        </p>
      </TableCell>
      <TableCell>
        {FINANCIAL_APPROVAL_STAGE_LABELS[approval.approval_stage]}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {approval.assigned_to_name ?? "Unassigned"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <form action={formAction}>
            <input type="hidden" name="approval_id" value={approval.id} />
            <input type="hidden" name="decision" value="approved" />
            <Button type="submit" size="sm" disabled={pending}>
              Approve
            </Button>
          </form>
          <form action={formAction}>
            <input type="hidden" name="approval_id" value={approval.id} />
            <input type="hidden" name="decision" value="rejected" />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              Reject
            </Button>
          </form>
        </div>
      </TableCell>
    </TableRow>
  );
}
