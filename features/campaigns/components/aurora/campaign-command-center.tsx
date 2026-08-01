"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronDownIcon, LayoutGridIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampaignSectionHead } from "@/features/campaigns/components/aurora/campaign-tab-layout";
import {
  CampaignOpsCard,
  CampaignOpsStat,
} from "@/features/campaigns/components/aurora/campaign-ops-card";
import { CampaignOperationalReadinessChecklist } from "@/features/campaigns/components/campaign-operational-readiness-checklist";
import { CampaignHeaderInlineEditor } from "@/features/campaigns/components/campaign-header-inline-editor";
import { CampaignOverviewDetails } from "@/features/campaigns/components/campaign-overview-details";
import { CampaignPoSection } from "@/features/campaigns/components/campaign-po-section";
import { CampaignIntelligenceReference } from "@/features/campaigns/components/campaign-intelligence-reference";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import { evaluateCampaignOperationalReadiness } from "@/lib/domains/commercial/campaign-operational-readiness";
import type { CampaignPerformanceSummary } from "@/lib/domains/campaign/types";
import { PO_STATUS_LABELS } from "@/lib/finance/po/status";
import { cn } from "@/lib/utils";

const WORKFLOW_STAGES = [
  "planning",
  "negotiation",
  "live",
  "completed",
  "invoicing",
  "closed",
] as const;

const WORKFLOW_LABELS: Record<(typeof WORKFLOW_STAGES)[number], string> = {
  planning: "Planning",
  negotiation: "Negotiation",
  live: "Live",
  completed: "Completed",
  invoicing: "Invoicing",
  closed: "Closed",
};

type CampaignCommandCenterProps = {
  workspace: CampaignWorkspace;
  assignmentHierarchy: AssignmentHierarchy;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  currencyOptions: { value: string; label: string }[];
  performanceSummary?: CampaignPerformanceSummary | null;
  performanceLoaded?: boolean;
  onNavigateToTab: (tab: CampaignWorkspaceTabId) => void;
  onOpenDetails?: () => void;
};

function pill(tone: "green" | "blue" | "amber" | "rose" | "mut", label: string) {
  return (
    <span
      className={cn(
        "thinkway-aurora-pill h-5 text-[10.5px]",
        tone === "green" && "thinkway-aurora-pill-green",
        tone === "blue" && "thinkway-aurora-pill-blue",
        tone === "amber" && "thinkway-aurora-pill-amber",
        tone === "rose" && "thinkway-aurora-pill-rose",
        tone === "mut" && "thinkway-aurora-pill-mut"
      )}
    >
      {label}
    </span>
  );
}

function clientIoTone(status: string | undefined): "green" | "blue" | "amber" | "rose" | "mut" {
  if (status === "approved") return "green";
  if (status === "rejected") return "rose";
  if (status === "sent" || status === "under_client_review") return "blue";
  if (status === "generated") return "amber";
  return "mut";
}

/** Overview command center — live operational dashboard; workspaces open on demand. */
export function CampaignCommandCenter({
  workspace,
  assignmentHierarchy,
  accountManagers,
  currencyOptions,
  performanceSummary,
  performanceLoaded = false,
  onNavigateToTab,
  onOpenDetails,
}: CampaignCommandCenterProps) {
  const [inlineEditing, setInlineEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const currency = workspace.currency_code;
  const { financials } = workspace;

  const readiness = useMemo(
    () => evaluateCampaignOperationalReadiness(workspace, assignmentHierarchy),
    [workspace, assignmentHierarchy]
  );

  const assignmentStats = useMemo(() => {
    const total = workspace.lines.length;
    const withVendor = workspace.lines.filter(
      (line) =>
        Boolean(line.influencer_id?.trim()) ||
        Boolean(line.campaign_influencer_id?.trim())
    ).length;
    const confirmed = workspace.lines.filter((line) =>
      ["approved", "scheduled", "posted", "verified", "invoiced", "paid", "closed"].includes(
        line.assignment_status
      )
    ).length;
    return { total, withVendor, confirmed };
  }, [workspace.lines]);

  const vendorIoStats = useMemo(() => {
    const rows = workspace.vendor_ios ?? [];
    return {
      total: rows.length,
      sent: rows.filter((r) => r.status === "sent" || r.delivery_status === "sent").length,
      approved: rows.filter((r) => r.status === "approved").length,
      generated: rows.filter((r) => r.status === "generated" || r.status === "draft").length,
    };
  }, [workspace.vendor_ios]);

  const deliverableStats = useMemo(() => {
    if (assignmentHierarchy.groups.length > 0) {
      let total = 0;
      let posted = 0;
      for (const group of assignmentHierarchy.groups) {
        for (const deliverable of group.deliverables ?? []) {
          total += 1;
          const posts = deliverable.posts ?? [];
          const isPosted =
            Boolean(deliverable.live_date) ||
            deliverable.workflow_status === "posted" ||
            posts.some((p) => p.live_date || p.workflow_status === "posted");
          if (isPosted) posted += 1;
        }
      }
      return { total, posted, pending: Math.max(0, total - posted) };
    }

    const fromWorkspace = workspace.deliverables ?? [];
    const total = fromWorkspace.length;
    const posted = fromWorkspace.filter((d) => d.display_status === "posted").length;
    return { total, posted, pending: Math.max(0, total - posted) };
  }, [workspace.deliverables, assignmentHierarchy.groups]);

  const stageIndex = WORKFLOW_STAGES.findIndex(
    (stage) => stage === workspace.workflow_stage
  );

  const recentActivity = (workspace.activity ?? []).slice(0, 5);
  const recentAssignments = workspace.lines.slice(0, 6);

  return (
    <div className="thinkway-aurora-command">
      <CampaignOperationalReadinessChecklist readiness={readiness} />

      {/* Workflow health strip */}
      <CampaignSectionHead
        title="Campaign health"
        subtitle="Derived from assignment status & billing"
      />
      <div className="thinkway-aurora-flow" aria-label="Workflow stage">
        {WORKFLOW_STAGES.map((stage, index) => {
          const done = stageIndex >= 0 && index < stageIndex;
          const now = stageIndex === index;
          return (
            <div key={stage} className="contents">
              {index > 0 ? <span className="thinkway-aurora-farrow" aria-hidden /> : null}
              <span
                className={cn(
                  "thinkway-aurora-fstep",
                  done && "done",
                  now && "now"
                )}
              >
                {WORKFLOW_LABELS[stage]}
              </span>
            </div>
          );
        })}
      </div>
      {workspace.blockers.length > 0 ? (
        <div className="mt-3 space-y-2">
          {workspace.blockers.slice(0, 3).map((blocker) => (
            <div key={blocker} className="thinkway-aurora-blocker">
              <span className="thinkway-aurora-blocker-dot" aria-hidden />
              {blocker}
            </div>
          ))}
        </div>
      ) : null}

      {/* Operational cards grid */}
      <CampaignSectionHead
        title="Operating dashboard"
        subtitle="Summaries first — open a workspace for deeper work"
        tools={
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--camp-text-4)]">
            <LayoutGridIcon className="size-3.5" aria-hidden />
            Live data
          </span>
        }
      />

      <div className="thinkway-aurora-ops-grid">
        <CampaignOpsCard
          title="Commercial"
          subtitle="Revenue · cost · margin"
          status={pill(
            financials.po_exceeded
              ? "rose"
              : financials.po_status === "near_limit"
                ? "amber"
                : "green",
            PO_STATUS_LABELS[financials.po_status] ?? financials.po_status
          )}
          actionLabel="Finance"
          onAction={() => onNavigateToTab("billing")}
        >
          <CampaignOpsStat
            label="Revenue"
            value={formatMoney(financials.revenue, currency)}
            tone="blue"
          />
          <CampaignOpsStat label="Cost" value={formatMoney(financials.cost, currency)} />
          <CampaignOpsStat
            label="GP · Margin"
            value={`${formatMoney(financials.gp, currency)} · ${formatPercent(financials.margin_percent)}`}
            tone={financials.gp < 0 ? "amber" : "pos"}
          />
        </CampaignOpsCard>

        <CampaignOpsCard
          title="Assignments"
          subtitle={`${assignmentStats.total} campaign lines`}
          status={pill(
            assignmentStats.withVendor === assignmentStats.total && assignmentStats.total > 0
              ? "green"
              : "amber",
            `${assignmentStats.withVendor}/${assignmentStats.total} assigned`
          )}
          actionLabel="Open"
          onAction={() => onNavigateToTab("lines")}
        >
          <CampaignOpsStat label="Creators" value={String(assignmentStats.withVendor)} tone="blue" />
          <CampaignOpsStat label="Confirmed+" value={String(assignmentStats.confirmed)} />
          <CampaignOpsStat
            label="Unassigned"
            value={String(Math.max(0, assignmentStats.total - assignmentStats.withVendor))}
            tone={
              assignmentStats.total - assignmentStats.withVendor > 0 ? "amber" : "mut"
            }
          />
        </CampaignOpsCard>

        <CampaignOpsCard
          title="Client IO"
          subtitle={
            workspace.client_io?.document_number
              ? workspace.client_io.document_number
              : "Not set up"
          }
          status={pill(
            clientIoTone(workspace.client_io?.status),
            workspace.client_io?.status?.replaceAll("_", " ") ?? "Missing"
          )}
          actionLabel="Open"
          onAction={() => onNavigateToTab("client-io")}
        >
          <CampaignOpsStat
            label="Status"
            value={workspace.client_io?.status?.replaceAll("_", " ") ?? "—"}
            tone={workspace.client_io?.status === "approved" ? "pos" : "default"}
          />
          <CampaignOpsStat
            label="Agreed"
            value={formatMoney(financials.revenue, currency)}
            tone="blue"
          />
          <CampaignOpsStat label="Lines" value={String(assignmentStats.total)} />
        </CampaignOpsCard>

        <CampaignOpsCard
          title="Vendor IO"
          subtitle={`${vendorIoStats.total} orders`}
          status={pill(
            vendorIoStats.approved > 0
              ? "green"
              : vendorIoStats.sent > 0
                ? "blue"
                : "mut",
            vendorIoStats.sent > 0
              ? `${vendorIoStats.sent} sent`
              : `${vendorIoStats.generated} draft/generated`
          )}
          actionLabel="Open"
          onAction={() => onNavigateToTab("vendor-io")}
        >
          <CampaignOpsStat label="Total" value={String(vendorIoStats.total)} />
          <CampaignOpsStat label="Sent" value={String(vendorIoStats.sent)} tone="blue" />
          <CampaignOpsStat
            label="Approved"
            value={String(vendorIoStats.approved)}
            tone="pos"
          />
        </CampaignOpsCard>

        <CampaignOpsCard
          title="Deliverables"
          subtitle={`${deliverableStats.total} total`}
          status={pill(
            deliverableStats.pending === 0 && deliverableStats.total > 0
              ? "green"
              : deliverableStats.total > 0
                ? "amber"
                : "mut",
            deliverableStats.total > 0
              ? `${deliverableStats.pending} pending`
              : "None"
          )}
          actionLabel="Open"
          onAction={() => onNavigateToTab("deliverables")}
        >
          <CampaignOpsStat label="Total" value={String(deliverableStats.total)} />
          <CampaignOpsStat label="Posted" value={String(deliverableStats.posted)} tone="pos" />
          <CampaignOpsStat
            label="Pending"
            value={String(deliverableStats.pending)}
            tone={deliverableStats.pending > 0 ? "amber" : "mut"}
          />
        </CampaignOpsCard>

        <CampaignOpsCard
          title="Performance"
          subtitle={
            performanceLoaded
              ? `${performanceSummary?.total_publications ?? 0} publications`
              : "Loading metrics…"
          }
          status={
            performanceLoaded
              ? pill(
                  (performanceSummary?.total_publications ?? 0) > 0 ? "green" : "mut",
                  (performanceSummary?.total_publications ?? 0) > 0 ? "Live" : "No data"
                )
              : pill("mut", "…")
          }
          actionLabel="Open"
          onAction={() => onNavigateToTab("publications")}
        >
          <CampaignOpsStat
            label="Reach"
            value={
              performanceLoaded
                ? String(performanceSummary?.total_reach ?? 0)
                : "—"
            }
          />
          <CampaignOpsStat
            label="Views"
            value={
              performanceLoaded
                ? String(performanceSummary?.total_views ?? 0)
                : "—"
            }
          />
          <CampaignOpsStat
            label="Avg ER"
            value={
              performanceLoaded && performanceSummary?.average_engagement_rate != null
                ? formatPercent(performanceSummary.average_engagement_rate)
                : "—"
            }
            tone="mut"
          />
        </CampaignOpsCard>

        <CampaignOpsCard
          title="Finance"
          subtitle="Collected · outstanding · PO"
          status={pill(
            financials.billing_outstanding > 0 ? "amber" : "green",
            financials.billing_outstanding > 0 ? "Outstanding" : "Clear"
          )}
          actionLabel="Open"
          onAction={() => onNavigateToTab("billing")}
        >
          <CampaignOpsStat
            label="Collected"
            value={formatMoney(financials.collected, currency)}
          />
          <CampaignOpsStat
            label="Outstanding"
            value={formatMoney(financials.billing_outstanding, currency)}
            tone={financials.billing_outstanding > 0 ? "amber" : "mut"}
          />
          <CampaignOpsStat
            label="Remaining PO"
            value={formatMoney(financials.remaining_po, currency)}
          />
        </CampaignOpsCard>

        <CampaignOpsCard
          title="Timeline"
          subtitle="Recent activity"
          status={pill("mut", `${workspace.activity.length} events`)}
          actionLabel="Open"
          onAction={() => onNavigateToTab("timeline")}
        >
          {recentActivity.length === 0 ? (
            <p className="text-[12.5px] text-[var(--camp-text-4)]">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((item) => (
                <li key={item.id} className="thinkway-aurora-tl-mini">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-[var(--camp-text)]">
                      {item.summary || item.action}
                    </div>
                    <div className="truncate text-[11px] text-[var(--camp-text-4)]">
                      {item.actor?.full_name || item.actor?.email || "System"}
                    </div>
                  </div>
                  <time className="shrink-0 text-[11px] text-[var(--camp-text-4)]">
                    {formatDistanceToNowStrict(new Date(item.created_at), {
                      addSuffix: true,
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CampaignOpsCard>
      </div>

      {/* Quick actions + future entry points */}
      <CampaignSectionHead title="Quick actions" subtitle="Primary workspaces & future modules" />
      <div className="thinkway-aurora-quick">
        <Button
          type="button"
          variant="outline"
          className="thinkway-campaign-btn"
          onClick={() => onNavigateToTab("lines")}
        >
          Assignments
        </Button>
        <Button
          type="button"
          variant="outline"
          className="thinkway-campaign-btn"
          onClick={() => onNavigateToTab("client-io")}
        >
          Client IO
        </Button>
        <Button
          type="button"
          variant="outline"
          className="thinkway-campaign-btn"
          onClick={() => onNavigateToTab("vendor-io")}
        >
          Vendor IO
        </Button>
        <Button
          type="button"
          variant="outline"
          className="thinkway-campaign-btn"
          onClick={() => onNavigateToTab("billing")}
        >
          Finance
        </Button>
        <Button
          type="button"
          variant="outline"
          className="thinkway-campaign-btn"
          onClick={() => onNavigateToTab("timeline")}
        >
          Timeline
        </Button>
        <Button
          type="button"
          variant="outline"
          className="thinkway-campaign-btn"
          onClick={() => onNavigateToTab("workflow")}
        >
          Workflow
        </Button>
        <Button
          type="button"
          variant="outline"
          className="thinkway-campaign-btn opacity-60"
          disabled
          title="Planning Board — coming in Release 2.2a"
        >
          Planning Board
        </Button>
        <Button
          type="button"
          variant="outline"
          className="thinkway-campaign-btn opacity-60"
          disabled
          title="Copilot — coming in Release 2.2b"
        >
          Copilot
        </Button>
      </div>

      {/* Recent assignments preview */}
      {recentAssignments.length > 0 ? (
        <>
          <CampaignSectionHead
            title="Recent assignments"
            subtitle={`${assignmentStats.total} total`}
            tools={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="thinkway-campaign-btn h-[33px] px-3 text-[12.5px]"
                onClick={() => onNavigateToTab("lines")}
              >
                View all
              </Button>
            }
          />
          <div className="thinkway-aurora-tblwrap">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Line</th>
                  <th>Status</th>
                  <th className="r">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {recentAssignments.map((line) => (
                  <tr key={line.id}>
                    <td className="strong">
                      {line.influencer_name?.trim() || line.name || "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="lnk text-[var(--camp-blue-text)] font-semibold"
                        onClick={() => onNavigateToTab("lines")}
                      >
                        {line.document_number}
                      </button>
                    </td>
                    <td>
                      {pill(
                        line.assignment_status === "draft" ? "mut" : "green",
                        line.assignment_status.replaceAll("_", " ")
                      )}
                    </td>
                    <td className="r tabular strong">
                      {formatMoney(line.revenue_before_vat ?? 0, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {/* Progressive disclosure: details / PO / edit */}
      <div className="mt-2 border-t border-[var(--camp-hair)] pt-2">
        <button
          type="button"
          className="thinkway-aurora-disclose"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <span>Campaign details & PO governance</span>
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform",
              detailsOpen && "rotate-180"
            )}
            aria-hidden
          />
        </button>

        {detailsOpen ? (
          <div className="mt-2 space-y-0">
            <div className="thinkway-aurora-sechead">
              <div className="thinkway-aurora-sechead-tt">Details</div>
              <div className="thinkway-aurora-sechead-tools">
                {onOpenDetails ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="thinkway-campaign-btn h-[33px] px-3 text-[12.5px]"
                    onClick={onOpenDetails}
                  >
                    Details panel
                  </Button>
                ) : null}
                {!inlineEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="thinkway-campaign-btn h-[33px] px-3 text-[12.5px]"
                    onClick={() => setInlineEditing(true)}
                  >
                    Edit header
                  </Button>
                ) : null}
              </div>
            </div>

            <CampaignHeaderInlineEditor
              workspace={workspace}
              accountManagers={accountManagers}
              editing={inlineEditing}
              onEditingChange={setInlineEditing}
            />
            {!inlineEditing ? (
              <CampaignOverviewDetails workspace={workspace} layout="grid" />
            ) : null}

            <CampaignPoSection
              campaignId={workspace.id}
              campaignName={workspace.name}
              campaignCurrency={currency}
              po={workspace.po}
              currencyOptions={currencyOptions}
            />

            <CampaignIntelligenceReference workspace={workspace} />

            {workspace.brief && !workspace.campaign_intelligence ? (
              <CampaignFlatSection title="Brief">
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--camp-text-2)]">
                  {workspace.brief}
                </p>
              </CampaignFlatSection>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
