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

export type BriefUploadProfileTarget = {
  mode: "link" | "create";
  linkProfileId: string | null;
  allowMissingBrand: boolean;
  /**
   * True when the upload came from inside an existing campaign conversation —
   * Studio Intake's dropzone, or the New Campaign dialog after it created the
   * conversation. The campaign is already the target, so the brand-selection
   * detour must not interrupt the analysis: it exists to decide which brand a
   * *library* record belongs to, and there is nothing to decide here.
   */
  ownsConversation: boolean;
};

/**
 * Where an uploaded brief's intelligence is written, and whether the brand
 * detour applies.
 *
 * Reuse the conversation's existing profile when there is one. A first upload
 * into a conversation still creates the row, but it is that campaign's row, not
 * a library record.
 *
 * `allowMissingBrand` follows conversation ownership, not the create/link
 * distinction: a campaign whose brand is absent from the CRM catalog must still
 * be able to receive its brief. It is never granted to a library upload, nor to
 * the operator linking an unrelated library record.
 */
export function resolveBriefUploadProfileTarget(input: {
  conversationId?: string | null;
  existingProfileId?: string | null;
}): BriefUploadProfileTarget {
  const conversationId = input.conversationId?.trim();
  const existingProfileId = input.existingProfileId?.trim();

  if (conversationId && existingProfileId) {
    return {
      mode: "link",
      linkProfileId: existingProfileId,
      allowMissingBrand: true,
      ownsConversation: true,
    };
  }
  if (conversationId) {
    return {
      mode: "create",
      linkProfileId: null,
      allowMissingBrand: true,
      ownsConversation: true,
    };
  }
  return {
    mode: "create",
    linkProfileId: null,
    allowMissingBrand: false,
    ownsConversation: false,
  };
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
