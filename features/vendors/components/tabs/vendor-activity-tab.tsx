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
import type { VendorWorkspace } from "@/features/vendors/types";

export function VendorActivityTab({ workspace }: { workspace: VendorWorkspace }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Activity & audit</CardTitle>
          <p className="text-sm text-muted-foreground">
            Profile edits, assignments, and operational changes.
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
          <CardTitle>Recent deliverables</CardTitle>
        </CardHeader>
        <CardContent>
          {workspace.deliverables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliverables.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deliverable</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.deliverables.slice(0, 10).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <span className="font-medium">{d.title}</span>
                        <p className="font-mono text-xs text-muted-foreground">
                          {d.document_number}
                        </p>
                      </TableCell>
                      <TableCell>{d.campaign_name ?? "—"}</TableCell>
                      <TableCell className="capitalize">
                        {d.status.replace(/_/g, " ")}
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
