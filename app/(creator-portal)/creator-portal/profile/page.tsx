import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorAvatar, CreatorPageHeader } from "@/features/creator-workspace/components/creator-workspace-ui";
import { CreatorSocialAccountsCard } from "@/features/creator-workspace/components/creator-social-accounts-card";
import { formatJoinedMonth } from "@/features/creator-workspace/chrome";
import { resolveCreatorWorkspaceName } from "@/features/creator-workspace/identity";
import { loadCreatorSocialProviderViews } from "@/features/creator-workspace/social-actions";
import { requireCreatorScope } from "@/features/portals/scope";
import { resolveCreatorAvatarUrl } from "@/lib/performance/creator-avatar";
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

function mute(value: string | null | undefined): { text: string; empty: boolean } {
  const trimmed = value?.trim() || "";
  return trimmed ? { text: trimmed, empty: false } : { text: "Not provided", empty: true };
}

export default async function CreatorPortalProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ social?: string; section?: string }>;
}) {
  const { social } = await searchParams;
  const { supabase, scope } = await requireCreatorScope("creator_portal.read");

  const [{ data: influencer }, { data: profile }, { data: accounts }, socialProviders] =
    await Promise.all([
      supabase
        .from("influencers")
        .select("display_name, email, phone, country_code, city, created_at, metadata")
        .eq("id", scope.influencerId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", scope.userId)
        .maybeSingle(),
      supabase
        .from("influencer_platform_accounts")
        .select("platform, handle, profile_picture_url")
        .eq("influencer_id", scope.influencerId),
      loadCreatorSocialProviderViews(),
    ]);

  const influencerRow = influencer as {
    display_name?: string | null;
    email?: string | null;
    phone?: string | null;
    country_code?: string | null;
    city?: string | null;
    created_at?: string | null;
    metadata?: { avatar_url?: string | null } | null;
  } | null;

  const displayName = resolveCreatorWorkspaceName({
    influencerDisplayName: influencerRow?.display_name,
    profileFullName: profile?.full_name ?? null,
    email: influencerRow?.email ?? profile?.email ?? null,
  });

  const accountRows = (accounts ?? []) as Array<{
    platform: string | null;
    handle: string | null;
    profile_picture_url: string | null;
  }>;
  const picture =
    resolveCreatorAvatarUrl({
      social_profile_picture_url: accountRows.find((row) => row.profile_picture_url)?.profile_picture_url,
      influencer_avatar_url: influencerRow?.metadata?.avatar_url,
    }) ?? null;
  const handle =
    socialProviders.find((provider) => provider.connection?.handle)?.connection?.handle ??
    (accountRows.find((row) => row.handle)?.handle
      ? `@${accountRows.find((row) => row.handle)!.handle!.replace(/^@/, "")}`
      : null);
  const connected = socialProviders.filter((provider) => provider.connection).length;
  const phone = mute(influencerRow?.phone);
  const city = mute(influencerRow?.city);
  const country = mute(influencerRow?.country_code);
  const email = mute(influencerRow?.email ?? profile?.email);
  const joined = formatJoinedMonth(influencerRow?.created_at);

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorPageHeader
        title="Profile"
        description="Your details, as Thinkway has them on record."
      />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="idhd">
          <span className="idhd__ph">
            <CreatorAvatar name={displayName} src={picture} size="lg" />
          </span>
          <div className="idhd__b">
            <div className="idhd__n">{displayName}</div>
            <div className="idhd__m">
              {handle ? (
                <>
                  <span>{handle}</span>
                  <span style={{ color: "#c9d0dc" }}>·</span>
                </>
              ) : null}
              <span>
                {country.empty ? "" : country.text}
                {!country.empty && !city.empty ? " · " : ""}
                {city.empty ? "" : city.text}
                {country.empty && city.empty ? "Location not provided" : ""}
              </span>
              {joined ? (
                <>
                  <span style={{ color: "#c9d0dc" }}>·</span>
                  <span>Joined {joined}</span>
                </>
              ) : null}
            </div>
            <div style={{ marginTop: 9, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="pill pill--ok">Active</span>
              {connected ? (
                <span className="pill pill--blue">
                  {connected} account{connected === 1 ? "" : "s"} connected
                </span>
              ) : (
                <span className="pill pill--mute">No accounts connected</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grp">
        <div className="grp__h">
          <span className="grp__t">Contact details</span>
        </div>
        <dl className="dl">
          <div>
            <dt>Full name</dt>
            <dd>{displayName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd className={email.empty ? "mute" : undefined}>{email.text}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd className={phone.empty ? "mute" : undefined}>{phone.text}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd className={country.empty ? "mute" : undefined}>{country.text}</dd>
          </div>
          <div>
            <dt>City</dt>
            <dd className={city.empty ? "mute" : undefined}>{city.text}</dd>
          </div>
        </dl>
      </section>

      <CreatorSocialAccountsCard
        providers={socialProviders}
        notice={socialNotice(social)}
      />
    </PlatformErrorBoundary>
  );
}
