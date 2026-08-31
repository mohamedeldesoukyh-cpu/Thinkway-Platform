import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorCampaignCards } from "@/features/creator-workspace/components/creator-campaign-cards";
import { CreatorHomeInsights } from "@/features/creator-workspace/components/creator-home-insights";
import { CreatorHomeNextActionList } from "@/features/creator-workspace/components/creator-home-next-action-list";
import { CreatorHomePublications } from "@/features/creator-workspace/components/creator-home-publications";
import { CreatorProfilePayments } from "@/features/creator-workspace/components/creator-profile-payments";
import { CreatorSocialAvailableSoon } from "@/features/creator-workspace/components/creator-social-available-soon";
import {
  campaignNeedsCreatorAction,
  overlayCreatorCampaignUnitCounts,
} from "@/features/creator-workspace/campaign-card-model";
import { loadCreatorUnitViews } from "@/features/creator-workspace/documentation-load";
import {
  buildCreatorHomeNextActions,
  creatorFirstName,
} from "@/features/creator-workspace/home-next-actions";
import { PortalNotificationList } from "@/features/portals/components/portal-notification-list";
import {
  getCreatorCampaigns,
  getCreatorNotifications,
  getCreatorPayments,
  getCreatorPublications,
  getCreatorUnreadNotificationCount,
  getCreatorVendorIos,
} from "@/features/portals/queries";
import { requireCreatorScope } from "@/features/portals/scope";
import { loadOwnCreatorInsightPack } from "@/lib/creator-insights/service";
import { upcomingUnitsFromViews } from "@/lib/creator-insights/presentation";

export default async function CreatorWorkspaceHomePage() {
  const [
    { scope },
    campaigns,
    units,
    payments,
    vendorIos,
    notifications,
    publications,
    unreadCount,
  ] = await Promise.all([
    requireCreatorScope("creator_portal.read"),
    getCreatorCampaigns(),
    loadCreatorUnitViews(),
    getCreatorPayments(),
    getCreatorVendorIos(),
    getCreatorNotifications(),
    getCreatorPublications(),
    getCreatorUnreadNotificationCount(),
  ]);

  const overlayedCampaigns = overlayCreatorCampaignUnitCounts(campaigns, units);
  const insightPack = await loadOwnCreatorInsightPack(upcomingUnitsFromViews(units));
  const nextActions = buildCreatorHomeNextActions({
    vendorIos,
    units,
    payments,
  });
  const campaignsNeedingAction = overlayedCampaigns.filter((row) =>
    campaignNeedsCreatorAction(row)
  );
  const homeCampaigns =
    campaignsNeedingAction.length > 0
      ? campaignsNeedingAction
      : overlayedCampaigns.slice(0, 4);

  return (
    <PlatformErrorBoundary surface="generic">
      <div className="space-y-5">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Hi {creatorFirstName(scope.influencerName)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {nextActions.length > 0
              ? "Here is what needs your attention."
              : "You're all caught up."}
            {unreadCount > 0
              ? ` You have ${unreadCount} update${unreadCount === 1 ? "" : "s"}.`
              : ""}
          </p>
        </div>

        <section className="space-y-2" aria-labelledby="creator-home-next">
          <h3 id="creator-home-next" className="text-sm font-semibold">
            Needs your attention
          </h3>
          <CreatorHomeNextActionList actions={nextActions} />
        </section>

        <section className="space-y-2" aria-labelledby="creator-home-campaigns">
          <h3 id="creator-home-campaigns" className="text-sm font-semibold">
            {campaignsNeedingAction.length > 0 ? "Active campaigns" : "Your campaigns"}
          </h3>
          <CreatorCampaignCards rows={homeCampaigns} insightPack={insightPack} />
        </section>

        <section className="space-y-2" aria-labelledby="creator-home-payments">
          <h3 id="creator-home-payments" className="text-sm font-semibold">
            Payment status
          </h3>
          <CreatorProfilePayments rows={payments.slice(0, 3)} />
        </section>

        <section id="updates" className="space-y-2" aria-labelledby="creator-home-updates">
          <h3 id="creator-home-updates" className="text-sm font-semibold">
            Recent activity
          </h3>
          <PortalNotificationList
            notifications={notifications.slice(0, 8)}
            audienceType="creator"
          />
        </section>

        <CreatorHomePublications rows={publications.slice(0, 6)} />

        {insightPack.recommendations.length > 0 ? (
          <CreatorHomeInsights pack={insightPack} />
        ) : (
          <section className="space-y-2" aria-labelledby="creator-home-insights">
            <h3 id="creator-home-insights" className="text-sm font-semibold">
              Thinkway Insights
            </h3>
            <p className="text-sm text-muted-foreground">
              Insights appear after your content is published.
            </p>
          </section>
        )}

        <CreatorSocialAvailableSoon />
      </div>
    </PlatformErrorBoundary>
  );
}
