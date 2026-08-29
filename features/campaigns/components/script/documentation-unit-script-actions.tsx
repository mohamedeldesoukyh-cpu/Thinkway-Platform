"use client";

import type { ReactNode } from "react";
import { EyeIcon, FileUpIcon, PaperclipIcon, PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const CAMPAIGN_ICON_BUTTON_CLASS =
  "thinkway-campaign-btn h-8 w-8 min-h-8 p-0 px-0 shadow-none";
const CLIENT_ICON_BUTTON_CLASS = "cx-script-btn";

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

  function IconAction({
    hint,
    onClick,
    children,
  }: {
    hint: string;
    onClick: () => void;
    children: ReactNode;
  }) {
    const title = unavailableReason ?? hint;
    const button = client ? (
      <button
        type="button"
        className={cn(CLIENT_ICON_BUTTON_CLASS, hasScript && hint === labels.secondary && "is-on")}
        disabled={blocked}
        aria-label={title}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        {children}
      </button>
    ) : (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(CAMPAIGN_ICON_BUTTON_CLASS)}
        disabled={blocked}
        aria-label={title}
        onClick={onClick}
      >
        {children}
      </Button>
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top">{title}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="flex shrink-0 flex-nowrap items-center gap-1"
        data-documentation-script-actions={hasScript ? "present" : "empty"}
      >
        {hasScript ? (
          <>
            <IconAction hint={labels.primary} onClick={onOpen}>
              <PencilIcon className="size-4" aria-hidden />
            </IconAction>
            <IconAction hint={labels.secondary} onClick={onPreview}>
              <EyeIcon className="size-4" aria-hidden />
            </IconAction>
          </>
        ) : (
          <>
            <IconAction hint={labels.primary} onClick={onAdd}>
              <PaperclipIcon className="size-4" aria-hidden />
            </IconAction>
            <IconAction hint={labels.secondary} onClick={onUpload}>
              <FileUpIcon className="size-4" aria-hidden />
            </IconAction>
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
    </TooltipProvider>
  );
}
