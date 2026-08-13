import type { CampaignLineWorkspace } from "@/lib/domains/campaign/workspace-types";
import {
  pickCreatorDisplayName,
  resolveCreatorIdentity,
} from "@/lib/text/decode-html-entities";

/** Prefer platform account handle, then assignment platform handle, then embedded @handle. */
export function resolveAssignmentCreatorHandle(
  line: Pick<
    CampaignLineWorkspace,
    "creator_platform_accounts" | "assignment" | "influencer_name"
  >
): string | null {
  const fromAccounts = line.creator_platform_accounts
    ?.map((account) => account.handle?.trim().replace(/^@+/, ""))
    .find((handle) => Boolean(handle));
  if (fromAccounts) return fromAccounts;

  const fromAssignment = line.assignment?.platforms
    ?.map((platform) => platform.handle?.trim().replace(/^@+/, ""))
    .find((handle) => Boolean(handle));
  if (fromAssignment) return fromAssignment;

  return extractEmbeddedAtHandle(line.influencer_name);
}

function extractEmbeddedAtHandle(value: string | null | undefined): string | null {
  const embedded = value?.match(/@([a-zA-Z0-9._]+)/)?.[1];
  return embedded?.trim() || null;
}

/**
 * Display identity for Assignment creator lines.
 * Ignores placeholder "Creator" / INF-* labels and falls back to platform handles.
 */
export function resolveAssignmentCreatorIdentity(
  line: Pick<
    CampaignLineWorkspace,
    | "creator_platform_accounts"
    | "assignment"
    | "influencer_name"
    | "name"
    | "document_number"
  >
): { name: string; handle: string | null } {
  const handle = resolveAssignmentCreatorHandle(line);
  const name = pickCreatorDisplayName(
    [line.influencer_name, line.assignment?.influencer_name, line.name, handle],
    handle
  );
  const identity = resolveCreatorIdentity(name === "Creator" ? null : name, handle);
  if (identity.name && identity.name !== "Creator") {
    return identity;
  }
  if (handle) {
    return { name: handle, handle };
  }
  const doc = line.document_number?.trim();
  return { name: doc || "Creator", handle: null };
}
