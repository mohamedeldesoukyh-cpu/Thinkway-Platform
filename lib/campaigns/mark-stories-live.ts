import { filterWritePayload } from "@/lib/campaigns/campaign-publications-schema";
import { getCampaignPublicationsSchema } from "@/lib/campaigns/campaign-publications-schema-runtime";
import { isEphemeralStoryDeliverableType } from "@/lib/campaigns/deliverable-taxonomy";
import {
  dateOnlyYmd,
  decideStoryLiveWrite,
  isStoryWorkflowLive,
  storyPostLabel,
  todayYmd,
  type CampaignStoryPostCandidate,
} from "@/lib/campaigns/mark-stories-live-policy";
import { syncLiveDateFromPublication } from "@/lib/campaigns/sync-live-date-from-publication";
import { uploadPublicationMedia } from "@/lib/performance/screenshot-capture/storage";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  decideStoryLiveWrite,
  defaultStoryWentLiveDate,
  isStoryWorkflowLive,
  storyPostLabel,
  todayYmd,
  type CampaignStoryPostCandidate,
} from "@/lib/campaigns/mark-stories-live-policy";

type Supabase = SupabaseClient<Database>;

const HIDDEN_STORY_STATUSES = new Set(["cancelled", "canceled"]);
const STORY_METRICS_STATUS = "manual_required";
const MAX_STORY_BATCH = 80;
const STORY_SCREENSHOT_SOURCE = "manual_upload";

export type MarkStoryLiveItem = {
  assignmentPostScheduleId: string;
  wentLiveDate: string;
  contentUrl?: string | null;
  notes?: string | null;
};

export type MarkStoryLiveResult = {
  assignmentPostScheduleId: string;
  publicationId: string;
  assignmentDeliverableId: string;
  alreadyLive: boolean;
  createdPublication: boolean;
};

function optionalHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function loadInfluencerIdForLine(
  supabase: Supabase,
  campaignId: string,
  lineId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("campaign_influencers")
    .select("influencer_id")
    .eq("campaign_header_id", campaignId)
    .eq("campaign_line_id", lineId)
    .not("influencer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.influencer_id ?? null;
}

export async function listCampaignStoryPosts(
  supabase: Supabase,
  input: { campaignId: string; campaignLineId: string }
): Promise<{ ok: true; posts: CampaignStoryPostCandidate[] } | { ok: false; message: string }> {
  const { data: line, error: lineError } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("id", input.campaignLineId)
    .eq("campaign_header_id", input.campaignId)
    .maybeSingle();

  if (lineError) return { ok: false, message: lineError.message };
  if (!line) return { ok: false, message: "Creator assignment not found on this campaign." };

  const { data: deliverableRows, error: deliverableError } = await supabase
    .from("assignment_deliverables")
    .select("id, platform, deliverable_type, campaign_line_id")
    .eq("campaign_header_id", input.campaignId)
    .eq("campaign_line_id", input.campaignLineId);

  if (deliverableError) return { ok: false, message: deliverableError.message };

  const storyDeliverables = (deliverableRows ?? []).filter((row) =>
    isEphemeralStoryDeliverableType(row.deliverable_type)
  );
  if (storyDeliverables.length === 0) return { ok: true, posts: [] };

  const deliverableById = new Map(storyDeliverables.map((row) => [row.id, row]));
  const { data: postRows, error: postError } = await supabase
    .from("assignment_post_schedule")
    .select("id, assignment_deliverable_id, campaign_line_id, sequence_number, live_date, status")
    .in(
      "assignment_deliverable_id",
      storyDeliverables.map((row) => row.id)
    )
    .order("sequence_number");

  if (postError) return { ok: false, message: postError.message };

  const posts = (postRows ?? []).filter(
    (row) => !HIDDEN_STORY_STATUSES.has((row.status ?? "").trim().toLowerCase())
  );
  const postIds = posts.map((row) => row.id);

  const publicationByPost = new Map<string, { id: string; screenshot_url: string | null }>();
  const screenshotPostIds = new Set<string>();
  if (postIds.length > 0) {
    const { data: publications } = await supabase
      .from("campaign_publications")
      .select("id, assignment_post_schedule_id, screenshot_url")
      .eq("campaign_header_id", input.campaignId)
      .in("assignment_post_schedule_id", postIds);
    for (const row of publications ?? []) {
      if (!row.assignment_post_schedule_id) continue;
      publicationByPost.set(row.assignment_post_schedule_id, {
        id: row.id,
        screenshot_url: row.screenshot_url,
      });
    }

    const { data: assets } = await supabase
      .from("deliverable_assets")
      .select("assignment_post_schedule_id")
      .eq("campaign_header_id", input.campaignId)
      .eq("asset_type", "story_screenshot")
      .is("archived_at", null)
      .in("assignment_post_schedule_id", postIds);
    for (const asset of assets ?? []) {
      if (asset.assignment_post_schedule_id) {
        screenshotPostIds.add(asset.assignment_post_schedule_id);
      }
    }
  }

  return {
    ok: true,
    posts: posts.map((row) => {
      const deliverable = deliverableById.get(row.assignment_deliverable_id);
      const publication = publicationByPost.get(row.id);
      const deliverableType = deliverable?.deliverable_type ?? "instagram_story";
      return {
        id: row.id,
        campaignLineId: row.campaign_line_id,
        assignmentDeliverableId: row.assignment_deliverable_id,
        sequenceNumber: row.sequence_number ?? 0,
        liveDate: dateOnlyYmd(row.live_date),
        status: row.status ?? "draft",
        alreadyLive: isStoryWorkflowLive(row.status),
        hasScreenshot:
          Boolean(publication?.screenshot_url?.trim()) || screenshotPostIds.has(row.id),
        publicationId: publication?.id ?? null,
        platform: deliverable?.platform ?? "instagram",
        deliverableType,
        label: storyPostLabel(deliverableType, row.sequence_number ?? 0),
      };
    }),
  };
}

async function insertStoryPublication(
  supabase: Supabase,
  input: {
    campaignId: string;
    campaignLineId: string;
    influencerId: string | null;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string;
    platform: string;
    publicationType: string;
    contentUrl: string | null;
    publicationDate: string;
    notes: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const schema = await getCampaignPublicationsSchema(supabase);
  const payload = filterWritePayload(
    {
      campaign_header_id: input.campaignId,
      campaign_line_id: input.campaignLineId,
      influencer_id: input.influencerId,
      assignment_deliverable_id: input.assignmentDeliverableId,
      assignment_post_schedule_id: input.assignmentPostScheduleId,
      platform: input.platform,
      publication_type: input.publicationType,
      content_url: input.contentUrl,
      publication_date: input.publicationDate,
      status: "published",
      notes: input.notes,
      auto_detected: false,
      detected_by: "story_live",
      metrics_refresh_status: STORY_METRICS_STATUS,
      metrics_collection_source: "not_applicable",
    },
    schema.columns
  );

  const { data, error } = await supabase
    .from("campaign_publications")
    .insert(payload as never)
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? "Failed to create story publication." };
  }
  return { ok: true, id: data.id };
}

export async function markStoriesLive(
  supabase: Supabase,
  input: { campaignId: string; items: MarkStoryLiveItem[] }
): Promise<
  | { ok: true; message: string; marked: number; results: MarkStoryLiveResult[] }
  | { ok: false; message: string }
> {
  if (input.items.length === 0) {
    return { ok: false, message: "Select at least one story to mark live." };
  }
  if (input.items.length > MAX_STORY_BATCH) {
    return { ok: false, message: `Mark up to ${MAX_STORY_BATCH} stories at a time.` };
  }

  const postIds = [...new Set(input.items.map((item) => item.assignmentPostScheduleId))];
  const { data: posts, error: postError } = await supabase
    .from("assignment_post_schedule")
    .select("id, assignment_deliverable_id, campaign_line_id, status, notes, locked_at, live_date")
    .in("id", postIds);

  if (postError) return { ok: false, message: postError.message };

  const postById = new Map((posts ?? []).map((row) => [row.id, row]));
  const deliverableIds = [...new Set((posts ?? []).map((row) => row.assignment_deliverable_id))];
  if (deliverableIds.length === 0) {
    return { ok: false, message: "A selected story could not be found." };
  }
  const { data: deliverables, error: deliverableError } = await supabase
    .from("assignment_deliverables")
    .select("id, campaign_header_id, campaign_line_id, platform, deliverable_type")
    .in("id", deliverableIds);

  if (deliverableError) return { ok: false, message: deliverableError.message };
  const deliverableById = new Map((deliverables ?? []).map((row) => [row.id, row]));

  const { data: existingPubs } = await supabase
    .from("campaign_publications")
    .select("id, assignment_post_schedule_id")
    .eq("campaign_header_id", input.campaignId)
    .in("assignment_post_schedule_id", postIds);
  const publicationByPost = new Map<string, string>();
  for (const row of existingPubs ?? []) {
    if (row.assignment_post_schedule_id) {
      publicationByPost.set(row.assignment_post_schedule_id, row.id);
    }
  }

  const influencerByLine = new Map<string, string | null>();
  const results: MarkStoryLiveResult[] = [];
  const failures: string[] = [];
  let marked = 0;

  for (const item of input.items) {
    const post = postById.get(item.assignmentPostScheduleId);
    if (!post) {
      failures.push("A selected story could not be found.");
      continue;
    }
    const deliverable = deliverableById.get(post.assignment_deliverable_id);
    if (!deliverable || deliverable.campaign_header_id !== input.campaignId) {
      failures.push("A selected story does not belong to this campaign.");
      continue;
    }
    const decision = decideStoryLiveWrite({
      deliverableType: deliverable.deliverable_type ?? "",
      postStatus: post.status,
      existingPublicationId: publicationByPost.get(post.id) ?? null,
    });
    if (!decision.eligible) {
      failures.push("Only planned stories can be marked live here.");
      continue;
    }

    const wentLiveDate = dateOnlyYmd(item.wentLiveDate) ?? todayYmd();
    const notes = item.notes?.trim() || null;
    const contentUrl = optionalHttpUrl(item.contentUrl);

    if (decision.markPosted) {
      const { error: statusError } = await supabase
        .from("assignment_post_schedule")
        .update({
          status: "posted",
          ...(notes ? { notes } : {}),
          ...(post.locked_at ? {} : { live_date: wentLiveDate }),
        })
        .eq("id", post.id);
      if (statusError) {
        failures.push(statusError.message);
        continue;
      }
    }

    let publicationId = publicationByPost.get(post.id) ?? null;
    let createdPublication = false;
    if (!publicationId) {
      if (!influencerByLine.has(post.campaign_line_id)) {
        influencerByLine.set(
          post.campaign_line_id,
          await loadInfluencerIdForLine(supabase, input.campaignId, post.campaign_line_id)
        );
      }
      const inserted = await insertStoryPublication(supabase, {
        campaignId: input.campaignId,
        campaignLineId: post.campaign_line_id,
        influencerId: influencerByLine.get(post.campaign_line_id) ?? null,
        assignmentDeliverableId: post.assignment_deliverable_id,
        assignmentPostScheduleId: post.id,
        platform: deliverable.platform || "instagram",
        publicationType: deliverable.deliverable_type || "instagram_story",
        contentUrl,
        publicationDate: wentLiveDate,
        notes,
      });
      if (!inserted.ok) {
        failures.push(inserted.message);
        continue;
      }
      publicationId = inserted.id;
      createdPublication = true;
      publicationByPost.set(post.id, publicationId);
      if (wentLiveDate && !post.locked_at) {
        try {
          await syncLiveDateFromPublication(supabase, {
            campaignHeaderId: input.campaignId,
            campaignLineId: post.campaign_line_id,
            platform: deliverable.platform || "instagram",
            publicationDate: wentLiveDate,
            publicationId,
          });
        } catch (syncError) {
          console.warn("[mark-stories-live] live date sync failed", syncError);
        }
      }
    }

    results.push({
      assignmentPostScheduleId: post.id,
      publicationId,
      assignmentDeliverableId: post.assignment_deliverable_id,
      alreadyLive: !decision.markPosted && !createdPublication,
      createdPublication,
    });
    if (decision.markPosted || createdPublication) marked += 1;
  }

  if (results.length === 0) {
    return { ok: false, message: failures[0] ?? "Could not mark stories live." };
  }

  const skipped = input.items.length - marked;
  const message =
    marked === 0
      ? skipped === 1
        ? "That story is already live."
        : "Those stories are already live."
      : marked === 1
        ? "Story marked live."
        : `${marked} stories marked live.`;

  return { ok: true, message, marked, results };
}

export async function persistStoryScreenshotOnPublication(
  supabase: Supabase,
  input: {
    campaignId: string;
    publicationId: string;
    bucket: string;
    storagePath: string;
    fileName: string;
    mimeType: string;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const downloaded = await supabase.storage.from(input.bucket).download(input.storagePath);
  if (downloaded.error || !downloaded.data) {
    return { ok: false, message: downloaded.error?.message ?? "Could not read the screenshot." };
  }

  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "story-screenshot.jpg";
  let storedPath: string;
  try {
    storedPath = await uploadPublicationMedia(
      supabase,
      input.publicationId,
      safeName,
      bytes,
      input.mimeType || "image/jpeg"
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not store the screenshot.",
    };
  }

  const schema = await getCampaignPublicationsSchema(supabase);
  const payload = filterWritePayload(
    {
      screenshot_url: storedPath,
      screenshot_captured_at: new Date().toISOString(),
      screenshot_source: STORY_SCREENSHOT_SOURCE,
      updated_at: new Date().toISOString(),
    },
    schema.columns
  );
  const { error } = await supabase
    .from("campaign_publications")
    .update(payload as never)
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
