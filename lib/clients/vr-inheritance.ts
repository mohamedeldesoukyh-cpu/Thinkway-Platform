export type VrRateEntity = {
  vr_rate_id: string | null;
  vr_rate_percent?: number | null;
};

/** Brand override when vr_rate_id is set; otherwise inherit client default VR%. */
export function getEffectiveBrandVrPercent(
  brand: VrRateEntity,
  client: VrRateEntity
): number | null {
  if (brand.vr_rate_id) {
    return brand.vr_rate_percent ?? null;
  }
  if (client.vr_rate_id) {
    return client.vr_rate_percent ?? null;
  }
  return null;
}

/** Normalize brand form submission: matching client default stores null (inherit). */
export function normalizeBrandVrRateId(
  submittedVrRateId: string | null,
  clientVrRateId: string | null
): string | null {
  if (!submittedVrRateId) {
    return null;
  }
  if (clientVrRateId && submittedVrRateId === clientVrRateId) {
    return null;
  }
  return submittedVrRateId;
}

export function brandVrInheritanceHint(
  clientVrPercent: number | null,
  brandHasOverride: boolean
): string {
  if (brandHasOverride) {
    return clientVrPercent != null
      ? `Overridden — client default is ${clientVrPercent}%`
      : "Brand override (no client default on overview)";
  }
  if (clientVrPercent != null) {
    return `Inherits ${clientVrPercent}% from client unless overridden`;
  }
  return "Set default VR% on client overview or override here";
}
