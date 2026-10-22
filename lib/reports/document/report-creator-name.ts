/** Keep report names readable without requiring decorative/emoji font packs.
 * This is presentation-only: the stored profile name is never changed.
 */
export function reportCreatorName(name: string, handle: string): string {
  const readable = name.normalize("NFKC")
    .replace(/[\p{S}\uFE0E\uFE0F\u200D\u{13000}-\u{1345F}]/gu, "")
    .replace(/\s+/g, " ").trim();
  return /[\p{L}\p{N}]/u.test(readable) ? readable : handle || "Creator";
}
