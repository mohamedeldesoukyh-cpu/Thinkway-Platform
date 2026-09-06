"use client";

import Link from "next/link";
import { MoreHorizontalIcon, PencilIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
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
import { DocumentNumber } from "@/components/ui/document-number";
import { ASSIGNMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import { deliverableLabel } from "@/features/campaigns/line-assignment";
import type { AssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import type { CampaignLineAssignmentStatus } from "@/features/campaigns/types";
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
import { formatDesignDateRange } from "@/lib/design/format-design-date";
import type { AssignmentAudienceView } from "@/lib/campaigns/assignment-audience-view";
import { resolveAssignmentsGridGates } from "@/lib/campaigns/assignments-grid-gates";
import { formatMoney, formatMoneyCompact, formatPercent } from "@/features/campaigns/utils";
import { resolveAssignmentLineCurrency } from "@/lib/campaigns/assignment-line-currency";
import { vendorDetailPath } from "@/lib/routing/entity-paths";
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

function Miss({ children }: { children: ReactNode }) {
  return <span className="tw-miss">{children}</span>;
}

function ModalPill({
  tone,
  children,
}: {
  tone: "n" | "g" | "y" | "r" | "b";
  children: ReactNode;
}) {
  return <span className={`tw-p p-${tone}`}>{children}</span>;
}

function textOrMiss(value: string | null | undefined, empty = "not set"): ReactNode {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "—") return <Miss>{empty}</Miss>;
  return trimmed;
}

function ClientApprovalPill({ status }: { status: string | null }) {
  const normalized = (status ?? "draft").toLowerCase();
  if (normalized === "approved") return <ModalPill tone="g">Accepted ✓</ModalPill>;
  if (normalized === "sent") return <ModalPill tone="y">Pending approval</ModalPill>;
  if (normalized === "rejected") return <ModalPill tone="r">Rejected</ModalPill>;
  return <ModalPill tone="n">Draft</ModalPill>;
}

function AssignmentStatusPill({ status }: { status: CampaignLineAssignmentStatus }) {
  const tone = resolveStatusTone("campaignAssignment", status);
  const pillTone =
    tone === "success"
      ? "g"
      : tone === "warning"
        ? "y"
        : tone === "destructive"
          ? "r"
          : tone === "foreground"
            ? "b"
            : "n";
  return (
    <ModalPill tone={pillTone}>{ASSIGNMENT_STATUS_LABELS[status] ?? status}</ModalPill>
  );
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
    <>
      <DetailField label="Platform">
        {platformLabels.length > 0 ? platformLabels.join(", ") : <Miss>not set</Miss>}
      </DetailField>
      <DetailField label="Deliverables">
        {deliverableLabels.length > 0 ? deliverableLabels.join(", ") : <Miss>not set</Miss>}
      </DetailField>
      <DetailField label="Ad type">
        {textOrMiss(line.name || row.displayName)}
      </DetailField>
      <DetailField label="Vendor">
        {textOrMiss(line.influencer_name, "not assigned")}
      </DetailField>
      {showInternalFinancials ? (
        <DetailField label="Inf cost" valueClassName="m">
          {formatMoney(line.cost_before_vat ?? line.cost, currency)}
        </DetailField>
      ) : null}
      <DetailField label="Revenue" valueClassName="m">
        {formatMoney(line.revenue_after_vat ?? line.revenue_before_vat, currency)}
      </DetailField>
      {showInternalFinancials ? (
        <>
          <DetailField label="Profit" valueClassName="m g">
            {formatMoney(row.rollups.gp, currency)}
          </DetailField>
          <DetailField label="Creator profit %" valueClassName="m">
            {formatPercent(row.rollups.margin_percent)}
          </DetailField>
        </>
      ) : null}
      <DetailField label="Client approval">
        <ClientApprovalPill status={clientIoStatus} />
      </DetailField>
      <DetailField label="Team member">
        {textOrMiss(accountManager?.full_name || accountManager?.email, "not assigned")}
      </DetailField>
      <DetailField label="Ad status">
        <AssignmentStatusPill status={line.assignment_status} />
      </DetailField>
      <DetailField
        label="Ad date"
        valueClassName={liveDateOverdue ? "r" : undefined}
      >
        {liveDate ? formatAssignmentDetailDate(liveDate) : <Miss>not set</Miss>}
      </DetailField>
      {showInternalFinancials ? (
        <DetailField label="Payment requested %" valueClassName="m">
          {resolvePaymentRequestedPercent(line)}
        </DetailField>
      ) : null}
    </>
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
    <>
      <DetailField label="Assignment line" valueClassName="m">
        <DocumentNumber value={line.document_number} />
      </DetailField>
      <DetailField label="Deliverable units" valueClassName="m">
        {deliverableCount}
      </DetailField>
      <DetailField label="Invoiced value" valueClassName="m">
        {formatMoney(group.rollups?.invoiced_value ?? 0, currency)}
      </DetailField>
      <DetailField label="Remaining billable" valueClassName="m">
        {formatMoney(group.rollups?.remaining_value ?? 0, currency)}
      </DetailField>
      {showInternalFinancials ? (
        <DetailField label="Collected value" valueClassName="m r">
          {formatMoney(group.rollups?.collected_value ?? 0, currency)}
        </DetailField>
      ) : null}
      <DetailField label="Campaign dates">
        {line.start_date || line.end_date ? (
          formatDesignDateRange(line.start_date, line.end_date)
        ) : (
          <Miss>not set</Miss>
        )}
      </DetailField>
      {showInternalFinancials ? (
        <>
          <DetailField label="Ops status">
            <ModalPill tone="b">{row.opsStatusLabel}</ModalPill>
          </DetailField>
          <DetailField label="Billing status">
            <ModalPill tone="y">{row.billingStatusLabel}</ModalPill>
          </DetailField>
          {line.vendor_io_document_number ? (
            <DetailField label="Vendor IO">
              <span className="tw-id">{line.vendor_io_document_number}</span>
            </DetailField>
          ) : null}
        </>
      ) : null}
    </>
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
      <p className="tw-empty">
        No linked social accounts for this creator.
      </p>
    );
  }

  const account = accounts[0];
  const followerValue =
    account.follower_count != null ? account.follower_count.toLocaleString() : "—";
  const engagementValue =
    account.engagement_rate != null ? formatPercent(account.engagement_rate) : "—";

  return (
    <>
      <div className="tw-soc">
        <div>
          <i>Followers</i>
          <b>{followerValue}</b>
        </div>
        <div>
          <i>Engagement</i>
          <b>{engagementValue}</b>
        </div>
        <div>
          <i>Avg reach</i>
          <b>—</b>
        </div>
        <div>
          <i>Posts tracked</i>
          <b>0</b>
        </div>
        <div>
          <i>Verified</i>
          <b>Yes</b>
        </div>
        <div>
          <i>Platform</i>
          <b>{account.platform}</b>
        </div>
      </div>
      <p className="tw-note wrn">
        Followers and engagement come from the connected profile. Reach is blank because none of this
        campaign’s publications synced.
      </p>
    </>
  );
}

function ActivityTab({ group }: { group: AssignmentHierarchyGroup }) {
  const [subTab, setSubTab] = useState<(typeof ACTIVITY_SUB_TABS)[number]>("content");
  const deliverables = group.deliverables ?? [];
  const line = group.line;
  const currency = resolveAssignmentLineCurrency(line);

  return (
    <div>
      <div className="tw-cdt">
        {ACTIVITY_SUB_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={subTab === tab}
            onClick={() => setSubTab(tab)}
          >
            {tab === "content" ? "Content" : tab === "publications" ? "Publications" : tab === "payments" ? "Payments" : "Actions"}
          </button>
        ))}
      </div>

      {subTab === "content" ? (
        deliverables.length === 0 ? (
          <p className="tw-empty">No deliverables on this assignment yet.</p>
        ) : (
          <table className="tw-act-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th className="tw-rr">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {deliverables.map((deliverable) => (
                <tr key={deliverable.id}>
                  <td className="tw-nm">{deliverable.label}</td>
                  <td className="tw-t">
                    {deliverable.deliverable_type_label ||
                      deliverableLabel(deliverable.deliverable_type)}
                  </td>
                  <td className="tw-v">
                    {formatMoney(deliverable.revenue_before_vat, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      {subTab === "publications" ? (
        <p className="tw-empty">Track live URLs in the Publications tab for this campaign.</p>
      ) : null}

      {subTab === "payments" ? (
        <>
          <DetailField label="Vendor payment">
            {textOrMiss(line.vendor_payment_status?.replace(/_/g, " "))}
          </DetailField>
          <DetailField label="Line payment status">
            {textOrMiss(line.payment_status)}
          </DetailField>
          <DetailField label="Cost received" valueClassName="m">
            {formatMoney(line.cost_received, line.cost_received_currency || currency)}
          </DetailField>
        </>
      ) : null}

      {subTab === "actions" ? (
        <>
          <DetailField label="Operational status">{textOrMiss(line.operational_status)}</DetailField>
          <DetailField label="Billing status">{textOrMiss(line.billing_status)}</DetailField>
          <DetailField label="Assignment locked">
            {line.vendor_assignment_locked ? "Yes" : "No"}
          </DetailField>
        </>
      ) : null}
    </div>
  );
}

function PerformanceTab({ group, row }: { group: AssignmentHierarchyGroup; row: AssignmentRowViewModel }) {
  const line = group.line;
  const currency = resolveAssignmentLineCurrency(line);
  const total = line.revenue_after_vat ?? line.revenue_before_vat ?? row.rollups.revenue;

  return (
    <>
      <div className="tw-soc">
        <div>
          <i>Total revenue with fees</i>
          <b>{formatMoney(total, currency)}</b>
        </div>
        <div>
          <i>Scope</i>
          <b>Campaign</b>
        </div>
        <div>
          <i>Reach</i>
          <b>—</b>
        </div>
        <div>
          <i>Views</i>
          <b>—</b>
        </div>
        <div>
          <i>Engagements</i>
          <b>—</b>
        </div>
        <div>
          <i>Publications</i>
          <b>0</b>
        </div>
      </div>
      <p className="tw-note wrn">
        Reach, views and engagements stay empty until a publication syncs.
      </p>
    </>
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
  const [avatarFailed, setAvatarFailed] = useState(false);

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

  const creatorAvatarUrl =
    line?.creator_avatar_url?.trim() ||
    line?.influencer_avatar_url?.trim() ||
    line?.creator_profile_image_url?.trim() ||
    null;
  const creatorProfileUrl =
    platformAccounts.find((account) => Boolean(account.profile_url?.trim()))?.profile_url ??
    line?.assignment?.platforms.find((platform) => Boolean(platform.profile_url?.trim()))
      ?.profile_url ??
    null;

  const lineId = line?.id ?? null;
  const influencerId = line?.influencer_id ?? null;
  const vendorProfileHref = influencerId ? vendorDetailPath(influencerId) : null;

  useEffect(() => {
    setAvatarFailed(false);
  }, [lineId, creatorAvatarUrl, creatorProfileUrl]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        showOverlay
        overlayClassName="campaign-detail-creator-scrim"
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
                {campaignName} / {line.document_number || handle}
              </div>
              <div className="tw-cm__av">
                {creatorAvatarUrl && !avatarFailed ? (
                  <CreatorAvatarImage
                    avatarUrl={creatorAvatarUrl}
                    profileUrl={creatorProfileUrl}
                    alt={creatorName}
                    sizeClassName="size-full"
                    className="border-0 bg-transparent"
                    onFailed={() => setAvatarFailed(true)}
                  />
                ) : (
                  initialsFromName(creatorName)
                )}
              </div>
              <h2>
                {vendorProfileHref ? (
                  <Link href={vendorProfileHref} className="tw-cm__name-btn">
                    {creatorName}
                  </Link>
                ) : (
                  creatorName
                )}
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
                      {vendorProfileHref ? (
                        <DropdownMenuItem asChild>
                          <Link href={vendorProfileHref}>Creator profile</Link>
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    type="button"
                    className="tw-dr__x"
                    aria-label="Close"
                    onClick={() => onOpenChange(false)}
                  >
                    ×
                  </button>
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
                {vendorProfileHref ? (
                  <Button asChild variant="outline" size="sm" className="tw-b sm">
                    <Link href={vendorProfileHref}>Creator profile</Link>
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
