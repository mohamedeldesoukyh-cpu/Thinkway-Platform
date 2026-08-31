"use client";

import type { ReactNode } from "react";

import {
  ClientFormLayout,
  ClientFormPageHeader,
  ClientFormSaveBar,
  ClientFormTopbar,
  ClientFormUnsavedStatus,
  CLIENT_FORM_MAX_WIDTH,
  CLIENT_FORM_PRIMARY_BUTTON_CLASS,
  CLIENT_FORM_SCROLL_PADDING_CLASS,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { PlatformV6PageSectionHeader } from "@/components/platform/platform-v6-layout";
import { cn } from "@/lib/utils";

export {
  ClientFormField as VendorFormField,
  ClientFormGrid as VendorFormGrid,
  ClientFormSection as VendorFormSection,
  ClientFormKeyboardShortcuts as VendorFormKeyboardShortcuts,
  CLIENT_FORM_INPUT_CLASS as VENDOR_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS as VENDOR_FORM_SELECT_TRIGGER_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS as VENDOR_FORM_TEXTAREA_CLASS,
  CLIENT_FORM_FIELD_LABEL_CLASS as VENDOR_FORM_FIELD_LABEL_CLASS,
} from "@/features/clients/components/client-form-ui";

export const VENDOR_PROFILE_BREADCRUMBS = [
  { label: "Vendors", href: "/vendors" },
  { label: "Creator Profile" },
] as const;

/** Form shell for vendor profile tabs — matches client profile tab layout. */
export function VendorProfileTabShell({
  title,
  description,
  children,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
  isDirty,
  onDiscard,
  discardDisabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  onDiscard?: () => void;
  discardDisabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <div className="platform-v6-epanel-inner">
        <PlatformV6PageSectionHeader title={title} description={description} />
        {children}
      </div>
    );
  }

  return (
    <ClientFormLayout
      topbar={
        <ClientFormTopbar
          breadcrumbs={[...VENDOR_PROFILE_BREADCRUMBS]}
          onCancel={onCancel}
          saveFormId={saveFormId}
          saveLabel={saveLabel}
          saveDisabled={saveDisabled}
          isSaving={isSaving}
        />
      }
      footer={
        isDirty ? (
          <ClientFormSaveBar
            status={<ClientFormUnsavedStatus />}
            onDiscard={onDiscard}
            discardDisabled={discardDisabled}
          >
            {saveFormId ? (
              <button
                type="submit"
                form={saveFormId}
                className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
                disabled={saveDisabled}
              >
                {isSaving ? "Saving…" : saveLabel}
              </button>
            ) : null}
          </ClientFormSaveBar>
        ) : null
      }
    >
      <div
        className={cn(
          "mx-auto w-full",
          CLIENT_FORM_MAX_WIDTH,
          CLIENT_FORM_SCROLL_PADDING_CLASS
        )}
      >
        <ClientFormPageHeader title={title} description={description} />
        {children}
      </div>
    </ClientFormLayout>
  );
}
