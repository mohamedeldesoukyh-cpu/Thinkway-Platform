/** Client/server logging for Assignments tab render-chain debugging. */
export function logAssignmentsStage(
  stage: string,
  detail?: Record<string, unknown>
): void {
  const payload = { stage, ...detail, at: new Date().toISOString() };
  console.log("[Assignments]", payload);
}
