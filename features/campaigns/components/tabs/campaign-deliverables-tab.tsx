"use client";

import { format, isValid, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
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
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import { DeliverableBillingBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-billing-badge";
import { DeliverableWorkflowBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-workflow-badge";
import { SCHEDULE_STATUS_OPTIONS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type {
  OperationalDeliverableExplorerRow,
  OperationalDeliverableFlattenStats,
} from "@/features/campaigns/types/operational-deliverable-explorer";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { flattenOperationalDeliverables } from "@/lib/campaigns/flatten-operational-deliverables";
import { getPlatformOptionLabel } from "@/lib/campaigns/deliverable-taxonomy";

const ALL = "all";

type CampaignDeliverablesTabProps = {
  workspace: CampaignWorkspace;
  assignmentHierarchy: AssignmentHierarchy;
  publications?: CampaignPublicationRow[];
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function CampaignDeliverablesTab({
  workspace,
  assignmentHierarchy,
  publications = [],
}: CampaignDeliverablesTabProps) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState(ALL);
  const [workflowFilter, setWorkflowFilter] = useState(ALL);
  const [billingFilter, setBillingFilter] = useState(ALL);
  const [creatorFilter, setCreatorFilter] = useState(ALL);
  const [publicationFilter, setPublicationFilter] = useState(ALL);

  const { rows, stats } = useMemo(
    () =>
      flattenOperationalDeliverables(
        assignmentHierarchy,
        publications,
        workspace.deliverables ?? []
      ),
    [assignmentHierarchy, publications, workspace.deliverables]
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.log("[deliverables-tab] loaded rows", {
      total: rows.length,
      stats,
      hierarchyGroups: assignmentHierarchy.groups?.length ?? 0,
    });
  }, [rows.length, stats, assignmentHierarchy.groups]);

  const platformOptions = useMemo(
    () => uniqueSorted(rows.map((r) => r.platform)),
    [rows]
  );
  const creatorOptions = useMemo(
    () => uniqueSorted(rows.map((r) => r.creator_name ?? "")),
    [rows]
  );
  const billingOptions = useMemo(
    () => uniqueSorted(rows.map((r) => r.billing_status)),
    [rows]
  );
  const publicationOptions = useMemo(
    () => uniqueSorted(rows.map((r) => r.publication_status ?? "")),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (platformFilter !== ALL && row.platform !== platformFilter) return false;
      if (workflowFilter !== ALL && row.workflow_status !== workflowFilter) return false;
      if (billingFilter !== ALL && row.billing_status !== billingFilter) return false;
      if (creatorFilter !== ALL && (row.creator_name ?? "") !== creatorFilter) return false;
      if (publicationFilter !== ALL) {
        const pub = row.publication_status ?? "none";
        if (publicationFilter === "none" && row.publication_status) return false;
        if (publicationFilter !== "none" && pub !== publicationFilter) return false;
      }
      if (!q) return true;
      return row.search_text.includes(q);
    });
  }, [
    rows,
    search,
    platformFilter,
    workflowFilter,
    billingFilter,
    creatorFilter,
    publicationFilter,
  ]);

  const emptyMessage =
    rows.length === 0
      ? "No deliverables yet. Create an assignment first, then add deliverables under that assignment in the Assignments tab."
      : "No deliverables match the current search and filters.";

  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <CampaignOperationalSectionHeader
          title="Deliverables"
          description="Operational explorer — synced from assignment deliverables and post schedules."
        />
      }
      toolbar={
        <div className="space-y-3">
          {stats.hierarchy_load_error ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Hierarchy loaded with warnings: {stats.hierarchy_load_error}
            </div>
          ) : null}
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Displaying {filtered.length} of {rows.length}
          </p>
          <div className="grid gap-2">
            <Label htmlFor="deliverable_search">Search</Label>
            <Input
              id="deliverable_search"
              placeholder="Creator, platform, type, assignment, notes, workflow…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <FilterSelect
            label="Platform"
            value={platformFilter}
            onValueChange={setPlatformFilter}
            options={platformOptions.map((p) => ({
              value: p,
              label: getPlatformOptionLabel(p),
            }))}
          />
          <FilterSelect
            label="Workflow"
            value={workflowFilter}
            onValueChange={setWorkflowFilter}
            options={SCHEDULE_STATUS_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
          />
          <FilterSelect
            label="Billing"
            value={billingFilter}
            onValueChange={setBillingFilter}
            options={billingOptions.map((b) => ({
              value: b,
              label: b.replace(/_/g, " "),
            }))}
          />
          <FilterSelect
            label="Creator"
            value={creatorFilter}
            onValueChange={setCreatorFilter}
            options={creatorOptions.map((c) => ({ value: c, label: c }))}
          />
          <FilterSelect
            label="Publication"
            value={publicationFilter}
            onValueChange={setPublicationFilter}
            options={[
              ...publicationOptions.map((p) => ({
                value: p,
                label: p.replace(/_/g, " "),
              })),
              { value: "none", label: "No publication" },
            ]}
          />
          </div>
        </div>
      }
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <CampaignOperationalTable>
            <CampaignOperationalTableHeader>
              <CampaignOperationalTableHeaderRow>
                <CampaignOperationalTableHead>Deliverable</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Type</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Creator</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Platform</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Due</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Status</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Content</CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="text-right">Billing</CampaignOperationalTableHead>
              </CampaignOperationalTableHeaderRow>
            </CampaignOperationalTableHeader>
            <CampaignOperationalTableBody>
              {filtered.map((row) => (
                <OperationalExplorerRow key={row.id} row={row} stats={stats} />
              ))}
            </CampaignOperationalTableBody>
          </CampaignOperationalTable>
      )}
    </OperationalTableSection>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 w-full">
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function OperationalExplorerRow({
  row,
}: {
  row: OperationalDeliverableExplorerRow;
  stats: OperationalDeliverableFlattenStats;
}) {
  return (
    <CampaignOperationalTableRow>
      <CampaignOperationalTableCell>
        <div className="space-y-0.5">
          <span className="font-medium">{row.label}</span>
          <p className="text-[11px] text-muted-foreground">
            {row.assignment_title}
            {row.sequence_number != null ? ` · #${row.sequence_number}` : null}
          </p>
        </div>
      </CampaignOperationalTableCell>
      <CampaignOperationalTableCell>
        <Badge variant="outline" className="text-[10px] font-normal">
          {row.deliverable_type_label}
        </Badge>
      </CampaignOperationalTableCell>
      <CampaignOperationalTableCell>{row.creator_name ?? "—"}</CampaignOperationalTableCell>
      <CampaignOperationalTableCell>{row.platform_label}</CampaignOperationalTableCell>
      <CampaignOperationalTableCell className="text-muted-foreground">
        {safeFormatDate(row.live_date)}
      </CampaignOperationalTableCell>
      <CampaignOperationalTableCell>
        <DeliverableWorkflowBadge status={row.workflow_status} />
      </CampaignOperationalTableCell>
      <CampaignOperationalTableCell>
        {row.notes ? (
          <span className="line-clamp-2 text-[11px] text-muted-foreground">{row.notes}</span>
        ) : row.publication_status ? (
          <Badge variant="secondary" className="text-[10px] capitalize">
            {row.publication_status.replace(/_/g, " ")}
          </Badge>
        ) : (
          "—"
        )}
      </CampaignOperationalTableCell>
      <CampaignOperationalTableCell className="text-right">
        {row.billing_status === "legacy" ? (
          <Badge variant="outline" className="text-[10px]">
            Legacy
          </Badge>
        ) : (
          <DeliverableBillingBadge
            status={row.billing_status as AssignmentDeliverableBillingStatus}
          />
        )}
      </CampaignOperationalTableCell>
    </CampaignOperationalTableRow>
  );
}
