import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";

export type MediaPlanAvatarFields = {
  avatarUrl?: string | null;
  profileUrl?: string | null;
  handle?: string | null;
  platform?: string | null;
};

export function resolveMediaPlanCreatorProfileHref(
  fields: MediaPlanAvatarFields
): string | undefined {
  const stored = fields.profileUrl?.trim();
  if (stored) return stored;

  const handle = fields.handle?.trim();
  if (!handle) return undefined;

  return (
    resolveCreatorProfileUrl({
      platform: fields.platform?.trim() ?? "",
      handle,
    }) ?? undefined
  );
}

export function resolveMediaPlanAvatarSrc(
  fields: MediaPlanAvatarFields,
  options?: { browserAvatarProxy?: boolean }
): string | undefined {
  const avatarUrl = fields.avatarUrl?.trim();
  const profileUrl = fields.profileUrl?.trim();

  if (!avatarUrl && !profileUrl) return undefined;

  if (options?.browserAvatarProxy) {
    return creatorAvatarBrowserDisplayUrl(avatarUrl, profileUrl) ?? undefined;
  }

  return avatarUrl || undefined;
}
