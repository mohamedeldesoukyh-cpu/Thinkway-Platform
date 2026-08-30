import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatorProfilePayments } from "@/features/creator-workspace/components/creator-profile-payments";
import { CreatorSocialAccountsCard } from "@/features/creator-workspace/components/creator-social-accounts-card";
import { loadCreatorSocialProviderViews } from "@/features/creator-workspace/social-actions";
import { getCreatorPayments } from "@/features/portals/queries";
import { requireCreatorScope } from "@/features/portals/scope";
import {
  CREATOR_SOCIAL_CANCELLED,
  CREATOR_SOCIAL_DENIED,
  CREATOR_SOCIAL_INVALID_STATE,
} from "@/lib/creator-social/copy";

function socialNotice(value: string | undefined): string | null {
  if (value === "connected") return "Connected. Thinkway is syncing insights in the background.";
  if (value === "cancelled") return CREATOR_SOCIAL_CANCELLED;
  if (value === "denied") return CREATOR_SOCIAL_DENIED;
  if (value === "invalid" || value === "expired" || value === "replay" || value === "provider_mismatch") {
    return CREATOR_SOCIAL_INVALID_STATE;
  }
  if (value === "error") return "The connection could not be completed. You can try again.";
  return null;
}

export default async function CreatorPortalProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ social?: string; section?: string }>;
}) {
  const { social } = await searchParams;
  const { supabase, scope } = await requireCreatorScope("creator_portal.read");

  const [{ data: influencer }, { data: profile }, payments, socialProviders] = await Promise.all([
    supabase
      .from("influencers")
      .select("display_name, email, phone, country_code, city")
      .eq("id", scope.influencerId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", scope.userId)
      .maybeSingle(),
    getCreatorPayments(),
    loadCreatorSocialProviderViews(),
  ]);

  const influencerRow = influencer as {
    display_name?: string | null;
    email?: string | null;
    phone?: string | null;
    country_code?: string | null;
    city?: string | null;
  } | null;

  return (
    <PlatformErrorBoundary surface="generic">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>
              <span className="font-medium">Name: </span>
              {influencerRow?.display_name ?? profile?.full_name ?? "—"}
            </p>
            <p>
              <span className="font-medium">Email: </span>
              {influencerRow?.email ?? profile?.email ?? "—"}
            </p>
            <p>
              <span className="font-medium">Phone: </span>
              {influencerRow?.phone ?? "—"}
            </p>
            <p>
              <span className="font-medium">Country: </span>
              {influencerRow?.country_code ?? "—"}
            </p>
            <p>
              <span className="font-medium">City: </span>
              {influencerRow?.city ?? "—"}
            </p>
          </CardContent>
        </Card>

        <section id="payments" className="space-y-3" aria-labelledby="creator-profile-payments">
          <div>
            <h2 id="creator-profile-payments" className="text-base font-semibold">
              Payments
            </h2>
            <p className="text-sm text-muted-foreground">
              Amounts and status from your campaign assignments. Thinkway operations stay
              in sync with this same record.
            </p>
          </div>
          <CreatorProfilePayments rows={payments} />
        </section>

        <CreatorSocialAccountsCard
          providers={socialProviders}
          notice={socialNotice(social)}
        />
      </div>
    </PlatformErrorBoundary>
  );
}
