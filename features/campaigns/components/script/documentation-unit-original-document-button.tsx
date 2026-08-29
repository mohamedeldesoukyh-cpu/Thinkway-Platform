"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCampaignScriptOriginalDocumentUrlAction } from "@/features/campaigns/actions/campaign-script-actions";
import { getClientCampaignScriptOriginalDocumentUrlAction } from "@/features/client-workspace/actions/campaign-script-actions";
import {
  campaignScriptOriginalDocumentKind,
  campaignScriptOriginalDocumentKindLabel,
  campaignScriptOriginalPreviewKind,
  type CampaignScriptOriginalDocumentKind,
} from "@/lib/campaign-script";
import { cn } from "@/lib/utils";

function OriginalDocumentTypeAvatar({
  kind,
  className,
}: {
  kind: CampaignScriptOriginalDocumentKind;
  className?: string;
}) {
  const mark = kind === "word" ? "W" : campaignScriptOriginalDocumentKindLabel(kind);
  return (
    <span
      data-original-document-kind={kind}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] font-bold uppercase leading-none text-white",
        kind === "pdf" && "bg-[#E5252A] text-[6px] tracking-tight",
        kind === "word" && "bg-[#2B579A] text-[11px]",
        kind === "text" && "bg-zinc-500 text-[6px] tracking-tight",
        kind === "file" && "bg-zinc-400 text-[6px] tracking-tight",
        className
      )}
      aria-hidden
    >
      {mark}
    </span>
  );
}

type Props = {
  variant?: "campaign" | "client";
  campaignId?: string;
  token?: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  fileName: string;
  mimeType?: string | null;
  disabled?: boolean;
};

export function DocumentationUnitOriginalDocumentButton({
  variant = "campaign",
  campaignId = "",
  token = "",
  assignmentDeliverableId,
  assignmentPostScheduleId,
  fileName,
  mimeType,
  disabled,
}: Props) {
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const client = variant === "client";
  const documentKind = campaignScriptOriginalDocumentKind(mimeType, fileName);
  const documentKindLabel = campaignScriptOriginalDocumentKindLabel(documentKind);
  const previewKind = campaignScriptOriginalPreviewKind(mimeType, fileName);
  const avatar = <OriginalDocumentTypeAvatar kind={documentKind} />;

  async function openOriginal(mode: "view" | "download") {
    setPending(true);
    try {
      const result = client
        ? await getClientCampaignScriptOriginalDocumentUrlAction({
            token,
            assignmentDeliverableId,
            assignmentPostScheduleId,
            download: mode === "download",
          })
        : await getCampaignScriptOriginalDocumentUrlAction({
            campaignId,
            assignmentDeliverableId,
            assignmentPostScheduleId,
            download: mode === "download",
          });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (mode === "view" && previewKind === "pdf") {
        setPreview({ url: result.data.url, title: result.data.fileName });
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } finally {
      setPending(false);
    }
  }

  const trigger = client ? (
    <button
      type="button"
      className="btn px-1.5"
      disabled={disabled || pending}
      title={`${documentKindLabel}: ${fileName}`}
      aria-label={`Original ${documentKindLabel} document ${fileName}`}
      onClick={(event) => event.stopPropagation()}
    >
      {avatar}
    </button>
  ) : (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn("thinkway-campaign-btn h-7 w-7 px-0 shadow-none")}
      disabled={disabled || pending}
      title={`${documentKindLabel}: ${fileName}`}
      aria-label={`Original ${documentKindLabel} document ${fileName}`}
    >
      {avatar}
    </Button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-[240px] text-xs">
          <DropdownMenuLabel className="flex min-w-0 items-center gap-2 font-normal" title={fileName}>
            <OriginalDocumentTypeAvatar kind={documentKind} />
            <span className="truncate">{fileName}</span>
          </DropdownMenuLabel>
          {previewKind === "pdf" ? (
            <DropdownMenuItem disabled={pending} onSelect={() => void openOriginal("view")}>
              Preview
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem disabled={pending} onSelect={() => void openOriginal("download")}>
            Download
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={preview != null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.title ?? "Original document"}</DialogTitle>
            <DialogDescription>Original uploaded script document</DialogDescription>
          </DialogHeader>
          {preview ? (
            <iframe title={preview.title} src={preview.url} className="h-[70vh] w-full rounded-md border" />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
