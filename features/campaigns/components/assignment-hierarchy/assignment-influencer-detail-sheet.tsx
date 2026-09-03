"use client";

import Link from "next/link";
import {
  BriefcaseIcon,
  CircleDollarSignIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentStatusBadge } from "@/features/campaigns/components/assignment-status-badge";
import { PlatformBadge } from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
import { DocumentNumber } from "@/components/ui/document-number";
import { deliverableLabel } from "@/features/campaigns/line-assignment";
import type { AssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";
import {
  formatAssignmentDetailDate,
  initialsFromName,
  isAssignmentLiveDateOverdue,
  resolveAssignmentDeliverableLabels,
  resolveAssignmentFirstLiveDate,
  resolveAssignmentPlatformLabels,
  resolveAssignmentPrimaryHandle,
  resolvePaymentRequestedPercent,
} from "@/lib/campaigns/assignment-detail-presenters";
import type { AssignmentAudienceView } from "@/lib/campaigns/assignment-audience-view";
import { resolveAssignmentsGridGates } from "@/lib/campaigns/assignments-grid-gates";
import { formatMoney, formatMoneyCompact, formatPercent } from "@/features/campaigns/utils";
import { resolveAssignmentLineCurrency } from "@/lib/campaigns/assignment-line-currency";
import { cn } from "@/lib/utils";
import "@/app/styles/campaign-detail-suite.css";

type AssignmentInfluencerDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string;
  accountManager: { id: string; full_name: string | null; email: string } | null;
  clientIoStatus: string | null;
  group: AssignmentHierarchyGroup | null;
  row: AssignmentRowViewModel | null;
  audienceView?: AssignmentAudienceView;
  onEdit?: () => void;
};

const ACTIVITY_SUB_TABS = ["content", "publications", "payments", "actions"] as const;

function DetailField({
  label,
  children,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="tw-dl">
      <span>{label}</span>
      <b className={cn("min-w-0", valueClassName)}>{children}</b>
    </div>
  );
}

function formatFollowerShort(count: number | null | undefined): string | null {
  if (count == null || !Number.isFinite(count)) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M followers`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K followers`;
  return `${count.toLocaleString()} followers`;
}

function DetailPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

function TeamMemberValue({
  name,
  email,
}: {
  name: string | null | undefined;
  email?: string | null;
}) {
  const display = name?.trim() || email?.trim() || "—";
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {initialsFromName(display)}
      </span>
      <span>{display}</span>
    </span>
  );
}

function ClientApprovalPill({ status }: { status: string | null }) {
  const normalized = (status ?? "draft").toLowerCase();
  if (normalized === "approved") {
    return (
      <DetailPill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
        Accepted ✓
      </DetailPill>
    );
  }
  if (normalized === "sent") {
    return (
      <DetailPill className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
        Pending approval
      </DetailPill>
    );
  }
  if (normalized === "rejected") {
    return (
      <DetailPill className="border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200">
        Rejected
      </DetailPill>
    );
  }
  return <DetailPill>Draft</DetailPill>;
}

function ParticipationDetailsTab({
  group,
  row,
  accountManager,
  clientIoStatus,
  showInternalFinancials,
}: {
  group: AssignmentHierarchyGroup;
  row: AssignmentRowViewModel;
  accountManager: AssignmentInfluencerDetailSheetProps["accountManager"];
  clientIoStatus: string | null;
  showInternalFinancials: boolean;
}) {
  const line = group.line;
  const currency = resolveAssignmentLineCurrency(line);
  const platformLabels = resolveAssignmentPlatformLabels(group);
  const deliverableLabels = resolveAssignmentDeliverableLabels(group);
  const liveDate = resolveAssignmentFirstLiveDate(group);
  const liveDateOverdue = isAssignmentLiveDateOverdue(liveDate, line.assignment_status);

  return (
    <div className="px-1">
      <DetailField label="Platform">
        <div className="flex flex-wrap justify-end gap-1.5">
          {platformLabels.length > 0 ? (
            platformLabels.map((label) => <DetailPill key={label}>{label}</DetailPill>)
          ) : (
            "—"
          )}
        </div>
      </DetailField>
      <DetailField label="Deliverables">
        <div className="flex flex-wrap justify-end gap-1.5">
          {deliverableLabels.length > 0 ? (
            deliverableLabels.map((label) => <DetailPill key={label}>{label}</DetailPill>)
          ) : (
            "—"
          )}
        </div>
      </DetailField>
      <DetailField label="Ad type">
        <DetailPill>{line.name || row.displayName}</DetailPill>
      </DetailField>
      <DetailField label="Vendor">
        <span className="inline-flex items-center justify-end gap-1.5">
          <BriefcaseIcon className="size-3.5 text-muted-foreground" aria-hidden />
          {line.influencer_name ?? "—"}
        </span>
      </DetailField>
      {showInternalFinancials ? (
        <DetailField label="Inf cost">
          {formatMoney(line.cost_before_vat ?? line.cost, currency)}
        </DetailField>
      ) : null}
      <DetailField label="Revenue">
        {formatMoney(line.revenue_after_vat ?? line.revenue_before_vat, currency)}
      </DetailField>
      {showInternalFinancials ? (
        <>
          <DetailField label="Profit">
            {formatMoney(row.rollups.gp, currency)}
          </DetailField>
          <DetailField label="Creator profit %">
            {formatPercent(row.rollups.margin_percent)}
          </DetailField>
        </>
      ) : null}
      <DetailField label="Client approval">
        <ClientApprovalPill status={clientIoStatus} />
      </DetailField>
      <DetailField label="Team member">
        <TeamMemberValue
          name={accountManager?.full_name}
          email={accountManager?.email}
        />
      </DetailField>
      <DetailField label="Ad status">
        <AssignmentStatusBadge status={line.assignment_status} />
      </DetailField>
      <DetailField
        label="Ad date"
        valueClassName={liveDateOverdue ? "font-medium text-red-600 dark:text-red-400" : undefined}
      >
        {formatAssignmentDetailDate(liveDate)}
      </DetailField>
      {showInternalFinancials ? (
        <DetailField label="Payment requested %">
          {resolvePaymentRequestedPercent(line)}
        </DetailField>
      ) : null}
    </div>
  );
}

function GeneralTab({
  group,
  row,
  showInternalFinancials,
}: {
  group: AssignmentHierarchyGroup;
  row: AssignmentRowViewModel;
  showInternalFinancials: boolean;
}) {
  const line = group.line;
  const currency = resolveAssignmentLineCurrency(line);
  const deliverableCount = row.rollups.deliverable_count;

  return (
    <div className="px-1">
      <DetailField label="Assignment line">
        <DocumentNumber value={line.document_number} />
      </DetailField>
      <DetailField label="Deliverable units">{deliverableCount}</DetailField>
      <DetailField label="Invoiced value">
        {formatMoney(group.rollups?.invoiced_value ?? 0, currency)}
      </DetailField>
      <DetailField label="Remaining billable">
        {formatMoney(group.rollups?.remaining_value ?? 0, currency)}
      </DetailField>
      {showInternalFinancials ? (
        <DetailField label="Collected value">
          {formatMoney(group.rollups?.collected_value ?? 0, currency)}
        </DetailField>
      ) : null}
      <DetailField label="Campaign dates">
        {formatAssignmentDetailDate(line.start_date)}
        {line.end_date ? ` – ${formatAssignmentDetailDate(line.end_date)}` : ""}
      </DetailField>
      {showInternalFinancials ? (
        <>
          <DetailField label="Ops status">{row.opsStatusLabel}</DetailField>
          <DetailField label="Billing status">{row.billingStatusLabel}</DetailField>
          {line.vendor_io_document_number ? (
            <DetailField label="Vendor IO">
              <DocumentNumber value={line.vendor_io_document_number} />
            </DetailField>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SocialDataTab({ group }: { group: AssignmentHierarchyGroup }) {
  const accounts =
    group.line.creator_platform_accounts?.length > 0
      ? group.line.creator_platform_accounts
      : (group.line.assignment?.platforms ?? []).map((platform) => ({
          platform: platform.platform,
          handle: platform.handle,
          profile_url: platform.profile_url,
          follower_count: platform.follower_count,
          engagement_rate: platform.engagement_rate,
        }));

  if (accounts.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-muted-foreground">
        No linked social accounts for this creator.
      </p>
    );
  }

  return (
    <div className="space-y-3 px-1">
      {accounts.map((account) => (
        <div
          key={`${account.platform}-${account.handle}`}
          className="rounded-xl border border-border/50 bg-muted/20 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PlatformBadge platform={account.platform} />
              {account.profile_url ? (
                <a
                  href={account.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                >
                  @{account.handle}
                </a>
              ) : (
                <span className="text-sm font-medium">@{account.handle}</span>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Followers
              </p>
              <p className="mt-0.5 font-medium tabular-nums">
                {account.follower_count != null
                  ? account.follower_count.toLocaleString()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Engagement
              </p>
              <p className="mt-0.5 font-medium tabular-nums">
                {account.engagement_rate != null
                  ? formatPercent(account.engagement_rate)
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityTab({ group }: { group: AssignmentHierarchyGroup }) {
  const [subTab, setSubTab] = useState<(typeof ACTIVITY_SUB_TABS)[number]>("content");
  const deliverables = group.deliverables ?? [];
  const line = group.line;
  const currency = resolveAssignmentLineCurrency(line);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-muted/50 p-1">
        {ACTIVITY_SUB_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              subTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {subTab === "content" ? (
        deliverables.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No deliverables on this assignment yet. Add deliverables from the Assignments grid.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.map((deliverable) => (
                  <tr key={deliverable.id} className="border-t border-border/40">
                    <td className="px-3 py-2.5 font-medium">{deliverable.label}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {deliverable.deliverable_type_label ||
                        deliverableLabel(deliverable.deliverable_type)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(deliverable.revenue_before_vat, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {subTab === "publications" ? (
        <div className="rounded-xl border border-dashed border-border/70 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Track live URLs in the Publications tab for this campaign.
          </p>
        </div>
      ) : null}

      {subTab === "payments" ? (
        <div className="px-1">
          <DetailField label="Vendor payment">
            {line.vendor_payment_status
              ? line.vendor_payment_status.replace(/_/g, " ")
              : "—"}
          </DetailField>
          <DetailField label="Line payment status">{line.payment_status}</DetailField>
          <DetailField label="Cost received">
            {formatMoney(line.cost_received, line.cost_received_currency || currency)}
          </DetailField>
        </div>
      ) : null}

      {subTab === "actions" ? (
        <div className="px-1">
          <DetailField label="Operational status">{line.operational_status}</DetailField>
          <DetailField label="Billing status">{line.billing_status}</DetailField>
          <DetailField label="Assignment locked">
            {line.vendor_assignment_locked ? "Yes" : "No"}
          </DetailField>
        </div>
      ) : null}
    </div>
  );
}

function PerformanceTab({ group, row }: { group: AssignmentHierarchyGroup; row: AssignmentRowViewModel }) {
  const line = group.line;
  const currency = resolveAssignmentLineCurrency(line);
  const total = line.revenue_after_vat ?? line.revenue_before_vat ?? row.rollups.revenue;
  const max = Math.max(total, 1);

  return (
    <div className="space-y-6 px-1">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CircleDollarSignIcon className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {formatMoney(total, currency)}
          </p>
          <p className="text-xs text-muted-foreground">Total revenue with fees</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
        <svg viewBox="0 0 320 140" className="h-36 w-full" aria-hidden>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = 120 - ratio * 90;
            return (
              <line
                key={ratio}
                x1="24"
                x2="300"
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-border/80"
              />
            );
          })}
          <line
            x1="160"
            x2="160"
            y1={120 - (total / max) * 90}
            y2="120"
            stroke="currentColor"
            className="text-emerald-500/50"
          />
          <circle
            cx="160"
            cy={120 - (total / max) * 90}
            r="5"
            className="fill-emerald-500"
          />
          <text x="160" y="132" textAnchor="middle" className="fill-muted-foreground text-[10px]">
            Campaign
          </text>
        </svg>
      </div>
    </div>
  );
}

export function AssignmentInfluencerDetailSheet({
  open,
  onOpenChange,
  campaignName,
  accountManager,
  clientIoStatus,
  group,
  row,
  audienceView = "internal",
  onEdit,
}: AssignmentInfluencerDetailSheetProps) {
  const gates = resolveAssignmentsGridGates(audienceView);

  const handle = useMemo(
    () => (group ? resolveAssignmentPrimaryHandle(group.line) : ""),
    [group]
  );

  const platformAccounts = group?.line.creator_platform_accounts ?? [];
  const line = group?.line;
  const hasDetail = Boolean(group && row && line);
  const currency = line ? resolveAssignmentLineCurrency(line) : "EGP";
  const vendorIoId = line?.active_vendor_io_id ?? line?.vendor_io_id ?? null;
  const primaryAccount = platformAccounts[0];
  const followerLabel = formatFollowerShort(primaryAccount?.follower_count);
  const erLabel =
    primaryAccount?.engagement_rate != null
      ? `${formatPercent(primaryAccount.engagement_rate)} ER`
      : null;
  const creatorName = line?.influencer_name ?? row?.displayName ?? "Creator";
  const revenue = line
    ? Number(line.revenue_after_vat ?? line.revenue_before_vat ?? row?.rollups.revenue ?? 0)
    : 0;
  const cost = line ? Number(line.cost_before_vat ?? line.cost ?? 0) : 0;
  const gp = row?.rollups.gp ?? revenue - cost;
  const margin = row?.rollups.margin_percent ?? (revenue > 0 ? (gp / revenue) * 100 : 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        showOverlay
        className="campaign-detail-creator-modal campaign-detail-suite"
      >
        {!hasDetail || !line || !row || !group ? (
          <div className="tw-cm__w">
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Loading assignment details…
            </div>
          </div>
        ) : (
          <div className="tw-cm__w" role="dialog" aria-label={`${creatorName} assignment details`}>
            <SheetTitle className="sr-only">{creatorName} assignment details</SheetTitle>
            <SheetDescription className="sr-only">
              Assignment participation and activity details for {handle}
            </SheetDescription>

            <div className="tw-cm__l">
              <div className="cr">
                {campaignName} / {handle || line.document_number}
              </div>
              <div className="tw-cm__av">{initialsFromName(creatorName)}</div>
              <h2>
                {creatorName}
                <span className="vf" aria-hidden>
                  ✓
                </span>
              </h2>
              {handle ? <div className="hd">@{handle.replace(/^@/, "")}</div> : null}
              <div className="tw-cm__pf">
                {platformAccounts.map((account) => (
                  <span key={`${account.platform}-${account.handle}`}>{account.platform}</span>
                ))}
                {followerLabel ? <span>{followerLabel}</span> : null}
                {erLabel ? <span>{erLabel}</span> : null}
              </div>
              <div className="tw-cm__st">
                <div>
                  <i>Revenue</i>
                  <b>{formatMoneyCompact(revenue, currency)}</b>
                </div>
                {gates.showInternalFinancials ? (
                  <div>
                    <i>Cost</i>
                    <b>{formatMoneyCompact(cost, currency)}</b>
                  </div>
                ) : null}
                {gates.showInternalFinancials ? (
                  <div>
                    <i>Gross profit</i>
                    <b className={gp >= 0 ? "g" : undefined}>{formatMoneyCompact(gp, currency)}</b>
                  </div>
                ) : null}
                {gates.showInternalFinancials ? (
                  <div>
                    <i>Margin</i>
                    <b className={margin >= 20 ? "g" : undefined}>{formatPercent(margin)}</b>
                  </div>
                ) : null}
                <div>
                  <i>Deliverables</i>
                  <b>{String(row.rollups.deliverable_count)}</b>
                </div>
                <div>
                  <i>Vendor IO</i>
                  <b>{line.vendor_io_document_number || "—"}</b>
                </div>
              </div>
            </div>

            <div className="tw-cm__r">
              <Tabs defaultValue="participation" className="flex min-h-0 flex-1 flex-col">
                <div className="tw-cm__h">
                  <TabsList className="tw-cdt h-auto flex-1 justify-start gap-0.5 rounded-none bg-transparent p-0">
                    <TabsTrigger value="participation">Participation details</TabsTrigger>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="social">Social data</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                  </TabsList>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="tw-b sm">
                        <MoreHorizontalIcon className="size-3.5" aria-hidden />
                        <span className="sr-only">Assignment actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEdit ? (
                        <DropdownMenuItem onClick={onEdit}>
                          <PencilIcon className="size-4" />
                          Edit assignment
                        </DropdownMenuItem>
                      ) : null}
                      {line.influencer_id ? (
                        <DropdownMenuItem asChild>
                          <Link href={`/vendors/${line.influencer_id}`}>Creator profile</Link>
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="tw-b sm"
                    aria-label="Close"
                    onClick={() => onOpenChange(false)}
                  >
                    ×
                  </Button>
                </div>

                <div className="tw-cm__b">
                  <TabsContent value="participation" className="mt-0 outline-none">
                    <ParticipationDetailsTab
                      group={group}
                      row={row}
                      accountManager={accountManager}
                      clientIoStatus={clientIoStatus}
                      showInternalFinancials={gates.showInternalFinancials}
                    />
                  </TabsContent>
                  <TabsContent value="general" className="mt-0 outline-none">
                    <GeneralTab
                      group={group}
                      row={row}
                      showInternalFinancials={gates.showInternalFinancials}
                    />
                  </TabsContent>
                  <TabsContent value="social" className="mt-0 outline-none">
                    <SocialDataTab group={group} />
                  </TabsContent>
                  <TabsContent value="activity" className="mt-0 outline-none">
                    <ActivityTab group={group} />
                  </TabsContent>
                  <TabsContent value="performance" className="mt-0 outline-none">
                    <PerformanceTab group={group} row={row} />
                  </TabsContent>
                </div>
              </Tabs>

              <div className="tw-cm__f">
                {vendorIoId ? (
                  <Button asChild variant="outline" size="sm" className="tw-b sm">
                    <Link href={`/ios/vendor/${vendorIoId}/preview`}>Open vendor IO</Link>
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="tw-b sm" disabled>
                    Open vendor IO
                  </Button>
                )}
                {line.influencer_id ? (
                  <Button asChild variant="outline" size="sm" className="tw-b sm">
                    <Link href={`/vendors/${line.influencer_id}`}>Creator profile</Link>
                  </Button>
                ) : null}
                <span className="tw-sp" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="tw-b sm"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                {onEdit ? (
                  <Button type="button" size="sm" className="tw-b sm pri" onClick={onEdit}>
                    Edit assignment
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
