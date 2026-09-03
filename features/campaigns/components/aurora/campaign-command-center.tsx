"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronDownIcon } from "lucide-react";

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
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { CampaignLifecycleChrome } from "@/features/campaigns/lifecycle/components/campaign-lifecycle-chrome";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import { formatMoneyCompact, formatPercent } from "@/features/campaigns/utils";
import { evaluateCampaignOperationalReadiness } from "@/lib/domains/commercial/campaign-operational-readiness";
import type { CampaignPerformanceSummary } from "@/lib/domains/campaign/types";
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
  onOpenResolver?: () => void;
  onContinueLifecycle?: () => void;
  lifecycle?: CampaignLifecycleView;
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
  onOpenResolver,
  onContinueLifecycle,
  lifecycle,
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
          // STAB-026: planned live_date ≠ posted — align with timeline/signals (posted|approved).
          const posts = deliverable.posts ?? [];
          const isPosted =
            deliverable.workflow_status === "posted" ||
            deliverable.workflow_status === "approved" ||
            posts.some(
              (p) => p.workflow_status === "posted" || p.workflow_status === "approved"
            );
          if (isPosted) posted += 1;
        }
      }
      return { total, posted, pending: Math.max(0, total - posted) };
    }

    const fromWorkspace = workspace.deliverables ?? [];
    const total = fromWorkspace.length;
    const posted = fromWorkspace.filter(
      (d) => d.display_status === "posted" || d.display_status === "approved"
    ).length;
    return { total, posted, pending: Math.max(0, total - posted) };
  }, [workspace.deliverables, assignmentHierarchy.groups]);

  const stageIndex = WORKFLOW_STAGES.findIndex(
    (stage) => stage === workspace.workflow_stage
  );

  const recentActivity = (workspace.activity ?? []).slice(0, 5);
  const recentAssignments = workspace.lines.slice(0, 5);

  return (
    <div className="thinkway-aurora-command">
      {lifecycle ? null : (
        <>
          <CampaignOperationalReadinessChecklist readiness={readiness} />
          <CampaignSectionHead title="Campaign health" />
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
          {/* Decision Center owns blocker narrative — Overview never restates it. */}
        </>
      )}

      <div className="thinkway-aurora-ops-grid">
        <CampaignOpsCard
          title="Health"
          subtitle="Operational readiness"
          className={readiness.status === "operational_ready" ? undefined : "is-alert"}
          status={pill(
            readiness.status === "operational_ready" ? "green" : "amber",
            readiness.statusLabel
          )}
          actionLabel="Workflow"
          onAction={() => onNavigateToTab("workflow")}
        >
          <CampaignOpsStat
            label="Status"
            value={readiness.status === "operational_ready" ? "Ready" : "Attention"}
            tone={readiness.status === "operational_ready" ? "pos" : "amber"}
          />
          <CampaignOpsStat
            label="Blockers"
            value={String(workspace.blockers.length)}
            tone={workspace.blockers.length > 0 ? "amber" : "mut"}
          />
          <CampaignOpsStat
            label="Gaps"
            value={String(readiness.mandatoryMissing.length)}
            tone={readiness.mandatoryMissing.length > 0 ? "amber" : "mut"}
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
          actionLabel="Assignments"
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
          actionLabel="Client IO"
          onAction={() => onNavigateToTab("client-io")}
        >
          <CampaignOpsStat
            label="Documents"
            value={workspace.client_io ? "1" : "0"}
          />
          <CampaignOpsStat
            label="Status"
            value={workspace.client_io?.status?.replaceAll("_", " ") ?? "—"}
            tone={workspace.client_io?.status === "approved" ? "pos" : "default"}
          />
          <CampaignOpsStat
            label="Pending"
            value={
              workspace.client_io &&
              !["approved", "rejected"].includes(workspace.client_io.status)
                ? "Yes"
                : "No"
            }
            tone={
              workspace.client_io &&
              !["approved", "rejected"].includes(workspace.client_io.status)
                ? "amber"
                : "mut"
            }
          />
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
          actionLabel="Vendor IO"
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
          actionLabel="Deliverables"
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
          actionLabel="Performance"
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
          className={financials.billing_outstanding > 0 ? "is-alert" : undefined}
          status={pill(
            financials.billing_outstanding > 0 ? "amber" : "green",
            financials.billing_outstanding > 0 ? "Outstanding" : "Clear"
          )}
          actionLabel="Finance"
          onAction={() => onNavigateToTab("billing")}
        >
          <CampaignOpsStat
            label="Collected"
            value={formatMoneyCompact(financials.collected, currency)}
          />
          <CampaignOpsStat
            label="Outstanding"
            value={formatMoneyCompact(financials.billing_outstanding, currency)}
            tone={financials.billing_outstanding > 0 ? "amber" : "mut"}
          />
          <CampaignOpsStat
            label="Remaining PO"
            value={formatMoneyCompact(financials.remaining_po, currency)}
          />
        </CampaignOpsCard>

        <CampaignOpsCard
          title="Timeline"
          subtitle="Recent activity"
          status={pill("mut", `${workspace.activity.length} events`)}
          actionLabel="Timeline"
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

      {lifecycle ? (
        <CampaignLifecycleChrome
          lifecycle={lifecycle}
          activeWorkspaceTab="overview"
          variant="dashboard"
          onContinue={
            onContinueLifecycle ??
            (() => onNavigateToTab(lifecycle.decisionCenter.primaryActionTab))
          }
          onOpenResolver={onOpenResolver}
          onSelectStage={onNavigateToTab}
        />
      ) : null}

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
                      {formatMoneyCompact(line.revenue_before_vat ?? 0, currency)}
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
