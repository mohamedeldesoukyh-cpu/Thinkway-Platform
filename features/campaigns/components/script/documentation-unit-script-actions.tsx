"use client";

import { Button } from "@/components/ui/button";
import { documentationUnitScriptActionLabels } from "@/lib/campaign-script";
import { cn } from "@/lib/utils";

import { DocumentationUnitOriginalDocumentButton } from "./documentation-unit-original-document-button";

type Props = {
  hasScript: boolean;
  disabled?: boolean;
  unavailableReason?: string | null;
  variant?: "campaign" | "client";
  campaignId?: string;
  token?: string;
  assignmentDeliverableId?: string | null;
  assignmentPostScheduleId?: string | null;
  originalFileName?: string | null;
  originalMimeType?: string | null;
  hasOriginalDocument?: boolean;
  onAdd: () => void;
  onUpload: () => void;
  onOpen: () => void;
  onPreview: () => void;
};

const CAMPAIGN_BUTTON_CLASS =
  "thinkway-campaign-btn h-7 px-2 text-[10px] shadow-none";

export function DocumentationUnitScriptActions({
  hasScript,
  disabled,
  unavailableReason,
  variant = "campaign",
  campaignId,
  token,
  assignmentDeliverableId,
  assignmentPostScheduleId,
  originalFileName,
  originalMimeType,
  hasOriginalDocument,
  onAdd,
  onUpload,
  onOpen,
  onPreview,
}: Props) {
  const labels = documentationUnitScriptActionLabels(hasScript);
  const blocked = Boolean(disabled || unavailableReason);
  const client = variant === "client";
  const showOriginal = Boolean(
    hasOriginalDocument && originalFileName && assignmentDeliverableId
  );

  function ActionButton({
    children,
    title,
    onClick,
  }: {
    children: string;
    title: string;
    onClick: () => void;
  }) {
    if (client) {
      return (
        <button
          type="button"
          className="btn"
          disabled={blocked}
          title={title}
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          {children}
        </button>
      );
    }
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(CAMPAIGN_BUTTON_CLASS)}
        disabled={blocked}
        title={title}
        onClick={onClick}
      >
        {children}
      </Button>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      data-documentation-script-actions={hasScript ? "present" : "empty"}
    >
      {hasScript ? (
        <>
          <ActionButton title={unavailableReason ?? "Open this unit script"} onClick={onOpen}>
            {labels.primary}
          </ActionButton>
          <ActionButton title={unavailableReason ?? "Preview this unit script"} onClick={onPreview}>
            {labels.secondary}
          </ActionButton>
        </>
      ) : (
        <>
          <ActionButton title={unavailableReason ?? "Add a script to this unit"} onClick={onAdd}>
            {labels.primary}
          </ActionButton>
          <ActionButton title={unavailableReason ?? "Upload a script to this unit"} onClick={onUpload}>
            {labels.secondary}
          </ActionButton>
        </>
      )}
      {showOriginal ? (
        <DocumentationUnitOriginalDocumentButton
          variant={variant}
          campaignId={campaignId}
          token={token}
          assignmentDeliverableId={assignmentDeliverableId!}
          assignmentPostScheduleId={assignmentPostScheduleId ?? null}
          fileName={originalFileName!}
          mimeType={originalMimeType}
          disabled={blocked}
        />
      ) : null}
    </div>
  );
}
