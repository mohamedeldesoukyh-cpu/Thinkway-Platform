import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeftIcon } from "lucide-react";

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
import type { VendorDetail } from "@/types/database";

import {
  formatCategoriesList,
  formatFollowers,
  formatPlatformLabel,
  formatPricing,
} from "../utils";
import { VendorStatusBadge } from "./vendor-status-badge";

type VendorProfileProps = {
  vendor: VendorDetail;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function VendorProfile({ vendor }: VendorProfileProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
            <Link href="/vendors">
              <ArrowLeftIcon data-icon="inline-start" />
              Back to vendors
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {vendor.display_name}
            </h2>
            <VendorStatusBadge status={vendor.status} />
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            {vendor.document_number}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contact & details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Agency" value={vendor.legal_name ?? "—"} />
            <DetailItem label="Email" value={vendor.email ?? "—"} />
            <DetailItem label="Phone" value={vendor.phone ?? "—"} />
            <DetailItem label="Country" value={vendor.country_code ?? "—"} />
            <DetailItem
              label="Category / niche"
              value={formatCategoriesList(vendor.categories)}
            />
            <DetailItem label="Pricing" value={formatPricing(vendor.rate_card)} />
            <DetailItem
              label="Created"
              value={format(new Date(vendor.created_at), "MMM d, yyyy")}
              className="sm:col-span-2"
            />
            {vendor.notes ? (
              <DetailItem
                label="Notes"
                value={vendor.notes}
                className="sm:col-span-2"
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            {vendor.platform_accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No platform accounts linked yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {vendor.platform_accounts.map((account) => (
                  <li
                    key={account.id}
                    className="rounded-3xl border border-border px-3 py-2"
                  >
                    <p className="font-medium">
                      {formatPlatformLabel(account.platform)}
                      {account.is_primary ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Primary
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      @{account.handle.replace(/^@/, "")}
                    </p>
                    <p className="text-sm">
                      {formatFollowers(Number(account.follower_count))} followers
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign assignments</CardTitle>
          <p className="text-sm text-muted-foreground">
            Campaign assignments link this vendor to active campaigns.
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
                    <TableHead>Assignment status</TableHead>
                    <TableHead>Agreed fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendor.campaign_assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {assignment.campaign ? (
                          <Link
                            href={`/campaigns`}
                            className="hover:underline"
                          >
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
    </div>
  );
}

function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
