"use client";

import dynamic from "next/dynamic";
import { useEffect, type ReactNode } from "react";

import type {
  AssignmentBillingGroup,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignPoSummary, CampaignWorkspace } from "@/features/campaigns/types";
import {
  assignmentsRenderStageSourceLabel,
  assignmentsStageAtLeast,
  assignmentsStageLabel,
  getAssignmentsRenderStage,
  type AssignmentsRenderStage,
} from "@/lib/campaigns/assignments-render-stage";
import {
  plainLinesFromHierarchy,
  type PlainAssignmentLine,
} from "@/lib/campaigns/assignments-plain-lines";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";
import {
  AssignmentsInvoiceShell,
  useAssignmentsInvoiceDialog,
} from "@/features/campaigns/components/tabs/assignments-invoice-shell";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";

const AssignmentSafeGrid = dynamic(
  () =>
    import("@/features/campaigns/components/assignment-hierarchy/assignment-safe-grid").then(
      (m) => m.AssignmentSafeGrid
    ),
  { ssr: false }
);

const CampaignLinesTabInner = dynamic(
  () =>
    import("@/features/campaigns/components/tabs/campaign-lines-tab-inner").then(
      (m) => m.CampaignLinesTabInner
    ),
  { ssr: false }
);

type AssignmentsRenderProps = {
  workspace: CampaignWorkspace;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
  assignmentHierarchy: AssignmentHierarchy;
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  renderStage?: AssignmentsRenderStage;
  renderStageSource?: "server" | "next_public" | "default" | "production_recovery";
};

function StageBanner({
  stage,
  hint,
  source,
}: {
  stage: string;
  hint?: string;
  source?: string;
}) {
  return (
    <p className="border-b border-border/40 bg-muted/30 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
      Assignments render stage: <span className="font-semibold text-foreground">{stage}</span>
      {source ? (
        <span className="ml-1 text-muted-foreground">({source})</span>
      ) : null}
      {hint ? <span className="ml-2 text-muted-foreground">— {hint}</span> : null}
    </p>
  );
}

function renderPlainCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return "—";
  return String(value);
}

function tryRenderStaticRow(
  line: PlainAssignmentLine,
  cells: (string | number | null | undefined)[]
): ReactNode {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("[Assignments] RENDER ROW", line.line_id);
    }
    return (
      <tr key={line.line_id} data-line-id={line.line_id}>
        {cells.map((cell, index) => (
          <td key={`${line.line_id}-${index}`} className="border-b border-border/30 px-2 py-1.5 text-[11px]">
            {renderPlainCell(cell)}
          </td>
        ))}
      </tr>
    );
  } catch (error) {
    console.error("[Assignments] ROW CRASH", line.line_id, error);
    return (
      <tr key={line.line_id} className="bg-destructive/10">
        <td colSpan={20} className="px-2 py-2 text-xs text-destructive">
          ROW FAILED {line.line_id}
        </td>
      </tr>
    );
  }
}

function StaticAssignmentsTable({
  lines,
  stage,
}: {
  lines: PlainAssignmentLine[];
  stage: ReturnType<typeof getAssignmentsRenderStage>;
}) {
  const showStatus = assignmentsStageAtLeast(stage, "text-status");
  const showColumns = assignmentsStageAtLeast(stage, "columns");

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/50 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-2">Document #</th>
            <th className="px-2 py-2">Assignment</th>
            {showStatus ? <th className="px-2 py-2">Creator</th> : null}
            {showStatus ? <th className="px-2 py-2">Ops</th> : null}
            {showStatus ? <th className="px-2 py-2">Billing</th> : null}
            {showColumns ? <th className="px-2 py-2 text-right">Revenue</th> : null}
            {showColumns ? <th className="px-2 py-2 text-right">Deliv.</th> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const cells: (string | number | null | undefined)[] = [
              line.document_number,
              line.name,
            ];
            if (showStatus) {
              cells.push(line.influencer, line.operational_status, line.billing_status);
            }
            if (showColumns) {
              cells.push(line.revenue, line.deliverables);
            }
            return tryRenderStaticRow(line, cells);
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentsSafeGridStage({
  stage,
  stageHint,
  stageSource,
  workspace,
  assignmentHierarchy,
  billingGroups,
  operationalBilling,
}: {
  stage: ReturnType<typeof getAssignmentsRenderStage>;
  stageHint?: string;
  stageSource?: string;
  workspace: CampaignWorkspace;
  assignmentHierarchy: AssignmentHierarchy;
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
}) {
  const invoice = useAssignmentsInvoiceDialog();
  const enableLineSheet = assignmentsStageAtLeast(stage, "dialogs");

  function openEdit(line: CampaignLineWorkspace) {
    if (!enableLineSheet) return;
    // Line sheet only in full stage via CampaignLinesTabInner
  }

  return (
    <div>
      <StageBanner
        stage={assignmentsStageLabel(stage)}
        hint={stageHint}
        source={stageSource}
      />
      <AssignmentSafeGrid
        campaignId={workspace.id}
        hierarchy={assignmentHierarchy}
        onEditLine={openEdit}
        onInvoiceLines={invoice.openInvoiceWithLines}
        renderStage={stage}
      />
      {assignmentsStageAtLeast(stage, "dialogs") ? (
        <AssignmentsInvoiceShell
          campaignId={workspace.id}
          currencyCode={workspace.currency_code}
          billingGroups={billingGroups}
          operationalBilling={operationalBilling}
          invoiceOpen={invoice.invoiceOpen}
          onInvoiceOpenChange={invoice.setInvoiceOpen}
          invoiceSelection={invoice.invoiceSelection}
        />
      ) : null}
    </div>
  );
}

export function AssignmentsRender({
  workspace,
  po,
  currencyOptions,
  assignmentHierarchy,
  billingGroups,
  operationalBilling,
  renderStage: renderStageProp,
  renderStageSource,
}: AssignmentsRenderProps) {
  const stage = renderStageProp ?? getAssignmentsRenderStage();
  const sourceLabel = renderStageSource
    ? assignmentsRenderStageSourceLabel(renderStageSource)
    : undefined;

  useEffect(() => {
    logAssignmentsStage("render stage active", {
      stage,
      campaignId: workspace.id,
      groups: assignmentHierarchy.groups?.length ?? 0,
    });
  }, [stage, workspace.id, assignmentHierarchy.groups?.length]);

  const plainLines = plainLinesFromHierarchy(assignmentHierarchy, {
    campaignId: workspace.id,
  });

  if (stage === "bypass") {
    return (
      <div>
        <StageBanner stage={assignmentsStageLabel(stage)} source={sourceLabel} />
        <div className="px-4 py-8 text-sm font-semibold tracking-tight">ASSIGNMENTS SAFE TEST</div>
      </div>
    );
  }

  if (assignmentsStageAtLeast(stage, "static-table") && !assignmentsStageAtLeast(stage, "safe-grid")) {
    return (
      <div>
        <StageBanner stage={assignmentsStageLabel(stage)} source={sourceLabel} />
        <StaticAssignmentsTable lines={plainLines} stage={stage} />
      </div>
    );
  }

  if (assignmentsStageAtLeast(stage, "safe-grid") && stage !== "full") {
    const expansionHint =
      stage === "expansion"
        ? "Expand a row (chevron) for deliverable/post children. No checkboxes or VIO footer."
        : stage === "footer" || stage === "checkboxes"
          ? "Select rows · Generate Vendor IO / invoice in footer. Invoice sheets off until dialogs."
          : undefined;
    return (
      <AssignmentsSafeGridStage
        stage={stage}
        stageHint={expansionHint}
        stageSource={sourceLabel}
        workspace={workspace}
        assignmentHierarchy={assignmentHierarchy}
        billingGroups={billingGroups}
        operationalBilling={operationalBilling}
      />
    );
  }

  if (stage === "full") {
    return (
      <div>
        <StageBanner stage="full" source={sourceLabel} />
        <CampaignLinesTabInner
          workspace={workspace}
          po={po}
          currencyOptions={currencyOptions}
          assignmentHierarchy={assignmentHierarchy}
          billingGroups={billingGroups}
          operationalBilling={operationalBilling}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 text-sm text-muted-foreground">
      Unknown assignments render stage: {stage}
    </div>
  );
}
