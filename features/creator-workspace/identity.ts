import {
  formatCreatorDisplayName,
  isPlaceholderCreatorLabel,
} from "@/lib/text/decode-html-entities";

const AGENCY_BRAND_LABELS = new Set([
  "thinkway",
  "thinkway media",
  "thinkwaymedia",
]);

export function isAgencyBrandCreatorLabel(name: string | null | undefined): boolean {
  if (name == null) return false;
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  return AGENCY_BRAND_LABELS.has(normalized) || isPlaceholderCreatorLabel(name);
}

function emailLocalPart(email: string | null | undefined): string | null {
  const local = email?.split("@")[0]?.trim() ?? "";
  if (!local || local.length < 2) return null;
  return local;
}

/**
 * Creator Workspace greeting/profile name.
 * Never prefer an agency brand label (e.g. "Thinkway") over the person's profile name.
 * Does not change the influencer_id used for authorization.
 */
export function resolveCreatorWorkspaceName(input: {
  influencerDisplayName: string | null | undefined;
  profileFullName: string | null | undefined;
  email: string | null | undefined;
}): string {
  const fromInfluencer = formatCreatorDisplayName(input.influencerDisplayName);
  if (fromInfluencer && !isAgencyBrandCreatorLabel(fromInfluencer)) {
    return fromInfluencer;
  }
  const fromProfile = formatCreatorDisplayName(input.profileFullName);
  if (fromProfile && !isAgencyBrandCreatorLabel(fromProfile)) {
    return fromProfile;
  }
  return emailLocalPart(input.email) ?? "Creator";
}
