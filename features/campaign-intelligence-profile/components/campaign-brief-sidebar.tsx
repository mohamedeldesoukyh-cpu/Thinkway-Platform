"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useDropzone } from "react-dropzone";
import {
  AlertCircleIcon,
  CheckIcon,
  FileTextIcon,
  Loader2Icon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isCampaignIntelligencePipelineDebugEnabled } from "@/lib/campaign-intelligence/pipeline-debug-flag";

import {
  type CampaignIntelligenceWorkspaceState,
  type CampaignBriefUploadPendingState,
  deleteCampaignBriefAction,
  loadCampaignIntelligenceWorkspaceAction,
  saveCampaignIntelligenceProfileAction,
  uploadCampaignBriefAction,
} from "../actions/profile-actions";
import {
  discoveryRequirementsToProfile,
  EMPTY_DISCOVERY_REQUIREMENTS,
  profileToDiscoveryRequirements,
} from "../services/discovery-campaign-requirements";
import { formatCampaignRequirements } from "../services/format-campaign-requirements";
import type { DiscoveryCampaignRequirements } from "../services/discovery-campaign-requirements";
import type { CampaignIntelligenceProfile } from "../types/profile";
import { createEmptyCampaignIntelligenceProfile } from "../types/profile";

import {
  CampaignIntelligenceDetailSheet,
  hasCampaignIntelligenceExtras,
} from "./campaign-intelligence-detail-sheet";
import { CampaignRequirementsForm } from "./campaign-requirements-form";
import { ExtractionReviewPanel } from "./extraction-review-panel";
import { CampaignIntelligencePipelineInspector } from "./pipeline-inspector";
import { CampaignIntelligenceLibrary } from "./campaign-intelligence-library";
import { CampaignIntelligenceLinkDialog } from "./campaign-intelligence-link-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialState?: CampaignIntelligenceWorkspaceState | null;
  onWorkspaceChange?: (state: CampaignIntelligenceWorkspaceState) => void;
  onBriefCleared?: () => void;
  onRunAiSearch?: () => void;
  /** Fired after brief upload/analysis — parent should auto-run Discovery search (Indahash-style). */
  onBriefAnalyzed?: (state: CampaignIntelligenceWorkspaceState) => void;
};

type UploadPhase = "idle" | "uploading" | "analyzing" | "ready" | "error";
type SidebarTab = "requirements" | "pipeline";

function buildStateFromForm(
  profileId: string,
  profile: CampaignIntelligenceProfile,
  fileName: string | null,
  fileSizeBytes: number | null
): CampaignIntelligenceWorkspaceState {
  const requirements = formatCampaignRequirements(profile);
  return {
    profileId,
    profile,
    fileName,
    fileSizeBytes,
    hasExtractedData: true,
    parsedTextLength: requirements.length,
    parsedTextPreview: requirements.slice(0, 12_000),
  };
}

function buildFootNote(profile: CampaignIntelligenceProfile): string | null {
  const debug = profile.pipelineDebug;
  if (debug) {
    const accepted = debug.validation.accepted.length;
    const rejected = debug.validation.rejected.length;
    const filters = debug.discoveryMapping?.filters.length ?? 0;
    return `${accepted} accepted · ${rejected} rejected in validation · ${filters} discovery filters mapped`;
  }
  const issues = profile.extractionIssues?.length ?? 0;
  if (issues > 0) {
    return `${issues} extraction issue${issues === 1 ? "" : "s"} — review before search`;
  }
  return null;
}

function RequirementSkeleton() {
  return (
    <div className="thinkway-campaign-req-grid" aria-busy="true" aria-label="Analyzing campaign brief">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn("thinkway-campaign-req-card", i === 2 && "full")}
        >
          <div className="thinkway-campaign-req-card-head">
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="thinkway-campaign-req-card-body space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CampaignBriefSidebar({
  open,
  onOpenChange,
  initialState,
  onWorkspaceChange,
  onBriefCleared,
  onRunAiSearch,
  onBriefAnalyzed,
}: Props) {
  const [profileId, setProfileId] = useState<string | null>(initialState?.profileId ?? null);
  const [profile, setProfile] = useState<CampaignIntelligenceProfile>(
    initialState?.profile ?? createEmptyCampaignIntelligenceProfile()
  );
  const [requirements, setRequirements] = useState<DiscoveryCampaignRequirements>(
    EMPTY_DISCOVERY_REQUIREMENTS
  );
  const [requirementsDirty, setRequirementsDirty] = useState(false);
  const [fileName, setFileName] = useState<string | null>(initialState?.fileName ?? null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(
    initialState?.fileSizeBytes ?? null
  );
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(
    initialState?.profileId ? "ready" : "idle"
  );
  const [activeTab, setActiveTab] = useState<SidebarTab>("requirements");
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [extractionReviewOpen, setExtractionReviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const confirmDelete = useConfirmDelete();
  const [isDeleting, setIsDeleting] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<CampaignBriefUploadPendingState | null>(null);

  const processing = uploadPhase === "uploading" || uploadPhase === "analyzing";
  const hasUploadedBrief = Boolean(profileId && fileName && uploadPhase === "ready");
  const hasRequirements = hasUploadedBrief;
  const extractionIssueCount = profile.extractionIssues?.length ?? 0;
  const footNote = useMemo(() => buildFootNote(profile), [profile]);
  const showPipelineTab =
    isCampaignIntelligencePipelineDebugEnabled() || Boolean(profile.pipelineDebug);

  useEffect(() => {
    if (!intelligenceOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIntelligenceOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [intelligenceOpen]);

  useEffect(() => {
    if (!open) return;
    setProfileId(initialState?.profileId ?? null);
    const nextProfile = initialState?.profile ?? createEmptyCampaignIntelligenceProfile();
    setProfile(nextProfile);
    setRequirements(
      initialState?.profile
        ? profileToDiscoveryRequirements(initialState.profile)
        : EMPTY_DISCOVERY_REQUIREMENTS
    );
    setFileName(initialState?.fileName ?? null);
    setFileSizeBytes(initialState?.fileSizeBytes ?? null);
    setUploadPhase(initialState?.profileId ? "ready" : "idle");
    setRequirementsDirty(false);
    setActiveTab("requirements");
  }, [open, initialState]);

  const applyWorkspace = useCallback(
    (state: CampaignIntelligenceWorkspaceState) => {
      setProfileId(state.profileId);
      setProfile(state.profile);
      setRequirements(profileToDiscoveryRequirements(state.profile));
      setFileName(state.fileName);
      setFileSizeBytes(state.fileSizeBytes);
      setUploadPhase("ready");
      setRequirementsDirty(false);
      onWorkspaceChange?.(state);
    },
    [onWorkspaceChange]
  );

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setFileName(file.name);
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
          setPendingUpload(result.pending);
          setLinkDialogOpen(true);
          return;
        }

        applyWorkspace(result.workspace);
        setHistoryRefreshKey((key) => key + 1);
        onBriefAnalyzed?.(result.workspace);
        const issues = result.workspace.profile.extractionIssues ?? [];
        if (issues.length > 0) {
          toast.warning(
            `"${result.fileName}" analyzed with ${issues.length} extraction issue${issues.length === 1 ? "" : "s"}. Running search with extracted filters.`,
            {
              action: {
                label: "Review",
                onClick: () => setExtractionReviewOpen(true),
              },
            }
          );
        } else {
          toast.success(`"${result.fileName}" analyzed — running creator search.`);
        }
      } catch (error) {
        setUploadPhase("error");
        toast.error(error instanceof Error ? error.message : "Upload failed");
      }
    },
    [applyWorkspace, onBriefAnalyzed]
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
    disabled: processing || isPending || isDeleting,
  });

  const resetBriefForm = useCallback(() => {
    setProfileId(null);
    setProfile(createEmptyCampaignIntelligenceProfile());
    setRequirements(EMPTY_DISCOVERY_REQUIREMENTS);
    setFileName(null);
    setFileSizeBytes(null);
    setRequirementsDirty(false);
    setUploadPhase("idle");
  }, []);

  const handleDeleteBrief = useCallback(async () => {
    if (!profileId || !hasUploadedBrief) return;
    const ok = await confirmDelete(
      "Remove this campaign brief? The uploaded file and extracted requirements will be deleted.",
      "Remove campaign brief?"
    );
    if (!ok) return;

    setIsDeleting(true);
    startTransition(async () => {
      try {
        const result = await deleteCampaignBriefAction(profileId);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        resetBriefForm();
        onBriefCleared?.();
        setHistoryRefreshKey((key) => key + 1);
        toast.success("Campaign brief removed.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not remove brief");
      } finally {
        setIsDeleting(false);
      }
    });
  }, [confirmDelete, hasUploadedBrief, onBriefCleared, profileId, resetBriefForm]);

  const persistAndClose = useCallback(
    (afterSave?: () => void) => {
      if (!profileId) {
        onOpenChange(false);
        return;
      }

      startTransition(async () => {
        try {
          const nextProfile = requirementsDirty
            ? discoveryRequirementsToProfile(profile, requirements)
            : profile;

          const saveResult = await saveCampaignIntelligenceProfileAction(profileId, nextProfile);
          if (!saveResult.ok) {
            toast.error(saveResult.message);
            return;
          }

          const savedProfile = { ...nextProfile, status: "saved" as const };
          const nextState = buildStateFromForm(profileId, savedProfile, fileName, fileSizeBytes);
          setProfile(savedProfile);
          setRequirements(profileToDiscoveryRequirements(savedProfile));
          setRequirementsDirty(false);
          onWorkspaceChange?.(nextState);
          afterSave?.();
          onOpenChange(false);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not save brief");
        }
      });
    },
    [
      profileId,
      profile,
      requirements,
      requirementsDirty,
      fileName,
      fileSizeBytes,
      onOpenChange,
      onWorkspaceChange,
    ]
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }
      persistAndClose();
    },
    [persistAndClose, onOpenChange]
  );

  function handleRequirementsChange(next: DiscoveryCampaignRequirements) {
    setRequirements(next);
    setRequirementsDirty(true);
  }

  function handleRunAiSearch() {
    persistAndClose(() => onRunAiSearch?.());
  }

  const linkDialog = (
    <CampaignIntelligenceLinkDialog
      open={linkDialogOpen}
      pending={pendingUpload}
      onOpenChange={(next) => {
        setLinkDialogOpen(next);
        if (!next) setPendingUpload(null);
      }}
      onComplete={(workspace) => {
        applyWorkspace(workspace);
        setHistoryRefreshKey((key) => key + 1);
        setPendingUpload(null);
        onBriefAnalyzed?.(workspace);
      }}
    />
  );

  if (!open) {
    return (
      <>
        <CampaignIntelligenceDetailSheet
          open={intelligenceOpen}
          onOpenChange={setIntelligenceOpen}
          profile={profile}
        />
        <ExtractionReviewPanel
          open={extractionReviewOpen}
          onOpenChange={setExtractionReviewOpen}
          issues={profile.extractionIssues ?? []}
          requirements={requirements}
        />
        {linkDialog}
      </>
    );
  }

  return (
    <>
      {!linkDialogOpen ? (
      <div
        className="fixed inset-0 z-50 flex items-stretch justify-end bg-[rgba(13,21,38,0.45)] backdrop-blur-[2px]"
        role="presentation"
        onClick={() => handleOpenChange(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleOpenChange(false);
        }}
      >
        <aside
          className={cn(
            "thinkway-campaign-req-sidebar flex h-full w-full max-w-[720px] flex-col overflow-hidden shadow-[-24px_0_64px_rgba(13,21,38,0.25)] animate-in slide-in-from-right duration-200",
            intelligenceOpen && "ring-2 ring-inset ring-[var(--camp-blue)]/30"
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="campaign-req-title"
          onClick={(e) => {
            e.stopPropagation();
            if (intelligenceOpen) setIntelligenceOpen(false);
          }}
        >
          <div className="thinkway-campaign-req-head">
            <div>
              <h2 id="campaign-req-title" className="thinkway-campaign-req-title">
                Campaign requirements
              </h2>
              <p className="thinkway-campaign-req-sub">
                What Thinkway will search for in Discovery. Review in under 30 seconds, then run AI
                creator search.
              </p>
            </div>
            <button
              type="button"
              className="thinkway-campaign-req-close"
              aria-label="Close"
              onClick={() => handleOpenChange(false)}
              disabled={isPending || isDeleting}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {hasUploadedBrief ? (
            <div className="thinkway-campaign-req-source-strip">
              <div className="thinkway-campaign-req-file-chip">
                <CheckIcon strokeWidth={2.5} />
                <FileTextIcon className="!text-[var(--camp-text-3)]" strokeWidth={2} />
                <span className="max-w-[280px] truncate">{fileName}</span>
              </div>
              <button
                type="button"
                className="thinkway-campaign-req-remove-file"
                onClick={handleDeleteBrief}
                disabled={isPending || isDeleting}
              >
                {isDeleting ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  <Trash2Icon className="size-3" />
                )}
                Remove file
              </button>
              {extractionIssueCount > 0 ? (
                <div className="thinkway-campaign-req-extraction-flag">
                  <span className="thinkway-campaign-req-flag-badge">
                    <AlertCircleIcon className="size-3.5" />
                    {extractionIssueCount} extraction issue{extractionIssueCount === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    className="thinkway-campaign-req-flag-link"
                    onClick={() => setExtractionReviewOpen(true)}
                  >
                    Review
                  </button>
                </div>
              ) : null}
              {hasCampaignIntelligenceExtras(profile) ? (
                <button
                  type="button"
                  className="thinkway-campaign-req-flag-link"
                  onClick={() => setIntelligenceOpen(true)}
                >
                  View intelligence
                </button>
              ) : null}
            </div>
          ) : null}

          {hasRequirements ? (
            <div className="thinkway-campaign-req-tabs" role="tablist" aria-label="Campaign requirements sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "requirements"}
                className="thinkway-campaign-req-tab"
                data-active={activeTab === "requirements"}
                onClick={() => setActiveTab("requirements")}
              >
                Requirements
              </button>
              {showPipelineTab ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "pipeline"}
                  className="thinkway-campaign-req-tab"
                  data-active={activeTab === "pipeline"}
                  onClick={() => setActiveTab("pipeline")}
                >
                  Pipeline inspector
                  <span className="thinkway-campaign-req-tab-badge">debug</span>
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="thinkway-campaign-req-scroll">
            {!hasUploadedBrief ? (
              <div className="thinkway-campaign-req-pane space-y-4" data-active="true">
                <div
                  {...getRootProps()}
                  className={cn(
                    "thinkway-campaign-req-dropzone",
                    (processing || isPending || isDeleting) && "pointer-events-none opacity-60"
                  )}
                >
                  <input {...getInputProps()} />
                  {processing ? (
                    <Loader2Icon className="size-8 animate-spin text-[var(--camp-blue)]" />
                  ) : (
                    <UploadIcon className="size-8 text-[var(--camp-text-3)]" />
                  )}
                  <p className="mt-3 text-sm font-medium text-[var(--camp-text)]">
                    {processing
                      ? uploadPhase === "uploading"
                        ? "Uploading file..."
                        : "Analyzing..."
                      : isDragActive
                        ? "Drop file here"
                        : "Drag & drop a brief or click to upload"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--camp-text-3)]">
                    PDF, Word, PowerPoint, TXT · Max 25 MB
                  </p>
                </div>
                <CampaignIntelligenceLibrary
                  activeProfileId={profileId}
                  compact
                  onOpenInSearch={(id) => {
                    void loadCampaignIntelligenceWorkspaceAction(id).then((workspace) => {
                      if (!workspace) {
                        toast.error("Brief not found or access denied.");
                        return;
                      }
                      applyWorkspace(workspace);
                      onBriefAnalyzed?.(workspace);
                    });
                  }}
                  key={historyRefreshKey}
                />
              </div>
            ) : (
              <>
                <div
                  className="thinkway-campaign-req-pane"
                  data-active={activeTab === "requirements"}
                  role="tabpanel"
                >
                  {processing ? (
                    <RequirementSkeleton />
                  ) : (
                    <CampaignRequirementsForm
                      value={requirements}
                      onChange={handleRequirementsChange}
                      baseProfile={profile}
                      disabled={isPending || isDeleting}
                    />
                  )}
                </div>

                {showPipelineTab ? (
                  <div
                    className="thinkway-campaign-req-pane"
                    data-active={activeTab === "pipeline"}
                    role="tabpanel"
                  >
                    <CampaignIntelligencePipelineInspector profile={profile} />
                  </div>
                ) : null}

                <CampaignIntelligenceLibrary
                  activeProfileId={profileId}
                  compact
                  onOpenInSearch={(id) => {
                    void loadCampaignIntelligenceWorkspaceAction(id).then((workspace) => {
                      if (!workspace) {
                        toast.error("Brief not found or access denied.");
                        return;
                      }
                      applyWorkspace(workspace);
                      onBriefAnalyzed?.(workspace);
                    });
                  }}
                  key={historyRefreshKey}
                  className="mx-4 mb-4"
                />
              </>
            )}
          </div>

          <div className="thinkway-campaign-req-foot">
            {footNote ? (
              <span className="thinkway-campaign-req-foot-note">{footNote}</span>
            ) : (
              <span className="thinkway-campaign-req-foot-note">
                Upload a brief to extract search requirements
              </span>
            )}
            <div className="thinkway-campaign-req-foot-actions">
              <button
                type="button"
                className="thinkway-campaign-req-btn"
                onClick={() => handleOpenChange(false)}
                disabled={isPending || isDeleting}
              >
                Close
              </button>
              <button
                type="button"
                className="thinkway-campaign-req-btn thinkway-campaign-req-btn-primary"
                onClick={handleRunAiSearch}
                disabled={!hasRequirements || isPending || isDeleting || processing}
              >
                {isPending ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <SearchIcon className="size-3.5" />
                )}
                Run AI creator search
              </button>
            </div>
          </div>
        </aside>
      </div>
      ) : null}

      <CampaignIntelligenceDetailSheet
        open={intelligenceOpen}
        onOpenChange={setIntelligenceOpen}
        profile={profile}
      />

      <ExtractionReviewPanel
        open={extractionReviewOpen}
        onOpenChange={setExtractionReviewOpen}
        issues={profile.extractionIssues ?? []}
        requirements={requirements}
      />

      {linkDialog}
    </>
  );
}
