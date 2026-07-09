import { parseCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { envelopeHasValue } from "@/features/creator-dna/services/field-envelope";
import type { CreatorDNADocument } from "@/features/creator-dna/types";
import type { PrimaryAvatarSource } from "@/lib/creators/creator-centric";
import { detectAvatarCdn, isTikTokHostedAvatarUrl } from "@/lib/performance/creator-avatar";
import {
  isDisplayableAvatarUrl,
  isUsableAvatarUrl,
} from "@/lib/performance/avatar-sync-policy";

function isDurableStoredAvatarUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("/api/creators/")) return true;
  return trimmed.includes("supabase.co/storage/") || trimmed.includes("supabase.in/storage/");
}

function isExpirableSocialCdnAvatarUrl(url: string): boolean {
  const cdn = detectAvatarCdn(url);
  return cdn === "instagram" || cdn === "tiktok" || isTikTokHostedAvatarUrl(url);
}

export function extractDnaAvatarUrl(
  document: CreatorDNADocument | unknown | null | undefined
): string | null {
  if (!document) return null;
  const parsed =
    document && typeof document === "object" && "identity" in document
      ? (document as CreatorDNADocument)
      : parseCreatorDNADocument(document);

  const envelope = parsed.identity?.avatarUrl;
  if (!envelopeHasValue(envelope)) return null;

  const url = envelope.value?.trim() ?? "";
  return isDisplayableAvatarUrl(url) ? url : null;
}

export function avatarSourceFromDnaUrl(url: string): PrimaryAvatarSource {
  const cdn = detectAvatarCdn(url);
  if (cdn === "instagram") return "instagram";
  if (cdn === "tiktok") return "tiktok";
  if (cdn === "youtube") return "youtube";
  return "imported";
}

export function shouldRestoreAvatarFromDna(
  currentAvatarUrl: string | null | undefined,
  dnaAvatarUrl: string | null
): boolean {
  if (!dnaAvatarUrl) return false;
  const current = currentAvatarUrl?.trim() ?? "";
  if (!current) return true;
  if (!isDisplayableAvatarUrl(current)) return true;
  if (!isUsableAvatarUrl(current) && isDisplayableAvatarUrl(dnaAvatarUrl)) return true;
  if (
    isDisplayableAvatarUrl(dnaAvatarUrl) &&
    isDurableStoredAvatarUrl(dnaAvatarUrl) &&
    isExpirableSocialCdnAvatarUrl(current)
  ) {
    return true;
  }
  return false;
}

/** Pick the best avatar for display — DNA fills gaps when influencer-level avatars are missing or broken. */
export function resolveCreatorAvatarWithDnaFallback(input: {
  profileImageUrl?: string | null;
  primaryAvatarUrl?: string | null;
  dnaAvatarUrl?: string | null;
  /** Prefer DNA avatar for enriched creators when primary is empty or a flaky social CDN URL. */
  preferEnrichedDna?: boolean;
}): string | null {
  const current = (input.primaryAvatarUrl ?? input.profileImageUrl)?.trim() || null;
  const dna = input.dnaAvatarUrl?.trim() && isDisplayableAvatarUrl(input.dnaAvatarUrl)
    ? input.dnaAvatarUrl.trim()
    : null;

  // Prefer enriched DNA only when it is clearly better than the live primary:
  // fill gaps, replace broken URLs, or swap flaky CDN for durable storage.
  // Never replace a usable CDN primary with an older/expired CDN from DNA.
  if (dna && input.preferEnrichedDna) {
    const dnaUsable = isUsableAvatarUrl(dna);
    const currentUsable = Boolean(current && isUsableAvatarUrl(current));
    if (!current || !currentUsable) {
      return dna;
    }
    if (
      dnaUsable &&
      isDurableStoredAvatarUrl(dna) &&
      isExpirableSocialCdnAvatarUrl(current)
    ) {
      return dna;
    }
  }

  if (shouldRestoreAvatarFromDna(current, dna)) {
    return dna;
  }

  if (current && isDisplayableAvatarUrl(current)) {
    return current;
  }

  return dna ?? current;
}
