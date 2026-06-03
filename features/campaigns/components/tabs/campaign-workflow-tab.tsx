"use client";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WORKFLOW_STAGE_OPTIONS } from "@/features/campaigns/constants";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { cn } from "@/lib/utils";

type CampaignWorkflowTabProps = {
  workspace: CampaignWorkspace;
};

export function CampaignWorkflowTab({ workspace }: CampaignWorkflowTabProps) {
  const currentIndex = WORKFLOW_STAGE_OPTIONS.findIndex(
    (s) => s.value === workspace.workflow_stage
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workflow stages</CardTitle>
          <p className="text-sm text-muted-foreground">
            Planning through closed — derived from assignment status and billing.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {WORKFLOW_STAGE_OPTIONS.map((stage, index) => {
              const isCurrent = stage.value === workspace.workflow_stage;
              const isPast = index < currentIndex;
              return (
                <div
                  key={stage.value}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    isPast && !isCurrent && "border-primary/40 bg-primary/5",
                    !isCurrent && !isPast && "border-border text-muted-foreground"
                  )}
                >
                  {stage.label}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {workspace.blockers.length > 0 ? (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Blockers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {workspace.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {workspace.approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approval records.</p>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Approval</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.approvals.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-medium">{a.title}</span>
                          <p className="font-mono text-xs text-muted-foreground">
                            {a.document_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{a.entity_type}</TableCell>
                      <TableCell>{a.assigned_to_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {a.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.due_at
                          ? format(new Date(a.due_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
