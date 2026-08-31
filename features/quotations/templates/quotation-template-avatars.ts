import { isAllowedPublicationPreviewSrcUrl } from "@/lib/creators/publication-preview-proxy";
import {
  isLikelyCreatorProfileImageUrl,
  shouldProxyPublicationMediaUrl,
} from "@/lib/creators/recent-publication-thumb";
import {
  creatorAvatarBrowserDisplayUrl,
  initialsFromCreatorName,
} from "@/lib/performance/creator-avatar";
import type {
  QuotationDocCreatorGroup,
  QuotationDocPublicationShot,
} from "@/features/quotations/export/quotation-document";
import { resolveExportPublicationShotProxyUrl } from "@/features/quotations/export/quotation-export-publications";

export function resolveQuotationTemplateAvatarSrc(
  group: Pick<QuotationDocCreatorGroup, "avatarUrl" | "avatarProxyUrl" | "profileUrl">,
  siteOrigin?: string
): string | null {
  if (group.avatarUrl?.startsWith("data:")) return group.avatarUrl;

  const absoluteProxyUrl = (proxyPath: string | null | undefined): string | null => {
    if (!proxyPath) return null;
    if (siteOrigin) {
      return `${siteOrigin.replace(/\/$/, "")}${proxyPath}`;
    }
    return proxyPath.startsWith("/") ? proxyPath : null;
  };

  const proxyUrl =
    absoluteProxyUrl(group.avatarProxyUrl) ??
    absoluteProxyUrl(
      group.avatarUrl && group.profileUrl
        ? creatorAvatarBrowserDisplayUrl(group.avatarUrl, group.profileUrl)
        : null
    );

  const rawAvatar = group.avatarUrl?.trim() || null;
  if (rawAvatar) {
    if (rawAvatar.startsWith("data:image/")) return rawAvatar;
    if (rawAvatar.startsWith("javascript:")) return proxyUrl;
    if (shouldProxyPublicationMediaUrl(rawAvatar)) {
      return proxyUrl ?? rawAvatar;
    }
    return rawAvatar;
  }

  return proxyUrl;
}

export function resolveQuotationTemplatePublicationSrc(
  shot: QuotationDocPublicationShot,
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

  const explicitProxy = absoluteProxyUrl(shot.imageProxyUrl);
  const rawImage = shot.imageUrl.trim();
  // After embed, a blank imageUrl means no usable source — do not reconstruct a
  // live publication-preview <img>. That path can serve undersized OG thumbs.
  if (!rawImage) return explicitProxy;

  const proxyUrl = explicitProxy ?? absoluteProxyUrl(resolveExportPublicationShotProxyUrl(shot));

  if (isLikelyCreatorProfileImageUrl(rawImage)) {
    return (
      explicitProxy ??
      absoluteProxyUrl(
        resolveExportPublicationShotProxyUrl({
          ...shot,
          imageUrl: "",
        })
      )
    );
  }

  const mustProxy =
    shouldProxyPublicationMediaUrl(rawImage) || isAllowedPublicationPreviewSrcUrl(rawImage);
  if (mustProxy) return proxyUrl;
  return rawImage;
}

export function quotationTemplateAvatarInitials(
  group: Pick<QuotationDocCreatorGroup, "creator" | "handle">
): string {
  return initialsFromCreatorName(group.creator || group.handle);
}

export function renderQuotationTemplateAvatarHtml(
  group: Pick<QuotationDocCreatorGroup, "creator" | "handle" | "avatarUrl" | "avatarProxyUrl" | "profileUrl">,
  siteOrigin: string | undefined,
  variant: "showcase" | "fee" | "collap" | "pitch" = "showcase"
): string {
  const initials = quotationTemplateAvatarInitials(group);
  const src = resolveQuotationTemplateAvatarSrc(group, siteOrigin);
  const esc = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  if (variant === "collap") {
    if (src) {
      return `<img class="collap-creator-avatar collap-creator-avatar--img" src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'collap-creator-avatar collap-creator-avatar--initials',textContent:'${esc(initials)}'}))" />`;
    }
    return `<span class="collap-creator-avatar collap-creator-avatar--initials">${esc(initials)}</span>`;
  }

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
