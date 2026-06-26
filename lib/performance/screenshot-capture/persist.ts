import type { SupabaseClient } from "@supabase/supabase-js";

import { filterWritePayload } from "@/lib/campaigns/campaign-publications-schema";
import { getCampaignPublicationsSchema } from "@/lib/campaigns/campaign-publications-schema-runtime";
import type {
  ScreenshotCaptureAttempt,
  ScreenshotCaptureOutcome,
  ScreenshotCaptureTrigger,
  ScreenshotSource,
} from "@/lib/performance/screenshot-capture/types";

export async function writeScreenshotSyncLog(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    status: string;
    source?: ScreenshotSource | null;
    attemptOrder?: number;
    message?: string;
    errorCode?: string;
    error?: string | null;
    triggeredBy: ScreenshotCaptureTrigger;
    durationMs?: number;
    completed?: boolean;
  }
) {
  await supabase.from("publication_screenshot_sync_logs").insert({
    publication_id: input.publicationId,
    campaign_header_id: input.campaignHeaderId,
    status: input.status,
    source: input.source ?? null,
    attempt_order: input.attemptOrder ?? 1,
    message: input.message ?? null,
    error_code: input.errorCode ?? null,
    error: input.error ?? null,
    triggered_by: input.triggeredBy,
    duration_ms: input.durationMs ?? null,
    completed_at: input.completed ? new Date().toISOString() : null,
  } as never);
}

export async function persistPublicationScreenshot(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    thumbnailPath: string | null;
    screenshotPath: string | null;
    source: ScreenshotSource;
  }
) {
  const schema = await getCampaignPublicationsSchema(supabase);
  const payload = filterWritePayload(
    {
      thumbnail_url: input.thumbnailPath ?? undefined,
      screenshot_url: input.screenshotPath,
      screenshot_captured_at: new Date().toISOString(),
      screenshot_source: input.source,
      updated_at: new Date().toISOString(),
    },
    schema.columns
  );

  const { error } = await supabase
    .from("campaign_publications")
    .update(payload as never)
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId);

  if (error) throw new Error(error.message);
}

/** Persist external preview URLs when storage upload is unavailable. */
export async function persistExternalPublicationPreview(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    previewUrl: string;
    source: ScreenshotSource;
  }
) {
  const schema = await getCampaignPublicationsSchema(supabase);
  const payload = filterWritePayload(
    {
      thumbnail_url: input.previewUrl,
      screenshot_url: input.previewUrl,
      screenshot_captured_at: new Date().toISOString(),
      screenshot_source: input.source,
      updated_at: new Date().toISOString(),
    },
    schema.columns
  );

  const { error } = await supabase
    .from("campaign_publications")
    .update(payload as never)
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId);

  if (error) throw new Error(error.message);
}

export function outcomeFromAttempts(
  publicationId: string,
  attempts: ScreenshotCaptureAttempt[],
  thumbnailPath: string | null,
  screenshotPath: string | null,
  source: ScreenshotSource | null
): ScreenshotCaptureOutcome {
  if (thumbnailPath || screenshotPath) {
    return {
      publicationId,
      status: "completed",
      source,
      thumbnailUrl: thumbnailPath,
      screenshotUrl: screenshotPath,
      message: source ? `Screenshot captured via ${source}.` : "Screenshot captured.",
      attempts,
    };
  }

  const lastError = attempts.find((a) => a.error)?.error;
  return {
    publicationId,
    status: "failed",
    source: null,
    thumbnailUrl: null,
    screenshotUrl: null,
    message: lastError ?? "All screenshot providers failed.",
    attempts,
  };
}
