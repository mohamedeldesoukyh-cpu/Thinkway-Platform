import {
  isClientWorkspacePackage,
  parseTabOverrides,
  previewExpiresAtFromStart,
  type ClientWorkspacePackage,
} from "@/features/client-workspace/entitlement";

export function persistClientWorkspaceEntitlementFields(input: {
  enabled: boolean;
  packageValue: string;
  overridesJson: string;
  previousPackage?: string | null;
  previousGrandfathered?: boolean;
}) {
  const enabled = input.enabled;
  const selected = isClientWorkspacePackage(input.packageValue)
    ? input.packageValue
    : enabled
      ? "planning"
      : null;
  const packageValue: ClientWorkspacePackage | null = enabled ? selected : null;
  let tabOverrides = null;
  if (enabled && input.overridesJson.trim()) {
    try {
      tabOverrides = parseTabOverrides(JSON.parse(input.overridesJson));
    } catch {
      tabOverrides = null;
    }
  }
  const leavingLive = input.previousPackage === "live" && packageValue !== "live";
  return {
    client_workspace_enabled: enabled,
    client_workspace_package: packageValue,
    client_workspace_tab_overrides: tabOverrides,
    client_workspace_grandfathered: leavingLive ? false : Boolean(input.previousGrandfathered),
    ...(packageValue === "live"
      ? {
          client_workspace_preview_started_at: null,
          client_workspace_preview_expires_at: null,
          client_workspace_preview_previous_package: null,
        }
      : {}),
  };
}

export function livePreviewWritePayload(previousPackage: ClientWorkspacePackage, now = new Date()) {
  return {
    client_workspace_preview_started_at: now.toISOString(),
    client_workspace_preview_expires_at: previewExpiresAtFromStart(now).toISOString(),
    client_workspace_preview_previous_package: previousPackage,
  };
}
