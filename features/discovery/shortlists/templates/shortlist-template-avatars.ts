import { shouldProxyPublicationMediaUrl } from "@/lib/creators/recent-publication-thumb";
import { isAllowedPublicationPreviewSrcUrl } from "@/lib/creators/publication-preview-proxy";
import {
  creatorAvatarBrowserDisplayUrl,
  initialsFromCreatorName,
} from "@/lib/performance/creator-avatar";
import type {
  ShortlistDocCreatorGroup,
  ShortlistDocPublicationShot,
  ShortlistDocRow,
} from "@/features/discovery/shortlists/export/shortlist-document";
import { resolveExportPublicationShotProxyUrl } from "@/features/discovery/shortlists/export/shortlist-export-publications";

export type ShortlistAvatarSource = Pick<
  ShortlistDocCreatorGroup,
  "creator" | "handle" | "avatarUrl" | "avatarProfileUrl"
> & {
  /** Optional pre-resolved proxy path — rows without one fall back to on-the-fly resolution. */
  avatarProxyUrl?: string | null;
};

export function resolveShortlistTemplateAvatarSrc(
  source: ShortlistAvatarSource,
  siteOrigin?: string
): string | null {
  if (source.avatarUrl?.startsWith("data:")) return source.avatarUrl;

  const absoluteProxyUrl = (proxyPath: string | null | undefined): string | null => {
    if (!proxyPath) return null;
    if (siteOrigin) {
      return `${siteOrigin.replace(/\/$/, "")}${proxyPath}`;
    }
    return proxyPath.startsWith("/") ? proxyPath : null;
  };

  const proxyUrl =
    absoluteProxyUrl(source.avatarProxyUrl) ??
    absoluteProxyUrl(
      source.avatarUrl && source.avatarProfileUrl
        ? creatorAvatarBrowserDisplayUrl(source.avatarUrl, source.avatarProfileUrl)
        : null
    );

  const rawAvatar = source.avatarUrl?.trim() || null;
  if (rawAvatar) {
    if (shouldProxyPublicationMediaUrl(rawAvatar)) {
      return proxyUrl ?? rawAvatar;
    }
    return rawAvatar;
  }

  return proxyUrl;
}

export function resolveShortlistTemplatePublicationSrc(
  shot: ShortlistDocPublicationShot,
  siteOrigin?: string
): string | null {
  if (shot.imageUrl.startsWith("data:")) return shot.imageUrl;

  const absoluteProxyUrl = (proxyPath: string | null | undefined): string | null => {
    if (!proxyPath) return null;
    if (siteOrigin) {
      return `${siteOrigin.replace(/\/$/, "")}${proxyPath}`;
    }
    return proxyPath.startsWith("/") ? proxyPath : null;
  };

  const proxyUrl =
    absoluteProxyUrl(shot.imageProxyUrl) ??
    absoluteProxyUrl(resolveExportPublicationShotProxyUrl(shot));

  const rawImage = shot.imageUrl.trim();
  if (rawImage) {
    const mustProxy =
      shouldProxyPublicationMediaUrl(rawImage) || isAllowedPublicationPreviewSrcUrl(rawImage);
    if (mustProxy) {
      return proxyUrl;
    }
    return rawImage;
  }

  return proxyUrl;
}

export function shortlistTemplateAvatarInitials(
  source: Pick<ShortlistDocCreatorGroup | ShortlistDocRow, "creator" | "handle">
): string {
  return initialsFromCreatorName(source.creator || source.handle);
}

export function renderShortlistTemplateAvatarHtml(
  source: ShortlistAvatarSource,
  siteOrigin: string | undefined,
  variant: "showcase" | "fee" | "pitch" = "showcase"
): string {
  const initials = shortlistTemplateAvatarInitials(source);
  const src = resolveShortlistTemplateAvatarSrc(source, siteOrigin);
  const esc = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  if (variant === "fee") {
    if (src) {
      return `<img class="fee-avatar" src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fee-avatar fee-avatar--initials',textContent:'${esc(initials)}'}))" />`;
    }
    return `<span class="fee-avatar fee-avatar--initials">${esc(initials)}</span>`;
  }

  if (variant === "pitch") {
    if (src) {
      return `<img class="pitch-avatar" src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'pitch-avatar pitch-avatar--initials',textContent:'${esc(initials)}'}))" />`;
    }
    return `<span class="pitch-avatar pitch-avatar--initials">${esc(initials)}</span>`;
  }

  if (src) {
    return `<img class="sc-avatar sc-avatar--img" src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'sc-avatar sc-avatar--initials',textContent:'${esc(initials)}'}))" />`;
  }
  return `<span class="sc-avatar sc-avatar--initials">${esc(initials)}</span>`;
}
