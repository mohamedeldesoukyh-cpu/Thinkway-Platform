"use client";

import Link from "next/link";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampaignVendorSheet } from "@/features/campaigns/components/campaign-vendor-sheet";
import { CAMPAIGN_VENDOR_STATUS_OPTIONS } from "@/features/campaigns/constants";
import type {
  CampaignVendorAssignment,
  CampaignWorkspace,
} from "@/features/campaigns/types";
import { formatMoney, formatPlatformLabel } from "@/features/campaigns/utils";

type CampaignVendorsTabProps = {
  workspace: CampaignWorkspace;
};

export function CampaignVendorsTab({ workspace }: CampaignVendorsTabProps) {
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignVendorAssignment | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workspace.vendors;
    return workspace.vendors.filter(
      (v) =>
        v.influencer_name.toLowerCase().includes(q) ||
        v.platforms.some((p) => p.handle.toLowerCase().includes(q))
    );
  }, [workspace.vendors, search]);

  function statusLabel(status: string) {
    return (
      CAMPAIGN_VENDOR_STATUS_OPTIONS.find((o) => o.value === status)?.label ??
      status
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Vendors & influencers</CardTitle>
            <p className="text-sm text-muted-foreground">
              Assign creators to lines with pricing, platforms, and engagement stats.
            </p>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setSheetOpen(true); }}>
            <PlusIcon data-icon="inline-start" />
            Assign vendor
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-md">
            <Label htmlFor="vendor_tab_search">Search</Label>
            <Input
              id="vendor_tab_search"
              placeholder="Search by name or handle…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vendor assignments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead className="text-right">Followers</TableHead>
                    <TableHead className="text-right">Eng. rate</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((vendor) => {
                    const primary = vendor.platforms[0];
                    return (
                      <TableRow key={vendor.id}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <Link
                              href={`/vendors/${vendor.influencer_id}`}
                              className="font-medium hover:underline"
                            >
                              {vendor.influencer_name}
                            </Link>
                            <p className="font-mono text-xs text-muted-foreground">
                              {vendor.influencer_document_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {vendor.line_document_number ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {vendor.platforms.length === 0 ? (
                              "—"
                            ) : (
                              vendor.platforms.map((p) => (
                                <div key={`${p.platform}-${p.handle}`} className="text-xs">
                                  {formatPlatformLabel(p.platform)} · @{p.handle}
                                  {p.profile_url ? (
                                    <a
                                      href={p.profile_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-1 underline"
                                    >
                                      URL
                                    </a>
                                  ) : null}
                                </div>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {primary?.follower_count?.toLocaleString() ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {primary?.engagement_rate != null
                            ? `${primary.engagement_rate}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(vendor.agreed_fee, vendor.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {statusLabel(vendor.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(vendor);
                              setSheetOpen(true);
                            }}
                          >
                            <PencilIcon className="size-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CampaignVendorSheet
        campaignId={workspace.id}
        lines={workspace.lines}
        assignment={editing}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
