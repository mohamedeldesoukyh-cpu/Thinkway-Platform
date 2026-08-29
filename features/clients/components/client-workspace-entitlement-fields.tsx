"use client";

import { useState } from "react";
import { PanelsTopLeftIcon } from "lucide-react";

import {
  CLIENT_WORKSPACE_NAV_SECTIONS,
  CLIENT_WORKSPACE_PACKAGE_LABEL,
  type ClientWorkspaceNavSection,
  type ClientWorkspacePackage,
  type ClientWorkspaceTabAccess,
  type ClientWorkspaceTabOverrides,
} from "@/features/client-workspace/entitlement";
import { ClientFormField, ClientFormSection } from "@/features/clients/components/client-form-ui";

const NAV_LABEL: Record<ClientWorkspaceNavSection, string> = {
  shortlist: "Shortlist",
  creators: "Your Selection",
  commercial: "Commercial",
  approval: "Campaign",
  overview: "Overview",
};

export function ClientWorkspaceEntitlementFields({
  enabled,
  packageId,
  overrides,
  disabled,
  onEnabledChange,
  onPackageChange,
  onOverridesChange,
}: {
  enabled: boolean;
  packageId: ClientWorkspacePackage;
  overrides: ClientWorkspaceTabOverrides | null;
  disabled?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onPackageChange: (value: ClientWorkspacePackage) => void;
  onOverridesChange: (value: ClientWorkspaceTabOverrides | null) => void;
}) {
  const [customize, setCustomize] = useState(Boolean(overrides && Object.keys(overrides).length));

  return (
    <ClientFormSection
      icon={PanelsTopLeftIcon}
      title="Client Workspace"
      description="Service entitlement for the client-facing workspace. Billing stays on the Client IO / retainer."
    >
      <input type="hidden" name="client_workspace_enabled" value={enabled ? "true" : "false"} />
      <input type="hidden" name="client_workspace_package" value={enabled ? packageId : ""} />
      <input
        type="hidden"
        name="client_workspace_tab_overrides"
        value={customize && overrides ? JSON.stringify(overrides) : ""}
      />
      <div className="flex flex-wrap gap-2">
        {(["off", "on"] as const).map((value) => {
          const on = value === "on";
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
                enabled === on
                  ? "border-[#1D9E75] bg-[#ecfdf5] text-[#065f46]"
                  : "border-[#e6ebf3] bg-white text-[#3f4757]"
              }`}
              onClick={() => onEnabledChange(on)}
            >
              {on ? "On" : "Off"}
            </button>
          );
        })}
      </div>
      {enabled ? (
        <>
          <ClientFormField label="Package">
            <div className="mt-1 flex flex-col gap-2">
              {(["planning", "commercial", "live"] as const).map((value) => (
                <label key={value} className="flex items-center gap-2 text-[13px] text-[#1a2332]">
                  <input
                    type="radio"
                    name="client_workspace_package_ui"
                    checked={packageId === value}
                    disabled={disabled}
                    onChange={() => onPackageChange(value)}
                  />
                  {CLIENT_WORKSPACE_PACKAGE_LABEL[value]}
                </label>
              ))}
            </div>
          </ClientFormField>
          <button
            type="button"
            className="text-[12px] font-semibold text-[#0048dd]"
            onClick={() => setCustomize((current) => !current)}
          >
            {customize ? "Hide tab customization" : "Customize tabs"}
          </button>
          {customize ? (
            <div className="grid gap-2 rounded-[10px] border border-[#e6ebf3] p-3">
              {CLIENT_WORKSPACE_NAV_SECTIONS.map((section) => {
                const access: ClientWorkspaceTabAccess = overrides?.[section] ?? "open";
                return (
                  <label key={section} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span>{NAV_LABEL[section]}</span>
                    <select
                      className="h-8 rounded-md border border-[#e6ebf3] bg-white px-2"
                      disabled={disabled}
                      value={overrides?.[section] ?? ""}
                      onChange={(event) => {
                        const next = event.target.value as ClientWorkspaceTabAccess | "";
                        const copy = { ...(overrides ?? {}) };
                        if (!next) delete copy[section];
                        else copy[section] = next;
                        onOverridesChange(Object.keys(copy).length ? copy : null);
                      }}
                    >
                      <option value="">Package default</option>
                      <option value="open">Open</option>
                      <option value="locked">Locked</option>
                    </select>
                    <span className="sr-only">{access}</span>
                  </label>
                );
              })}
              <p className="text-[11.5px] text-[#5b6478]">
                Locked tabs stay visible. Do not use this for the usual package assignment.
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-[12.5px] text-[#5b6478]">
          When Off, review links show a closed-service state. Internal campaign work is unchanged.
        </p>
      )}
    </ClientFormSection>
  );
}
