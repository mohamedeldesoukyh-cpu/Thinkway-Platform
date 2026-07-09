"use client";

import { useCallback, useState, useTransition } from "react";
import { useDropzone } from "react-dropzone";
import {
  CheckCircle2Icon,
  FileTextIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import {
  type CampaignIntelligenceWorkspaceState,
  saveCampaignIntelligenceProfileAction,
  uploadCampaignBriefAction,
} from "../actions/profile-actions";
import type { CampaignIntelligenceProfile } from "../types/profile";
import { createEmptyCampaignIntelligenceProfile } from "../types/profile";

export type CampaignIntelligencePanelProps = {
  initialState?: CampaignIntelligenceWorkspaceState | null;
  onWorkspaceChange?: (state: CampaignIntelligenceWorkspaceState) => void;
  /** @deprecated Use variant="inline" */
  compact?: boolean;
  variant?: "page" | "sidebar" | "inline";
};

type UploadPhase = "idle" | "uploading" | "analyzing" | "ready" | "error";

function parseList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(values?: string[]): string {
  return (values ?? []).join(", ");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shouldShowSparseHint(state: CampaignIntelligenceWorkspaceState): boolean {
  return !state.hasExtractedData && state.parsedTextLength < 200;
}

export function CampaignIntelligencePanel({
  initialState,
  onWorkspaceChange,
  compact,
  variant,
}: CampaignIntelligencePanelProps) {
  const layout = variant ?? (compact ? "sidebar" : "page");
  const isInline = layout === "inline";
  const isSidebar = layout === "sidebar";
  const [profileId, setProfileId] = useState<string | null>(initialState?.profileId ?? null);
  const [profile, setProfile] = useState<CampaignIntelligenceProfile>(
    initialState?.profile ?? createEmptyCampaignIntelligenceProfile()
  );
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(
    initialState?.profileId ? "ready" : "idle"
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    initialState?.fileName ?? null
  );
  const [uploadedFileSize, setUploadedFileSize] = useState<number | null>(
    initialState?.fileSizeBytes ?? null
  );
  const [parsedTextLength, setParsedTextLength] = useState(initialState?.parsedTextLength ?? 0);
  const [isPending, startTransition] = useTransition();

  const processing = uploadPhase === "uploading" || uploadPhase === "analyzing";

  const applyLoaded = useCallback(
    (state: CampaignIntelligenceWorkspaceState) => {
      setProfileId(state.profileId);
      setProfile(state.profile);
      setUploadedFileName(state.fileName);
      setUploadedFileSize(state.fileSizeBytes);
      setParsedTextLength(state.parsedTextLength);
      setUploadPhase("ready");
      onWorkspaceChange?.(state);
    },
    [onWorkspaceChange]
  );

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setUploadedFileName(file.name);
      setUploadedFileSize(file.size);
      setUploadPhase("uploading");

      try {
        const formData = new FormData();
        formData.append("file", file);
        setUploadPhase("analyzing");

        const result = await uploadCampaignBriefAction(formData);
        if (!result.ok) {
          setUploadPhase("error");
          toast.error(result.message);
          return;
        }

        if (result.phase === "brand_selection") {
          setUploadPhase("idle");
          toast.message("Select a brand to finish saving this brief.");
          return;
        }

        applyLoaded(result.workspace);

        if (shouldShowSparseHint(result.workspace)) {
          toast.message(`"${result.fileName}" uploaded — review and edit fields below.`);
        } else {
          toast.success(`"${result.fileName}" analyzed — review the fields below.`);
        }
      } catch (error) {
        setUploadPhase("error");
        const message = error instanceof Error ? error.message : "Upload failed";
        toast.error(message);
      }
    },
    [applyLoaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "text/plain": [".txt", ".md"],
      "application/rtf": [".rtf"],
      "text/rtf": [".rtf"],
    },
    disabled: processing || isPending,
  });

  function runSave() {
    if (!profileId) {
      toast.error("Upload a brief first.");
      return;
    }
    startTransition(async () => {
      const result = await saveCampaignIntelligenceProfileAction(profileId, profile);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const saved = { ...profile, status: "saved" as const };
      setProfile(saved);
      onWorkspaceChange?.({
        profileId,
        profile: saved,
        fileName: uploadedFileName,
        fileSizeBytes: uploadedFileSize,
        hasExtractedData: true,
        parsedTextLength,
      });
      toast.success("Campaign intelligence saved.");
    });
  }

  const phaseLabel =
    uploadPhase === "uploading"
      ? "Uploading…"
      : uploadPhase === "analyzing"
        ? "Analyzing brief…"
        : uploadPhase === "ready"
          ? "Ready"
          : uploadPhase === "error"
            ? "Failed — try again"
            : null;

  const showFields = Boolean(profileId);
  const sparseHint =
    showFields &&
    uploadPhase === "ready" &&
    !profileHasVisibleData(profile) &&
    parsedTextLength < 200;

  return (
    <div
      className={
        isInline
          ? "flex w-full flex-col gap-6 px-4 py-4 md:px-6"
          : isSidebar
            ? "flex flex-col gap-4"
            : "mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6"
      }
    >
      {!isSidebar && !isInline ? (
        <div>
          <h1 className="text-xl font-bold tracking-tight">Campaign Brief Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a brief — Thinkway extracts campaign intelligence automatically.
          </p>
        </div>
      ) : null}

      <section className={isInline ? "rounded-xl border border-border bg-card p-4" : "space-y-2"}>
        <h2 className="text-sm font-semibold">Upload brief</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          PDF, Word, PowerPoint, TXT, MD, or RTF. Analysis starts immediately after upload.
        </p>
        <div
          {...getRootProps()}
          className={
            isInline
              ? "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center transition-colors hover:bg-muted/40 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60"
              : "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-3 py-6 text-center transition-colors hover:bg-muted/40 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60"
          }
          data-disabled={processing || isPending}
        >
          <input {...getInputProps()} />
          {processing ? (
            <Loader2Icon className={isInline ? "size-8 animate-spin text-[#1D9E75]" : "size-6 animate-spin text-[#1D9E75]"} />
          ) : (
            <UploadIcon className={isInline ? "size-8 text-muted-foreground" : "size-6 text-muted-foreground"} />
          )}
          <p className={`mt-2 font-medium ${isInline ? "text-sm" : "text-xs"}`}>
            {processing
              ? phaseLabel
              : isDragActive
                ? "Drop brief here"
                : uploadedFileName
                  ? "Drop or click to replace brief"
                  : "Drag & drop or click to upload"}
          </p>
          {!processing && !uploadedFileName && isInline ? (
            <p className="mt-1 text-xs text-muted-foreground">Max 25 MB</p>
          ) : null}
        </div>

        {uploadedFileName ? (
          <div
            className={`mt-3 flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
              uploadPhase === "ready"
                ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30"
                : uploadPhase === "error"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border bg-muted/30"
            }`}
          >
            {uploadPhase === "ready" ? (
              <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-[#1D9E75]" />
            ) : processing ? (
              <Loader2Icon className="mt-0.5 size-5 shrink-0 animate-spin text-[#1D9E75]" />
            ) : (
              <FileTextIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{uploadedFileName}</p>
              <p className="text-xs text-muted-foreground">
                {uploadedFileSize != null ? `${formatFileSize(uploadedFileSize)} · ` : ""}
                {phaseLabel ?? "Ready"}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section
        className={
          isInline
            ? "space-y-4 rounded-xl border border-border bg-card p-4"
            : "space-y-3"
        }
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Campaign intelligence</h2>
          <Badge variant={profile.status === "saved" ? "default" : "secondary"}>
            {profile.status === "saved" ? "Saved" : profileId ? "Draft" : "Pending"}
          </Badge>
        </div>

        {!showFields ? (
          <p className="text-sm text-muted-foreground">Upload a brief to see extracted campaign fields here.</p>
        ) : null}

        {sparseHint ? (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Limited text was read from this file. Edit the fields below or try exporting the brief as
            .docx or .pdf.
          </p>
        ) : null}

        {showFields ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Brand"
                value={profile.brandName ?? ""}
                onChange={(v) => setProfile({ ...profile, brandName: v })}
                disabled={processing}
              />
              <Field
                label="Market"
                value={profile.market ?? ""}
                onChange={(v) => setProfile({ ...profile, market: v })}
                disabled={processing}
              />
              <Field
                label="Campaign name"
                value={profile.campaignName ?? ""}
                onChange={(v) => setProfile({ ...profile, campaignName: v })}
                disabled={processing}
              />
              <Field
                label="Campaign type"
                value={profile.campaignType ?? ""}
                onChange={(v) => setProfile({ ...profile, campaignType: v })}
                disabled={processing}
              />
            </div>

            <div>
              <Label className="text-xs">Objectives</Label>
              <Textarea
                className="mt-1 min-h-[60px] text-sm"
                value={joinList(profile.objectives)}
                onChange={(e) =>
                  setProfile({ ...profile, objectives: parseList(e.target.value) })
                }
                disabled={processing}
              />
            </div>

            <div>
              <Label className="text-xs">Audience summary</Label>
              <Textarea
                className="mt-1 min-h-[52px] text-sm"
                value={profile.audience ?? ""}
                onChange={(e) => setProfile({ ...profile, audience: e.target.value })}
                disabled={processing}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field
                label="Gender"
                value={profile.audienceDetail?.gender ?? ""}
                onChange={(v) =>
                  setProfile({
                    ...profile,
                    audienceDetail: { ...profile.audienceDetail, gender: v },
                  })
                }
                disabled={processing}
              />
              <Field
                label="Age min"
                value={profile.audienceDetail?.ageMin?.toString() ?? ""}
                onChange={(v) =>
                  setProfile({
                    ...profile,
                    audienceDetail: {
                      ...profile.audienceDetail,
                      ageMin: v ? Number(v) : undefined,
                    },
                  })
                }
                disabled={processing}
              />
              <Field
                label="Age max"
                value={profile.audienceDetail?.ageMax?.toString() ?? ""}
                onChange={(v) =>
                  setProfile({
                    ...profile,
                    audienceDetail: {
                      ...profile.audienceDetail,
                      ageMax: v ? Number(v) : undefined,
                    },
                  })
                }
                disabled={processing}
              />
            </div>

            <div>
              <Label className="text-xs">Creator categories</Label>
              <Input
                className="mt-1 text-sm"
                value={joinList(profile.creatorCategories)}
                onChange={(e) =>
                  setProfile({ ...profile, creatorCategories: parseList(e.target.value) })
                }
                disabled={processing}
              />
            </div>

            <div>
              <Label className="text-xs">Platforms</Label>
              <Input
                className="mt-1 text-sm"
                value={joinList(profile.platforms)}
                onChange={(e) =>
                  setProfile({ ...profile, platforms: parseList(e.target.value) })
                }
                placeholder="instagram, tiktok"
                disabled={processing}
              />
            </div>

            <div>
              <Label className="text-xs">Deliverables</Label>
              <Input
                className="mt-1 text-sm"
                value={joinList(profile.deliverables)}
                onChange={(e) =>
                  setProfile({ ...profile, deliverables: parseList(e.target.value) })
                }
                disabled={processing}
              />
            </div>

            <div>
              <Label className="text-xs">KPIs</Label>
              <Input
                className="mt-1 text-sm"
                value={joinList(profile.kpis)}
                onChange={(e) => setProfile({ ...profile, kpis: parseList(e.target.value) })}
                disabled={processing}
              />
            </div>
          </>
        ) : null}
      </section>

      <div className={isInline ? "flex flex-wrap items-center gap-2" : undefined}>
        <Button
          type="button"
          onClick={runSave}
          disabled={!profileId || processing || isPending}
          className={isInline ? undefined : "w-full"}
          size={isInline ? "default" : "sm"}
        >
        {isPending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <FileTextIcon className="size-4" />
        )}
        Save campaign intelligence
        </Button>
      </div>
    </div>
  );
}

function profileHasVisibleData(profile: CampaignIntelligenceProfile): boolean {
  return Boolean(
    profile.brandName?.trim() ||
      profile.campaignName?.trim() ||
      profile.market?.trim() ||
      profile.audience?.trim() ||
      (profile.objectives?.length ?? 0) > 0 ||
      (profile.creatorCategories?.length ?? 0) > 0 ||
      (profile.platforms?.length ?? 0) > 0
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        className="mt-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
