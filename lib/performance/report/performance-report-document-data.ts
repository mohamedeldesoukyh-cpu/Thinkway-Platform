import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CampaignPerformanceBundle,
  CampaignPublicationRow,
} from "@/lib/domains/campaign/types";
import { getCampaignPerformanceBundle } from "@/lib/services/campaigns/campaign-publication-service";
import { getPlatformOptionLabel } from "@/lib/campaigns/deliverable-taxonomy";
import { partitionPublicationsByValueScope } from "@/lib/performance/publication-value-scope";
import { resolvePublicationRowCreatorAvatar } from "@/lib/performance/creator-avatar";
import { createPublicationMediaSignedUrl } from "@/lib/performance/screenshot-capture/storage";
import { embedCampaignPublicationPreview } from "@/lib/performance/report/embed-publication-previews";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import { buildQrCodeDataUri, buildQrCodeImageUrl } from "@/lib/performance/report/qr-code";
import type {
  CampaignHighlights,
  InfluencerReportSection,
  PerformanceReportDocumentData,
  PerformanceReportVariant,
  PlatformBenchmark,
} from "@/lib/performance/report/performance-report-types";

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatObjectives(value: unknown): string | null {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === "string" ? item.trim() : null))
      .filter(Boolean);
    return items.length > 0 ? items.join("; ") : null;
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function formatDateRange(start: string | null, end: string | null): string {
  const fmt = (d: string | null) => {
    if (!d) return "—";
    const parsed = new Date(`${d}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function publicationLabel(pub: CampaignPublicationRow): string {
  return `${pub.influencer_name ?? "Creator"} · ${pub.platform_label}`;
}

function buildHighlights(bundle: CampaignPerformanceBundle): CampaignHighlights {
  const { summary, publications, charts } = bundle;
  const bestPost = [...publications].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];
  const highestErPub = [...publications]
    .filter((p) => p.engagement_rate != null)
    .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))[0];

  return {
    topCreatorName: summary.top_creator_name,
    topCreatorEngagements: summary.top_creator_engagements,
    bestPostLabel: bestPost ? publicationLabel(bestPost) : null,
    bestPostViews: bestPost?.views ?? 0,
    highestErLabel: highestErPub ? publicationLabel(highestErPub) : null,
    highestEr: highestErPub?.engagement_rate ?? null,
    totalEngagements: summary.total_engagements,
    platforms: charts.platform_split.map((p) => p.platform),
  };
}

function buildPlatformBenchmarks(bundle: CampaignPerformanceBundle): PlatformBenchmark[] {
  const byPlatform = new Map<string, { ers: number[]; count: number }>();
  for (const pub of bundle.publications) {
    const key = pub.platform;
    const entry = byPlatform.get(key) ?? { ers: [], count: 0 };
    entry.count += 1;
    if (pub.engagement_rate != null) entry.ers.push(pub.engagement_rate);
    byPlatform.set(key, entry);
  }

  return [...byPlatform.entries()].map(([platform, stats]) => ({
    platform,
    label: getPlatformOptionLabel(platform),
    averageEr:
      stats.ers.length > 0 ? stats.ers.reduce((a, b) => a + b, 0) / stats.ers.length : null,
    publicationCount: stats.count,
  }));
}

function buildRecommendations(
  bundle: CampaignPerformanceBundle,
  benchmarks: PlatformBenchmark[]
): string[] {
  const recs: string[] = [];
  const { summary, publications } = bundle;

  if (summary.top_creator_name) {
    recs.push(
      `${summary.top_creator_name} drove the highest total engagements — consider extending or amplifying this partnership.`
    );
  }

  const topPlatform = [...benchmarks].sort(
    (a, b) => (b.averageEr ?? 0) - (a.averageEr ?? 0)
  )[0];
  if (topPlatform?.averageEr != null) {
    recs.push(
      `${topPlatform.label} delivered the strongest average engagement rate (${topPlatform.averageEr.toFixed(2)}%) across ${topPlatform.publicationCount} post(s).`
    );
  }

  const partialCount = publications.filter((p) => p.metrics_refresh_status === "partial").length;
  if (partialCount > 0) {
    recs.push(
      `${partialCount} publication(s) have partial metrics — refresh before final client delivery where platform APIs allow.`
    );
  }

  const noViews = publications.filter((p) => p.views == null && p.comments != null).length;
  if (noViews > 0) {
    recs.push(
      `${noViews} post(s) report comments without view/like data (common on Instagram carousels with hidden likes).`
    );
  }

  if (summary.added_value_publications > 0) {
    recs.push(
      `${summary.added_value_publications} added-value publication(s) were delivered beyond the agreed assignment mix.`
    );
  }

  if (summary.average_engagement_rate != null && summary.average_engagement_rate > 3) {
    recs.push("Campaign average ER exceeds 3% — strong audience resonance relative to industry benchmarks.");
  }

  if (recs.length === 0) {
    recs.push("Continue monitoring publication metrics through the campaign flight for trend analysis.");
  }

  return recs.slice(0, 5);
}

function buildInfluencerInsights(
  publications: CampaignPublicationRow[],
  name: string
): string[] {
  const insights: string[] = [];
  const bestViews = [...publications].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];
  const bestEr = [...publications]
    .filter((p) => p.engagement_rate != null)
    .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))[0];

  if (bestViews?.views) {
    insights.push(
      `Best performing content by views: ${bestViews.platform_label} ${bestViews.publication_type_label} (${bestViews.views?.toLocaleString()} views).`
    );
  }
  if (bestEr?.engagement_rate != null) {
    insights.push(
      `Highest engagement rate: ${bestEr.platform_label} post at ${bestEr.engagement_rate.toFixed(2)}% ER.`
    );
  }

  const totalComments = publications.reduce((s, p) => s + (p.comments ?? 0), 0);
  if (totalComments > 0) {
    insights.push(
      `${name} generated ${totalComments.toLocaleString()} total comments across ${publications.length} publication(s).`
    );
  }

  const addedValueCount = publications.filter(
    (publication) => publication.value_scope === "added_value"
  ).length;
  if (addedValueCount > 0) {
    insights.push(
      `${addedValueCount} added-value publication(s) were delivered beyond the agreed assignment platforms.`
    );
  }

  if (insights.length === 0) {
    insights.push("Metrics are still collecting — insights will refine as sync completes.");
  }

  return insights;
}

async function signPublicationMedia(
  supabase: SupabaseClient,
  bundle: CampaignPerformanceBundle
): Promise<CampaignPerformanceBundle> {
  const publications = await Promise.all(
    bundle.publications.map(async (row) => {
      const [creator_avatar_url, preview] = await Promise.all([
        row.creator_avatar_url?.startsWith("http")
          ? Promise.resolve(row.creator_avatar_url)
          : createPublicationMediaSignedUrl(supabase, row.creator_avatar_url, 60 * 60 * 24),
        embedCampaignPublicationPreview(row),
      ]);

      const resolvedAvatar =
        resolvePublicationRowCreatorAvatar({
          platform: row.platform,
          publication_type: row.publication_type,
          content_url: row.content_url,
          creator_profile_image_url: row.creator_profile_image_url,
          influencer_avatar_url: row.influencer_avatar_url,
          social_profile_picture_url: row.social_profile_picture_url,
          apify_author_avatar_url: row.apify_author_avatar_url,
        }) ?? creator_avatar_url;

      const embeddedAvatar = resolvedAvatar
        ? await embedReportImageDataUri(resolvedAvatar)
        : null;

      return {
        ...row,
        thumbnail_url: preview,
        screenshot_url: preview,
        creator_avatar_url: embeddedAvatar ?? resolvedAvatar ?? row.creator_avatar_url,
      };
    })
  );
  return { ...bundle, publications };
}

async function buildInfluencerSections(
  supabase: SupabaseClient,
  bundle: CampaignPerformanceBundle
): Promise<InfluencerReportSection[]> {
  const influencerIds = [
    ...new Set(
      bundle.publications
        .map((p) => p.influencer_id)
        .filter((id): id is string => id != null)
    ),
  ];

  type ProfileMeta = {
    avatarUrl: string | null;
    handles: string[];
    followerCount: number | null;
    audienceGender: Record<string, number> | null;
    audienceLocation: string | null;
  };

  const profiles = new Map<string, ProfileMeta>();
  if (influencerIds.length > 0) {
    const { data: accounts } = await supabase
      .from("influencer_platform_accounts")
      .select(
        "influencer_id, platform, handle, profile_picture_url, follower_count, audience_country, audience_gender_split, is_primary"
      )
      .in("influencer_id", influencerIds);

    for (const row of accounts ?? []) {
      const existing = profiles.get(row.influencer_id) ?? {
        avatarUrl: null,
        handles: [],
        followerCount: null,
        audienceGender: null,
        audienceLocation: null,
      };
      if (row.is_primary && row.profile_picture_url) {
        existing.avatarUrl = row.profile_picture_url;
      } else if (!existing.avatarUrl && row.profile_picture_url) {
        existing.avatarUrl = row.profile_picture_url;
      }
      if (row.is_primary && row.follower_count != null) {
        existing.followerCount = row.follower_count;
      } else if (existing.followerCount == null && row.follower_count != null) {
        existing.followerCount = row.follower_count;
      }
      if (row.audience_country && !existing.audienceLocation) {
        existing.audienceLocation = row.audience_country;
      }
      if (row.audience_gender_split && typeof row.audience_gender_split === "object") {
        const split = row.audience_gender_split as Record<string, unknown>;
        const normalized: Record<string, number> = {};
        for (const [key, val] of Object.entries(split)) {
          const n = Number(val);
          if (Number.isFinite(n)) normalized[key] = n;
        }
        if (Object.keys(normalized).length > 0) existing.audienceGender = normalized;
      }
      if (row.handle) {
        existing.handles.push(`${row.platform}: @${row.handle}`);
      }
      profiles.set(row.influencer_id, existing);
    }
  }

  const byInfluencer = new Map<string, CampaignPerformanceBundle["publications"]>();
  for (const pub of bundle.publications) {
    const key = pub.influencer_id ?? "unknown";
    const list = byInfluencer.get(key) ?? [];
    list.push(pub);
    byInfluencer.set(key, list);
  }

  const sections = await Promise.all(
    [...byInfluencer.entries()].map(async ([influencerId, publications]) => {
      const name = publications[0]?.influencer_name ?? "Unknown creator";
      const profile = profiles.get(influencerId);
      const firstPub = publications[0];
      const avatarUrl =
        resolvePublicationRowCreatorAvatar(firstPub) ??
        profile?.avatarUrl ??
        null;

      const { agreed: agreedPublications, addedValue: addedValuePublications } =
        partitionPublicationsByValueScope(publications);
      const views = publications.reduce((s, p) => s + (p.views ?? 0), 0);
      const reach = publications.reduce((s, p) => s + (p.reach ?? 0), 0);
      const impressions = publications.reduce((s, p) => s + (p.impressions ?? 0), 0);
      const actualImpressions = publications.reduce(
        (s, p) => s + (p.impressions_source === "actual" ? p.impressions ?? 0 : 0),
        0
      );
      const forecastImpressions = publications.reduce(
        (s, p) => s + (p.impressions_source === "forecast" ? p.impressions ?? 0 : 0),
        0
      );
      const engagements = publications.reduce((s, p) => s + p.total_engagements, 0);
      const erValues = publications
        .map((p) => p.engagement_rate)
        .filter((v): v is number => v != null);

      return {
        influencerId,
        name,
        avatarUrl: avatarUrl ? await embedReportImageDataUri(avatarUrl) : null,
        platformHandles: profile?.handles ?? [],
        followerCount: profile?.followerCount ?? null,
        role: "Campaign Creator",
        audience: {
          genderSplit: profile?.audienceGender ?? null,
          topLocation: profile?.audienceLocation ?? null,
          followerCount: profile?.followerCount ?? null,
        },
        insights: buildInfluencerInsights(publications, name),
        summary: {
          publications: publications.length,
          agreedPublications: agreedPublications.length,
          addedValuePublications: addedValuePublications.length,
          views,
          reach,
          impressions,
          actualImpressions,
          forecastImpressions,
          engagements,
          averageEr:
            erValues.length > 0 ? erValues.reduce((a, b) => a + b, 0) / erValues.length : null,
        },
        publications,
      };
    })
  );

  return sections.sort((a, b) => b.summary.engagements - a.summary.engagements);
}

function resolveCoverImage(
  campaignMetadata: Record<string, unknown> | null,
  brandMetadata: Record<string, unknown> | null,
  publications: CampaignPublicationRow[]
): string | null {
  const fromCampaign =
    typeof campaignMetadata?.cover_image_url === "string"
      ? campaignMetadata.cover_image_url
      : typeof campaignMetadata?.hero_image_url === "string"
        ? campaignMetadata.hero_image_url
        : null;
  if (fromCampaign) return fromCampaign;

  const fromBrand =
    typeof brandMetadata?.logo_url === "string"
      ? brandMetadata.logo_url
      : typeof brandMetadata?.cover_image_url === "string"
        ? brandMetadata.cover_image_url
        : null;
  if (fromBrand) return fromBrand;

  const withScreenshot = publications.find((p) => p.screenshot_url);
  return withScreenshot?.screenshot_url ?? publications.find((p) => p.thumbnail_url)?.thumbnail_url ?? null;
}

function resolveBrandLogo(brandMetadata: Record<string, unknown> | null): string | null {
  return typeof brandMetadata?.logo_url === "string" ? brandMetadata.logo_url : null;
}

export async function loadPerformanceReportDocumentData(
  supabase: SupabaseClient,
  campaignHeaderId: string,
  variant: PerformanceReportVariant = "combined",
  options?: { publicationIds?: string[] }
): Promise<PerformanceReportDocumentData> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.thinkwaymedia.com";

  const [{ data: campaign, error }, bundleRaw] = await Promise.all([
    supabase
      .from("campaign_headers")
      .select(
        "id, document_number, name, description, brief, start_date, end_date, objectives, currency_code, metadata, brands:brand_id(name, metadata), clients:client_id(name, legal_name, country)"
      )
      .eq("id", campaignHeaderId)
      .maybeSingle(),
    getCampaignPerformanceBundle(campaignHeaderId, supabase),
  ]);

  if (error || !campaign) {
    throw new Error(error?.message ?? "Campaign not found.");
  }

  const brand = unwrapRelation(
    (campaign as { brands: { name: string; metadata?: Record<string, unknown> } | { name: string; metadata?: Record<string, unknown> }[] | null }).brands
  );
  const client = unwrapRelation(
    (
      campaign as {
        clients:
          | { name: string; legal_name: string | null; country: string | null }
          | Array<{ name: string; legal_name: string | null; country: string | null }>
          | null;
      }
    ).clients
  );

  let bundle = await signPublicationMedia(supabase, bundleRaw);

  if (options?.publicationIds?.length) {
    const allowed = new Set(options.publicationIds);
    bundle = {
      ...bundle,
      publications: bundle.publications.filter((publication) => allowed.has(publication.id)),
    };
    if (bundle.publications.length === 0) {
      throw new Error("No publications match the selected filter.");
    }
  }

  const influencerSections = await buildInfluencerSections(supabase, bundle);
  const uniqueCreatorCount = new Set(
    bundle.publications.map((p) => p.influencer_id ?? p.influencer_name ?? p.id)
  ).size;

  const typed = campaign as {
    id: string;
    document_number: string;
    name: string;
    description: string | null;
    brief: string | null;
    start_date: string | null;
    end_date: string | null;
    objectives: unknown;
    currency_code: string;
    metadata: Record<string, unknown> | null;
  };

  const brandMetadata = (brand as { metadata?: Record<string, unknown> } | null)?.metadata ?? null;
  const coverImageUrl = resolveCoverImage(typed.metadata, brandMetadata, bundle.publications);
  const brandLogoUrl = resolveBrandLogo(brandMetadata);
  const dashboardUrl = `${appUrl.replace(/\/$/, "")}/campaigns/${typed.id}`;
  const qrCodeImageUrl =
    (await buildQrCodeDataUri(dashboardUrl, 160)) ??
    (await embedReportImageDataUri(buildQrCodeImageUrl(dashboardUrl, 160)));
  const platformBenchmarks = buildPlatformBenchmarks(bundle);
  const highlights = buildHighlights(bundle);
  const recommendations = buildRecommendations(bundle, platformBenchmarks);

  const bestCreatorSection = influencerSections.reduce<InfluencerReportSection | null>(
    (best, section) => {
      if (section.summary.averageEr == null) return best;
      if (!best || (best.summary.averageEr ?? 0) < section.summary.averageEr) return section;
      return best;
    },
    null
  );

  return {
    campaign: {
      id: typed.id,
      documentNumber: typed.document_number,
      name: typed.name,
      description: typed.description,
      brief: typed.brief,
      startDate: typed.start_date,
      endDate: typed.end_date,
      objectives: formatObjectives(typed.objectives) ?? typed.brief ?? typed.description,
      country: client?.country ?? null,
      clientName: client?.legal_name ?? client?.name ?? "Client",
      brandName: brand?.name ?? null,
      brandLogoUrl,
      coverImageUrl,
      qrCodeImageUrl,
      currency: typed.currency_code ?? bundle.summary.currency,
      dashboardUrl,
    },
    bundle,
    generatedAt: new Date(),
    variant,
    influencerSections,
    uniqueCreatorCount,
    highlights,
    platformBenchmarks,
    recommendations,
    bestCreatorEr: bestCreatorSection?.summary.averageEr ?? null,
    bestCreatorErName: bestCreatorSection?.name ?? null,
  };
}

export { formatDateRange };
