/** Enable Campaign Intelligence pipeline inspector (client + server). */
export function isCampaignIntelligencePipelineDebugEnabled(): boolean {
  const explicit =
    process.env.NEXT_PUBLIC_DEBUG_CIP_PIPELINE?.trim() ??
    process.env.NEXT_PUBLIC_DEBUG_PIPELINE?.trim();
  if (explicit === "1" || explicit === "true") return true;
  if (explicit === "0" || explicit === "false") return false;
  return process.env.NODE_ENV === "development";
}
