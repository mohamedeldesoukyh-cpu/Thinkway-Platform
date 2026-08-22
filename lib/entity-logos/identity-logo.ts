export const ENTITY_LOGOS_BUCKET = "entity-logos";
export const ENTITY_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const ENTITY_LOGO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type EntityLogoKind = "group" | "client" | "brand";

export type IdentityLogo = {
  url: string;
  source: "group" | "client";
  alt: string;
};

export function pickIdentityLogo(input: {
  groupLogoUrl?: string | null;
  clientLogoUrl?: string | null;
  groupName?: string | null;
  clientName?: string | null;
}): IdentityLogo | null {
  const groupUrl = input.groupLogoUrl?.trim();
  if (groupUrl) {
    return {
      url: groupUrl,
      source: "group",
      alt: input.groupName?.trim() || "Group",
    };
  }
  const clientUrl = input.clientLogoUrl?.trim();
  if (clientUrl) {
    return {
      url: clientUrl,
      source: "client",
      alt: input.clientName?.trim() || "Client",
    };
  }
  return null;
}

export function entityLogoTable(kind: EntityLogoKind): "groups" | "clients" | "brands" {
  if (kind === "group") return "groups";
  if (kind === "client") return "clients";
  return "brands";
}

export function parseEntityLogoKind(value: unknown): EntityLogoKind | null {
  if (value === "group" || value === "client" || value === "brand") return value;
  return null;
}

export function entityLogoExtension(mimeType: string): "jpg" | "png" | "webp" | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

export function storagePathFromPublicLogoUrl(url: string): string | null {
  const marker = `/object/public/${ENTITY_LOGOS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const path = url.slice(index + marker.length).split("?")[0];
  return path?.trim() ? decodeURIComponent(path) : null;
}
