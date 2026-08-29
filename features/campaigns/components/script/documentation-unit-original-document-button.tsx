"use client";

import { useState } from "react";
import { FileTextIcon } from "lucide-react";
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
import { campaignScriptOriginalPreviewKind } from "@/lib/campaign-script";
import { cn } from "@/lib/utils";

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
  const previewKind = campaignScriptOriginalPreviewKind(mimeType, fileName);

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
      className="btn"
      disabled={disabled || pending}
      title={fileName}
      aria-label={`Original document ${fileName}`}
      onClick={(event) => event.stopPropagation()}
    >
      <FileTextIcon className="size-3.5" aria-hidden />
    </button>
  ) : (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn("thinkway-campaign-btn h-7 w-7 px-0 shadow-none")}
      disabled={disabled || pending}
      title={fileName}
      aria-label={`Original document ${fileName}`}
    >
      <FileTextIcon className="size-3.5" aria-hidden />
    </Button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-[240px] text-xs">
          <DropdownMenuLabel className="truncate font-normal" title={fileName}>
            {fileName}
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
