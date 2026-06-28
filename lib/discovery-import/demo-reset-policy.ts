/** Temporary demo-only guard for destructive CSV creator reset. */
export function isDemoResetEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.NODE_ENV !== "production") return true;
  const flag = env.DEMO_RESET_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
