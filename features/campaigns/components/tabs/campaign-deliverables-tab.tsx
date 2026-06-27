"use client";

import { format, isValid, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DeliverableExplorerBillingBadge,
  DeliverableExplorerCreatorCell,
  DeliverableExplorerPlatformPill,
  DeliverableExplorerTypePill,
  DeliverableExplorerWorkflowBadge,
} from "@/features/campaigns/components/deliverables/deliverable-explorer-cells";
import { SCHEDULE_STATUS_OPTIONS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { OperationalDeliverableExplorerRow } from "@/features/campaigns/types/operational-deliverable-explorer";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { DeliverableDetailSheet } from "@/features/campaigns/components/detail-sheets/deliverable-detail-sheet";
import { flattenOperationalDeliverables } from "@/lib/campaigns/flatten-operational-deliverables";
import { getPlatformOptionLabel } from "@/lib/campaigns/deliverable-taxonomy";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

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

function buildDeliverablesColumns(
  onOpenDetail: (id: string) => void
): OperationalConfigurableColumnDef<OperationalDeliverableExplorerRow>[] {
  return [
    {
      id: "deliverable",
      label: "Deliverable",
      renderCell: (row) => (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onOpenDetail(row.id)}
            title={`View ${row.label} details`}
            className="text-left text-[11px] font-semibold text-[var(--camp-text)] transition-colors hover:text-[var(--camp-blue)]"
          >
            {row.label}
          </button>
          <p className="text-[10px] text-[var(--camp-text-3)]">
            {row.creator_name ?? "Unknown creator"}
            {row.assignment_title ? ` — ${row.assignment_title}` : null}
          </p>
        </div>
      ),
    },
    {
      id: "type",
      label: "Type",
      renderCell: (row) => (
        <DeliverableExplorerTypePill
          platform={row.platform}
          deliverableType={row.deliverable_type}
        />
      ),
    },
    {
      id: "creator",
      label: "Creator",
      renderCell: (row) => (
        <DeliverableExplorerCreatorCell
          name={row.creator_name}
          avatarUrl={row.creator_avatar_url}
        />
      ),
    },
    {
      id: "platform",
      label: "Platform",
      renderCell: (row) => <DeliverableExplorerPlatformPill platform={row.platform} />,
    },
    {
      id: "due",
      label: "Due",
      renderCell: (row) => (
        <span className="thinkway-campaign-cell-muted">{safeFormatDate(row.live_date)}</span>
      ),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (row) => <DeliverableExplorerWorkflowBadge status={row.workflow_status} />,
    },
    {
      id: "content",
      label: "Content",
      renderCell: (row) =>
        row.notes ? (
          <span className="line-clamp-2 text-[11px] text-[var(--camp-text-3)]">{row.notes}</span>
        ) : row.publication_status ? (
          <span className="thinkway-campaign-badge thinkway-campaign-badge-gray capitalize">
            {row.publication_status.replace(/_/g, " ")}
          </span>
        ) : (
          <span className="thinkway-campaign-c-gray">—</span>
        ),
    },
    {
      id: "billing",
      label: "Billing",
      renderCell: (row) => <DeliverableExplorerBillingBadge status={row.billing_status} />,
    },
  ];
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
  const [detailDeliverableId, setDetailDeliverableId] = useState<string | null>(null);

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

  const columns = useMemo(
    () => buildDeliverablesColumns(setDetailDeliverableId),
    []
  );
  const columnMetas = useMemo(() => getOperationalTableColumnMetas(columns), [columns]);

  const detailRow = useMemo(
    () =>
      detailDeliverableId
        ? (rows.find((row) => row.id === detailDeliverableId) ?? null)
        : null,
    [detailDeliverableId, rows]
  );

  const emptyMessage =
    rows.length === 0
      ? "No deliverables yet. Create an assignment first, then add deliverables under that assignment in the Assignments tab."
      : "No deliverables match the current search and filters.";

  return (
    <>
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.campaignDeliverables}
        columns={columns}
        rows={filtered}
        filterAccessors={{
          deliverable: (row) => row.label,
          type: (row) => row.deliverable_type_label,
          creator: (row) => row.creator_name,
          platform: (row) => row.platform_label ?? row.platform,
          due: (row) => row.live_date,
          status: (row) => row.workflow_status,
          content: (row) => row.notes ?? row.publication_status,
          billing: (row) => row.billing_status,
        }}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Deliverables"
              countLabel={`${filtered.length} of ${rows.length}`}
              description="Operational explorer — synced from assignment deliverables and post schedules."
              actions={<OperationalTableControlsSlot contextLabel="Campaign deliverables" />}
            />
          }
          toolbar={
            <>
              {stats.hierarchy_load_error ? (
                <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
                  Hierarchy loaded with warnings: {stats.hierarchy_load_error}
                </div>
              ) : null}
              <div className="space-y-2.5">
                <div className="thinkway-campaign-search-box !max-w-[400px]">
                  <SearchIcon className="thinkway-campaign-search-ico size-3" aria-hidden />
                  <input
                    id="deliverable_search"
                    type="search"
                    placeholder="Creator, platform, type, assignment, notes, workflow…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
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
            </>
          }
        >
          {filtered.length === 0 ? (
            <div className="thinkway-campaign-empty-state">
              <p>{emptyMessage}</p>
            </div>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={filtered}
              rowKey={(row) => row.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <DeliverableDetailSheet
        open={detailDeliverableId != null}
        onOpenChange={(open) => {
          if (!open) setDetailDeliverableId(null);
        }}
        row={detailRow}
        campaignName={workspace.name}
      />
    </>
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
  const selectedLabel =
    value === ALL ? "All" : (options.find((opt) => opt.value === value)?.label ?? value);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "thinkway-campaign-filter-select h-[30px] w-auto min-w-[110px] border-[var(--camp-border)] shadow-none",
          "text-[11px] text-[var(--camp-text)] [&>svg]:opacity-50"
        )}
      >
        <span className="truncate">
          {label} · {selectedLabel}
        </span>
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
  );
}
