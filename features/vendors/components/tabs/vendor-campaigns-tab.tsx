import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VendorDetail } from "@/types/database";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function VendorCampaignsTab({ vendor }: { vendor: VendorDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign history</CardTitle>
        <p className="text-sm text-muted-foreground">
          Campaign assignments for this creator.
        </p>
      </CardHeader>
      <CardContent>
        {vendor.campaign_assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not assigned to any campaigns yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Campaign #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agreed fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendor.campaign_assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      {assignment.campaign ? (
                        <Link href="/campaigns" className="hover:underline">
                          {assignment.campaign.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {assignment.campaign?.document_number ?? "—"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {assignment.status.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      {formatMoney(
                        Number(assignment.agreed_fee),
                        assignment.currency
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
