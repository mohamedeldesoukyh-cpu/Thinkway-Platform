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
import type { GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney } from "@/features/groups/utils";

type GroupActivityTabProps = {
  workspace: GroupWorkspace;
};

export function GroupActivityTab({ workspace }: GroupActivityTabProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Activity & audit</CardTitle>
          <p className="text-sm text-muted-foreground">
            Entity creation, edits, and changes across this group portfolio.
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
          <CardTitle>Recent campaigns</CardTitle>
          <p className="text-sm text-muted-foreground">
            Latest campaign headers linked to brands in this group.
          </p>
        </CardHeader>
        <CardContent>
          {workspace.recent_campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.recent_campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-medium">{campaign.name}</span>
                          <p className="font-mono text-xs text-muted-foreground">
                            {campaign.document_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{campaign.brand_name ?? "—"}</TableCell>
                      <TableCell className="capitalize">{campaign.status}</TableCell>
                      <TableCell className="text-right">
                        {formatGroupMoney(campaign.revenue)}
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
