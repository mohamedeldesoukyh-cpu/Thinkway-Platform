export type CampaignBriefUploadResult<TWorkspace, TPending> =
  | { ok: true; phase: "complete"; workspace: TWorkspace }
  | { ok: true; phase: "brand_selection"; pending: TPending }
  | { ok: false; message: string };

export type IntakeBriefUploadNextStep<TWorkspace, TPending> =
  | { kind: "apply_workspace"; workspace: TWorkspace }
  | { kind: "select_brand"; pending: TPending }
  | { kind: "error"; message: string };

/**
 * Intake must never drop a successful upload that still needs a brand.
 * `brand_selection` is a continue step, not an idle/error state.
 */
export function nextStepForCampaignBriefUpload<TWorkspace, TPending>(
  result: CampaignBriefUploadResult<TWorkspace, TPending>
): IntakeBriefUploadNextStep<TWorkspace, TPending> {
  if (!result.ok) {
    return { kind: "error", message: result.message };
  }
  if (result.phase === "brand_selection") {
    return { kind: "select_brand", pending: result.pending };
  }
  return { kind: "apply_workspace", workspace: result.workspace };
}
