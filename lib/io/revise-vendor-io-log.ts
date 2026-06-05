/** Structured server logs for Vendor IO revision bisects. */
export function logReviseVendorIo(
  step: string,
  detail?: Record<string, unknown>
): void {
  console.log("[revise-vendor-io]", { step, ...detail, at: new Date().toISOString() });
}
