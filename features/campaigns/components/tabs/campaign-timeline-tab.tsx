"use client";

import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CampaignWorkspace } from "@/features/campaigns/types";

type CampaignTimelineTabProps = {
  workspace: CampaignWorkspace;
};

export function CampaignTimelineTab({ workspace }: CampaignTimelineTabProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Activity feed</CardTitle>
          <p className="text-sm text-muted-foreground">
            Edits, uploads, approvals, status changes, and assignments.
          </p>
        </CardHeader>
        <CardContent>
          {workspace.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {workspace.activity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium capitalize">{item.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.actor?.full_name ?? item.actor?.email ?? "System"}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {workspace.vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vendor assignments.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confirmed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.vendors.slice(0, 10).map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{v.influencer_name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.line_document_number ?? "—"}
                      </TableCell>
                      <TableCell className="capitalize">{v.status}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {v.confirmed_at
                          ? format(new Date(v.confirmed_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
