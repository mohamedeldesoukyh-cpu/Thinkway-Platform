import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorCampaignCards } from "@/features/creator-workspace/components/creator-campaign-cards";
import { CreatorCalendarUpcoming } from "@/features/creator-workspace/components/creator-calendar-view";
import { CreatorHomeNextActionList } from "@/features/creator-workspace/components/creator-home-next-action-list";
import {
  CreatorKpis,
  CreatorPageHeader,
} from "@/features/creator-workspace/components/creator-workspace-ui";
import { overlayCreatorCampaignUnitCounts } from "@/features/creator-workspace/campaign-card-model";
import { buildCreatorCalendarItems } from "@/features/creator-workspace/calendar";
import {
  todayIso,
  unitIsOverdueForCreator,
  unitNeedsCreatorAction,
} from "@/features/creator-workspace/chrome";
import { loadCreatorUnitViews } from "@/features/creator-workspace/documentation-load";
import {
  buildCreatorHomeNextActions,
  countUnitsNeedingCreator,
  creatorFirstName,
} from "@/features/creator-workspace/home-next-actions";
import { creatorPaymentIsOutstanding } from "@/features/creator-workspace/payment-copy";
import { CREATOR_WORKSPACE_CALENDAR_HREF } from "@/features/creator-workspace/nav";
import {
  getCreatorCampaigns,
  getCreatorPayments,
  getCreatorVendorIos,
} from "@/features/portals/queries";
import { requireCreatorScope } from "@/features/portals/scope";
import { formatPortalCurrency } from "@/features/portals/components/portal-table-utils";
import Link from "next/link";

export default async function CreatorWorkspaceHomePage() {
  const [
    { scope },
    campaigns,
    units,
    payments,
    vendorIos,
  ] = await Promise.all([
    requireCreatorScope("creator_portal.read"),
    getCreatorCampaigns(),
    loadCreatorUnitViews(),
    getCreatorPayments(),
    getCreatorVendorIos(),
  ]);

  const overlayedCampaigns = overlayCreatorCampaignUnitCounts(campaigns, units);
  const nextActions = buildCreatorHomeNextActions({ vendorIos, units });
  const today = todayIso();
  const overdue = units.filter((unit) => unitIsOverdueForCreator(unit, today));
  const pendingPay = payments.filter((row) => creatorPaymentIsOutstanding(row.payment_status));
  const pendingTotal = pendingPay.reduce((sum, row) => sum + row.pending_amount, 0);
  const pendingCurrency =
    pendingPay.length > 0 && pendingPay.every((row) => row.currency_code === pendingPay[0]?.currency_code)
      ? pendingPay[0]!.currency_code
      : null;
  const calendarItems = buildCreatorCalendarItems({ campaigns: overlayedCampaigns, units });

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorPageHeader
        title={`Hi ${creatorFirstName(scope.influencerName)}`}
        description={
          nextActions.length > 0
            ? "Here is what needs you."
            : "Nothing is waiting on you right now."
        }
      />

      <CreatorHomeNextActionList actions={nextActions} />

      {pendingPay.length > 0 ? (
        <div className="info">
          <span className="info__ic">
            <svg viewBox="0 0 24 24">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </span>
          <span className="info__b">
            <span className="info__h">
              {pendingCurrency
                ? `${formatPortalCurrency(pendingTotal, pendingCurrency)} pending payment`
                : `${pendingPay.length} pending payment${pendingPay.length === 1 ? "" : "s"}`}
            </span>
            <span className="info__s">Thinkway processes this — nothing needed from you.</span>
          </span>
          <Link href="/creator-portal/payments" className="btn btn-sm">
            View
          </Link>
        </div>
      ) : null}

      <CreatorKpis
        items={[
          {
            label: "Campaigns",
            value: overlayedCampaigns.length,
            hint: "Assigned to you",
          },
          {
            label: "To deliver",
            value: countUnitsNeedingCreator(units),
            hint: "Waiting on you",
          },
          {
            label: "Published",
            value: units.filter((unit) => unit.status === "published").length,
            hint: "Live on platform",
            tone: "ok",
          },
          {
            label: "Overdue",
            value: overdue.length,
            hint: overdue.length ? "Past due date" : "All on time",
            tone: overdue.length ? "alert" : undefined,
          },
        ]}
      />

      <section className="grp">
        <div className="grp__h">
          <span className="grp__t">Coming up</span>
          <Link href={CREATOR_WORKSPACE_CALENDAR_HREF} className="grp__a">
            Open calendar
          </Link>
        </div>
        <CreatorCalendarUpcoming items={calendarItems} limit={5} />
      </section>

      <section className="grp">
        <div className="grp__h">
          <span className="grp__t">Your campaigns</span>
          {overlayedCampaigns.length ? (
            <Link href="/creator-portal/campaigns" className="grp__a">
              View all
            </Link>
          ) : null}
        </div>
        <CreatorCampaignCards rows={overlayedCampaigns} />
      </section>
    </PlatformErrorBoundary>
  );
}
