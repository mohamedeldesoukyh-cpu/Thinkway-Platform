import Link from "next/link";
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
import type { ClientDetail } from "@/types/database";

export function ClientCampaignsTab({ client }: { client: ClientDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign history</CardTitle>
        <p className="text-sm text-muted-foreground">
          Campaign headers linked to brands under this legal entity.
        </p>
      </CardHeader>
      <CardContent>
        {client.campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No campaigns yet for this client.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Campaign #</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Dates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">
                      <Link href="/campaigns" className="hover:underline">
                        {campaign.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {campaign.document_number}
                    </TableCell>
                    <TableCell>
                      {(campaign.brand as { name: string } | null)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {campaign.status.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>{campaign.currency_code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign.start_date
                        ? format(new Date(campaign.start_date), "MMM d, yyyy")
                        : "—"}
                      {" — "}
                      {campaign.end_date
                        ? format(new Date(campaign.end_date), "MMM d, yyyy")
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
  );
}
