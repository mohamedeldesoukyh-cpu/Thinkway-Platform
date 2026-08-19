"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileTextIcon, Loader2Icon, PenLineIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { startCampaignOutputsFromSeed } from "@/features/campaign-outputs/actions/generate-outputs-action";
import { seedFromBrief } from "@/features/campaign-outputs/hydration/seed-adapters";
import {
  uploadCampaignBriefAction,
  type CampaignBriefUploadPendingState,
} from "@/features/campaign-intelligence-profile/actions/profile-actions";
import { CampaignIntelligenceLinkDialog } from "@/features/campaign-intelligence-profile/components/campaign-intelligence-link-dialog";
import { nextStepForCampaignBriefUpload } from "@/features/campaign-intelligence-profile/services/next-step-for-brief-upload";

export type StudioNewCampaignMode = "choose" | "upload" | "write" | "paste";

type StudioNewCampaignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: StudioNewCampaignMode;
};

const ACCEPT = ".pdf,.doc,.docx,.pptx,.txt,.md,.rtf";

export function StudioNewCampaignDialog({
  open,
  onOpenChange,
  initialMode = "choose",
}: StudioNewCampaignDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<StudioNewCampaignMode>(initialMode);
  const [pasteText, setPasteText] = useState("");
  const [pending, startTransition] = useTransition();
  const [href, setHref] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<CampaignBriefUploadPendingState | null>(
    null
  );

  function reset() {
    setMode(initialMode);
    setPasteText("");
    setHref(null);
    setConversationId(null);
    setPendingUpload(null);
    setLinkOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function goToStudio(nextHref: string) {
    handleOpenChange(false);
    router.push(nextHref);
  }

  async function createCampaign() {
    const result = await startCampaignOutputsFromSeed({
      seed: seedFromBrief({}),
      tab: "studio",
    });
    if (!result.ok) {
      throw new Error(result.message);
    }
    setHref(result.href);
    setConversationId(result.conversationId);
    return result;
  }

  async function ingestBrief(file: File, created: { href: string; conversationId: string }) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("conversationId", created.conversationId);
    const uploaded = await uploadCampaignBriefAction(formData);
    const step = nextStepForCampaignBriefUpload(uploaded);
    if (step.kind === "error") {
      toast.error(step.message);
      goToStudio(created.href);
      return;
    }
    if (step.kind === "select_brand") {
      setPendingUpload(step.pending);
      setLinkOpen(true);
      toast.message("Select a brand to finish saving this brief.");
      return;
    }
    toast.success(`"${file.name}" analyzed.`);
    goToStudio(created.href);
  }

  function startWrite() {
    startTransition(async () => {
      try {
        const created = await createCampaign();
        goToStudio(created.href);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not start campaign.");
      }
    });
  }

  function startUpload(file: File) {
    startTransition(async () => {
      try {
        const created = await createCampaign();
        await ingestBrief(file, created);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not start campaign.");
      }
    });
  }

  function startPaste() {
    const text = pasteText.trim();
    if (text.length < 40) {
      toast.error("Paste a longer brief so Studio can extract campaign facts.");
      return;
    }
    startTransition(async () => {
      try {
        const created = await createCampaign();
        const file = new File([text], "pasted-brief.txt", { type: "text/plain" });
        await ingestBrief(file, created);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not start campaign.");
      }
    });
  }

  return (
    <>
      <Dialog open={open && !linkOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>
              Upload, write, or paste a brief. Studio uses the same Campaign Intelligence
              pipeline — not a second facts engine.
            </DialogDescription>
          </DialogHeader>

          {mode === "choose" ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                className="rounded-xl border border-border px-3 py-4 text-left hover:bg-muted/40"
                onClick={() => {
                  setMode("upload");
                  requestAnimationFrame(() => fileInputRef.current?.click());
                }}
                disabled={pending}
              >
                <UploadIcon className="mb-2 size-4 text-[var(--tw-primary,#1D9E75)]" />
                <span className="block text-sm font-semibold">Upload brief</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  PDF, Word, PowerPoint, TXT
                </span>
              </button>
              <button
                type="button"
                className="rounded-xl border border-border px-3 py-4 text-left hover:bg-muted/40"
                onClick={() => setMode("write")}
                disabled={pending}
              >
                <PenLineIcon className="mb-2 size-4 text-[var(--tw-primary,#1D9E75)]" />
                <span className="block text-sm font-semibold">Write brief</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Open Intake and fill facts
                </span>
              </button>
              <button
                type="button"
                className="rounded-xl border border-border px-3 py-4 text-left hover:bg-muted/40"
                onClick={() => setMode("paste")}
                disabled={pending}
              >
                <FileTextIcon className="mb-2 size-4 text-[var(--tw-primary,#1D9E75)]" />
                <span className="block text-sm font-semibold">Paste brief</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Drop text into the same pipeline
                </span>
              </button>
            </div>
          ) : null}

          {mode === "upload" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose a brief file. Analysis starts as soon as the campaign workspace is created.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => fileInputRef.current?.click()}
              >
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
                Choose file
              </Button>
            </div>
          ) : null}

          {mode === "write" ? (
            <p className="text-sm text-muted-foreground">
              Studio will open on Intake so you can write the brief and confirm Campaign Facts.
            </p>
          ) : null}

          {mode === "paste" ? (
            <Textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder="Paste the campaign brief…"
              className="min-h-[180px] text-sm"
              disabled={pending}
            />
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) startUpload(file);
            }}
          />

          <DialogFooter className="gap-2 sm:justify-between">
            {mode !== "choose" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode("choose")}
                disabled={pending}
              >
                Back
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              {mode === "write" ? (
                <Button type="button" size="sm" onClick={startWrite} disabled={pending}>
                  {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  Open Intake
                </Button>
              ) : null}
              {mode === "paste" ? (
                <Button type="button" size="sm" onClick={startPaste} disabled={pending}>
                  {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  Create campaign
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CampaignIntelligenceLinkDialog
        open={linkOpen}
        pending={pendingUpload}
        conversationId={conversationId}
        onOpenChange={(next) => {
          setLinkOpen(next);
          if (!next && href) goToStudio(href);
        }}
        onComplete={() => {
          if (href) goToStudio(href);
        }}
      />
    </>
  );
}
