"use client";

import { format, isValid, parseISO } from "date-fns";
import { DownloadIcon, FilterIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampaignPublicationSheet } from "@/features/campaigns/components/campaign-publication-sheet";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import type { CampaignLineWorkspace, CampaignWorkspace } from "@/features/campaigns/types";

const ALL_STATUSES = "all";

type CampaignPublicationsTabProps = {
  workspace: CampaignWorkspace;
  publications: CampaignPublicationRow[];
  loadError?: string | null;
};

function safeFormatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = parseISO(value.includes("T") ? value : `${value}T00:00:00`);
  if (!isValid(parsed)) return "—";
  try {
    return format(parsed, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

export function CampaignPublicationsTab({
  workspace,
  publications,
  loadError,
}: CampaignPublicationsTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [sheetOpen, setSheetOpen] = useState(false);

  const rows = publications ?? [];
  const lines = (workspace.lines ?? []).filter((l) => l.influencer_id);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== ALL_STATUSES && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (row.influencer_name ?? "").toLowerCase().includes(q) ||
        (row.content_url ?? "").toLowerCase().includes(q) ||
        (row.publication_type_label ?? "").toLowerCase().includes(q) ||
        (row.caption ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  function exportCsv() {
    const header = [
      "Type",
      "Content URL",
      "Creator",
      "Status",
      "Publication date",
      "Platform",
      "Notes",
    ];
    const body = filtered.map((r) => [
      r.publication_type_label,
      r.content_url ?? "",
      r.influencer_name ?? "",
      r.status,
      r.publication_date ?? "",
      r.platform_label,
      r.notes ?? "",
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workspace.document_number}-publications.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Publications</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manual URL tracking for live influencer content.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <DownloadIcon data-icon="inline-start" className="size-3.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => setSheetOpen(true)} disabled={lines.length === 0}>
              <PlusIcon data-icon="inline-start" />
              Add publication
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Publications data could not be loaded fully. Apply migration{" "}
              <code className="font-mono">20260531400000_campaign_publications.sql</code>.{" "}
              {loadError}
            </div>
          ) : null}

          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Displaying {filtered.length} of {rows.length}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pub_search">
                <SearchIcon className="mr-1 inline size-3.5" />
                Search
              </Label>
              <Input
                id="pub_search"
                placeholder="Creator, URL, caption…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>
                <FilterIcon className="mr-1 inline size-3.5" />
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No publications found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Publication date</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-medium">{row.publication_type_label}</span>
                          <p className="text-[10px] text-muted-foreground">{row.platform_label}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.content_url ? (
                          <a
                            href={row.content_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="line-clamp-2 text-xs underline"
                          >
                            {row.content_url}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{row.influencer_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {row.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {safeFormatDate(row.publication_date)}
                      </TableCell>
                      <TableCell>{row.assignee_name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {row.content_url ? (
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                            <a href={row.content_url} target="_blank" rel="noopener noreferrer">
                              Open
                            </a>
                          </Button>
                        ) : (
                          "—"
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

      <CampaignPublicationSheet
        campaignId={workspace.id}
        assignmentLines={lines}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
