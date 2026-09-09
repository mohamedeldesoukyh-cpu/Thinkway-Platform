/**
 * Where an uploaded brief's intelligence should be written.
 *
 * A conversation has exactly one canonical Campaign Intelligence profile —
 * `getCampaignIntelligenceProfileForConversation` resolves it as the most
 * recently updated row. Replacing a brief through the Intake dropzone used to
 * insert a second row for the same conversation, which then won that ordering
 * and orphaned every operator-entered value on the previous row.
 *
 * These are the two decisions that fix takes, kept pure so they can be tested
 * without the database or the server action around them.
 */

export type BriefUploadProfileTarget =
  | { mode: "link"; linkProfileId: string; allowMissingBrand: true }
  | { mode: "create"; linkProfileId: null; allowMissingBrand: false };

/**
 * Reuse the conversation's existing profile when there is one; otherwise keep
 * the established create behaviour.
 *
 * `allowMissingBrand` is granted ONLY for same-conversation reuse: the profile
 * already belongs to this campaign, so a brand absent from the CRM catalog must
 * not block replacing its brief. It is never granted to a create, nor to the
 * operator linking an unrelated library record.
 */
export function resolveBriefUploadProfileTarget(input: {
  conversationId?: string | null;
  existingProfileId?: string | null;
}): BriefUploadProfileTarget {
  const conversationId = input.conversationId?.trim();
  const existingProfileId = input.existingProfileId?.trim();

  if (conversationId && existingProfileId) {
    return { mode: "link", linkProfileId: existingProfileId, allowMissingBrand: true };
  }
  return { mode: "create", linkProfileId: null, allowMissingBrand: false };
}

/**
 * True when a link must be refused for want of a brand.
 *
 * Linking an unrelated library record still requires one; same-conversation
 * reuse, which carries `allowMissingBrand`, does not.
 */
export function linkRequiresBrandSelection(input: {
  brandId?: string | null;
  allowMissingBrand?: boolean;
}): boolean {
  const brandId = input.brandId?.trim();
  return !brandId && !input.allowMissingBrand;
}
