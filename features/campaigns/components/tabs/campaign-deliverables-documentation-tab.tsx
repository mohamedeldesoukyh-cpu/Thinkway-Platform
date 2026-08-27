"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import {
  AuroraEmptyState,
  AuroraStatusPill,
  CampaignWorkspaceFrame,
} from "@/features/campaigns/components/aurora/campaign-workspace-frame";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  addDeliverableExternalLinkAction,
  addDeliverableInternalCommentAction,
  addDeliverableTextAssetAction,
  beginDeliverableFileUploadAction,
  completeDeliverableFileUploadAction,
  getDeliverableDocumentationDetailAction,
  listDeliverableDocumentationAggregatesAction,
} from "@/features/campaigns/actions/deliverable-documentation-actions";
import {
  deliverableUploadMeterValue,
  deliverableUploadPercent,
  deliverableUploadProgressLabel,
  putDeliverableAssetToSignedUrl,
  type DeliverableUploadPhase,
} from "@/features/campaigns/deliverable-asset-upload";
import { DeliverableAssetPreview } from "@/features/campaigns/components/deliverables/deliverable-asset-preview";
import {
  DocumentationRepositoryList,
  documentationStatusBadge,
} from "@/features/campaigns/components/deliverables/documentation-repository-list";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import {
  DOCUMENTATION_SELECTION_LOCKED_MESSAGE,
  DOCUMENTATION_UPLOAD_CANCELLED_MESSAGE,
  assertDocumentationEditorBinding,
  stampDocumentationDetailIdentity,
} from "@/features/campaigns/components/tabs/documentation-editor-binding";
import {
  DELIVERABLE_ASSET_MAX_BYTES,
  DELIVERABLE_ASSET_TOO_LARGE_MESSAGE,
  DELIVERABLE_ASSET_TYPES,
  DELIVERABLE_ASSET_TYPE_LABELS,
  defaultDeliverableAssetType,
  documentationReceiptStatus,
  inferDeliverableAssetMime,
  isAllowedDeliverableUploadMime,
  unfinishedFileAssetId,
  versionCountsAsClientContent,
  type DocumentationUnitDetail,
  type DocumentationUnitSummary,
} from "@/lib/services/deliverables/documentation-types";
import {
  documentationSlotTitle,
  documentationTypeGroupKey,
  listDocumentationTypeOptions,
} from "@/lib/services/deliverables/documentation-list-groups";
import { friendlyServerActionError } from "@/lib/clients/client-document-utils";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  deliverableTypeLabel,
  getPlatformOptionLabel,
} from "@/lib/campaigns/deliverable-taxonomy";
import {
  applyDocumentationAggregates,
  buildDocumentationUnitsFromHierarchy,
} from "@/lib/services/deliverables/build-documentation-units";

type Props = {
  workspace: CampaignWorkspace;
  assignmentHierarchy: AssignmentHierarchy;
  initialCreatorFilter?: string | null;
  /** Deep-link (?deliverable=) selects the documentation unit by assignment deliverable id. */
  initialDeliverableId?: string | null;
  initialPostScheduleId?: string | null;
  onBackToSchedule?: () => void;
};

type EditorDrafts = {
  assetType: string;
  linkUrl: string;
  textBody: string;
  commentBody: string;
};

function emptyDrafts(assetType = defaultDeliverableAssetType(null)): EditorDrafts {
  return {
    assetType,
    linkUrl: "",
    textBody: "",
    commentBody: "",
  };
}

function slotReceiptStatus(
  unit: DocumentationUnitSummary,
  detail: DocumentationUnitDetail | null
) {
  if (detail && unfinishedFileAssetId(detail.assets, "") && !unit.received) {
    return "incomplete" as const;
  }
  return documentationReceiptStatus(unit);
}

function slotStatusCopy(
  unit: DocumentationUnitSummary,
  detail: DocumentationUnitDetail | null
): string {
  const status = slotReceiptStatus(unit, detail);
  if (status === "received") return "Documentation received";
  if (status === "incomplete") {
    const unfinished = detail?.assets.some(
      (asset) =>
        asset.medium === "file" &&
        !versionCountsAsClientContent(asset.currentVersion)
    );
    if (unfinished) {
      return "Upload did not finish — choose the file again for this slot";
    }
    return "Documentation started — still needs a finished file or link";
  }
  return "No finished file or link for this slot yet";
}

function draftsAreDirty(drafts: EditorDrafts): boolean {
  return Boolean(
    drafts.linkUrl.trim() || drafts.textBody.trim() || drafts.commentBody.trim()
  );
}

export function CampaignDeliverablesDocumentationTab({
  workspace,
  assignmentHierarchy,
  initialCreatorFilter = null,
  initialDeliverableId = null,
  initialPostScheduleId = null,
  onBackToSchedule,
}: Props) {
  const campaignId = workspace.id;
  const hierarchyUnits = useMemo(
    () =>
      buildDocumentationUnitsFromHierarchy(
        assignmentHierarchy,
        campaignId,
        new Map()
      ),
    [assignmentHierarchy, campaignId]
  );
  const [units, setUnits] = useState<DocumentationUnitSummary[]>(hierarchyUnits);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState(
    initialCreatorFilter ?? "all"
  );
  const [typeFilter, setTypeFilter] = useState("all");
  /** Selected repository unit — SSOT for which creator/deliverable is active. */
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  /** Detail bound only when detail.unitKey === selectedKey. */
  const [detail, setDetail] = useState<DocumentationUnitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<EditorDrafts>(emptyDrafts);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [pendingSelectKey, setPendingSelectKey] = useState<string | null>(null);
  /** Locks repository selection while a file upload is in flight. */
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [uploadMeter, setUploadMeter] = useState<{
    phase: DeliverableUploadPhase;
    fileName: string;
    loaded: number;
    total: number;
  } | null>(null);

  const detailRequestIdRef = useRef(0);
  const uploadSessionRef = useRef(0);
  const selectedKeyRef = useRef<string | null>(null);
  const detailRef = useRef<DocumentationUnitDetail | null>(null);
  const deliverableFocusApplied = useRef(false);
  selectedKeyRef.current = selectedKey;
  detailRef.current = detail;

  const refreshList = useCallback(() => {
    void listDeliverableDocumentationAggregatesAction({
      campaignHeaderId: campaignId,
    })
      .then((result) => {
        setLoading(false);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        setUnits(
          applyDocumentationAggregates(
            buildDocumentationUnitsFromHierarchy(
              assignmentHierarchy,
              campaignId,
              new Map()
            ),
            result.data
          )
        );
      })
      .catch((error) => {
        setLoading(false);
        toast.error(friendlyServerActionError(error));
      });
  }, [assignmentHierarchy, campaignId]);

  useEffect(() => {
    setUnits(hierarchyUnits);
    refreshList();
  }, [hierarchyUnits, refreshList]);

  useEffect(() => {
    if (!initialDeliverableId || deliverableFocusApplied.current || units.length === 0) {
      return;
    }
    const exact = initialPostScheduleId
      ? units.find(
          (unit) =>
            unit.assignmentDeliverableId === initialDeliverableId &&
            unit.assignmentPostScheduleId === initialPostScheduleId
        )
      : null;
    const match =
      exact ??
      units.find((unit) => unit.assignmentDeliverableId === initialDeliverableId);
    if (!match) return;
    deliverableFocusApplied.current = true;
    setSelectedKey(match.unitKey);
    setDrafts(emptyDrafts(defaultDeliverableAssetType(match.deliverableType)));
    if (match.creatorId) setCreatorFilter(match.creatorId);
    setTypeFilter(documentationTypeGroupKey(match));
  }, [initialDeliverableId, initialPostScheduleId, units]);

  const loadDetailForKey = useCallback(
    (unitKey: string, unitsSnapshot: DocumentationUnitSummary[]) => {
      const unit = unitsSnapshot.find((u) => u.unitKey === unitKey);
      if (!unit) {
        setDetail(null);
        setDetailLoading(false);
        return;
      }

      const requestId = ++detailRequestIdRef.current;
      setDetailLoading(true);
      // Clear stale editor payload immediately — never keep prior creator's docs.
      setDetail((prev) => (prev?.unitKey === unitKey ? prev : null));

      void getDeliverableDocumentationDetailAction({
        campaignHeaderId: campaignId,
        assignmentDeliverableId: unit.assignmentDeliverableId,
        assignmentPostScheduleId: unit.assignmentPostScheduleId,
      })
        .then((result) => {
          if (requestId !== detailRequestIdRef.current) return;
          if (selectedKeyRef.current !== unitKey) return;
          setDetailLoading(false);
          if (!result.ok) {
            toast.error(result.message);
            setDetail(null);
            return;
          }
          if (!result.data) {
            setDetail(null);
            return;
          }
          const stamped = stampDocumentationDetailIdentity(result.data, unit);
          if (!stamped) {
            setDetail(null);
            return;
          }
          setDetail(stamped);
        })
        .catch((error) => {
          if (requestId !== detailRequestIdRef.current) return;
          setDetailLoading(false);
          toast.error(friendlyServerActionError(error));
        });
    },
    [campaignId]
  );

  useEffect(() => {
    if (!selectedKey) {
      detailRequestIdRef.current += 1;
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    if (selectionLocked) return;
    loadDetailForKey(selectedKey, units);
  }, [selectedKey, units, loadDetailForKey, selectionLocked]);

  const creators = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of units) {
      if (unit.creatorId && unit.creatorName) {
        map.set(unit.creatorId, unit.creatorName);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [units]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((unit) => {
      if (creatorFilter !== "all" && unit.creatorId !== creatorFilter) {
        return false;
      }
      if (typeFilter !== "all" && documentationTypeGroupKey(unit) !== typeFilter) {
        return false;
      }
      if (!q) return true;
      return [
        unit.label,
        unit.creatorName,
        documentationSlotTitle(unit),
        unit.platform,
        unit.deliverableType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [units, search, creatorFilter, typeFilter]);

  const typeOptions = useMemo(() => {
    const scoped =
      creatorFilter === "all"
        ? units
        : units.filter((unit) => unit.creatorId === creatorFilter);
    return listDocumentationTypeOptions(scoped);
  }, [units, creatorFilter]);

  const selected = useMemo(
    () => units.find((u) => u.unitKey === selectedKey) ?? null,
    [units, selectedKey]
  );

  /** Editor documentation payload — only when bound to current selection. */
  const boundDetail =
    detail && selectedKey && detail.unitKey === selectedKey ? detail : null;

  const assignmentDocumentNumber = useMemo(() => {
    if (!selected) return null;
    const group = assignmentHierarchy.groups.find(
      (entry) => entry.line.id === selected.assignmentLineId
    );
    return group?.line.document_number ?? null;
  }, [selected, assignmentHierarchy.groups]);

  const receivedCount = useMemo(
    () => units.filter((unit) => unit.received).length,
    [units]
  );
  const missingCount = Math.max(0, units.length - receivedCount);
  const pendingCount = missingCount;
  const approvedCount = useMemo(
    () => units.filter((unit) => unit.publicationLinkCount > 0).length,
    [units]
  );

  const assertWriteBinding = useCallback(
    (writeUnit: DocumentationUnitSummary): boolean => {
      const bound = detailRef.current;
      const result = assertDocumentationEditorBinding({
        selectedKey: selectedKeyRef.current,
        boundDetailUnitKey: bound?.unitKey ?? null,
        selectedAssignmentLineId:
          units.find((u) => u.unitKey === selectedKeyRef.current)
            ?.assignmentLineId ?? null,
        boundAssignmentLineId: bound?.assignmentLineId ?? null,
        writeAssignmentLineId: writeUnit.assignmentLineId,
        writeUnitKey: writeUnit.unitKey,
      });
      if (!result.ok) {
        toast.error(result.message);
        return false;
      }
      return true;
    },
    [units]
  );

  const applySelection = useCallback(
    (nextKey: string | null) => {
      const unit = nextKey
        ? units.find((entry) => entry.unitKey === nextKey)
        : null;
      setDrafts(emptyDrafts(defaultDeliverableAssetType(unit?.deliverableType)));
      setSelectedKey(nextKey);
    },
    [units]
  );

  const requestSelect = useCallback(
    (nextKey: string) => {
      if (nextKey === selectedKey) return;
      if (selectionLocked) {
        toast.message(DOCUMENTATION_SELECTION_LOCKED_MESSAGE);
        return;
      }
      if (draftsAreDirty(drafts)) {
        setPendingSelectKey(nextKey);
        setUnsavedOpen(true);
        return;
      }
      applySelection(nextKey);
    },
    [selectedKey, selectionLocked, drafts, applySelection]
  );

  async function persistDraftsForUnit(
    unit: DocumentationUnitSummary,
    current: EditorDrafts
  ): Promise<boolean> {
    if (!assertWriteBinding(unit)) return false;
    let ok = true;
    if (current.linkUrl.trim()) {
      if (!assertWriteBinding(unit)) return false;
      const res = await addDeliverableExternalLinkAction({
        campaignHeaderId: campaignId,
        assignmentDeliverableId: unit.assignmentDeliverableId,
        assignmentPostScheduleId: unit.assignmentPostScheduleId,
        assetType: current.assetType,
        externalUrl: current.linkUrl,
      });
      if (!res.ok) {
        toast.error(res.message);
        ok = false;
      }
    }
    if (current.textBody.trim()) {
      if (!assertWriteBinding(unit)) return false;
      const res = await addDeliverableTextAssetAction({
        campaignHeaderId: campaignId,
        assignmentDeliverableId: unit.assignmentDeliverableId,
        assignmentPostScheduleId: unit.assignmentPostScheduleId,
        assetType: current.assetType === "caption" ? "caption" : "other",
        textBody: current.textBody,
      });
      if (!res.ok) {
        toast.error(res.message);
        ok = false;
      }
    }
    if (current.commentBody.trim()) {
      if (!assertWriteBinding(unit)) return false;
      const res = await addDeliverableInternalCommentAction({
        campaignHeaderId: campaignId,
        assignmentDeliverableId: unit.assignmentDeliverableId,
        assignmentPostScheduleId: unit.assignmentPostScheduleId,
        body: current.commentBody,
      });
      if (!res.ok) {
        toast.error(res.message);
        ok = false;
      }
    }
    return ok;
  }

  function withSelected(
    run: (unit: DocumentationUnitSummary) => Promise<void>
  ) {
    if (!selected || !boundDetail) return;
    const unit = selected;
    if (!assertWriteBinding(unit)) return;
    startTransition(async () => {
      try {
        if (!assertWriteBinding(unit)) return;
        await run(unit);
        refreshList();
        loadDetailForKey(unit.unitKey, units);
      } catch (error) {
        toast.error(friendlyServerActionError(error));
      }
    });
  }

  return (
    <CampaignWorkspaceFrame
      title="Deliverables"
      subtitle="Upload files, links, and captions for client review — plus versions and comments"
      tools={
        onBackToSchedule ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="thinkway-campaign-btn h-[33px] text-[12px]"
            onClick={onBackToSchedule}
          >
            Back to schedule
          </Button>
        ) : null
      }
      status={
        <AuroraStatusPill
          tone={
            units.length === 0
              ? "mut"
              : missingCount === 0
                ? "green"
                : "amber"
          }
        >
          {loading
            ? "Loading…"
            : units.length === 0
              ? "No units"
              : `${missingCount} missing docs`}
        </AuroraStatusPill>
      }
      stats={[
        { key: "total", label: "Units", value: loading ? "…" : String(units.length) },
        {
          key: "pending",
          label: "Pending",
          value: loading ? "…" : String(pendingCount),
          tone: pendingCount > 0 ? "amber" : "mut",
        },
        {
          key: "received",
          label: "Received",
          value: loading ? "…" : String(receivedCount),
          tone: "pos",
        },
        {
          key: "approved",
          label: "Approved",
          value: loading ? "…" : String(approvedCount),
          tone: approvedCount > 0 ? "blue" : "mut",
        },
        {
          key: "missing",
          label: "Missing",
          value: loading ? "…" : String(missingCount),
          tone: missingCount > 0 ? "amber" : "mut",
        },
      ]}
      registerLabel="Repository"
      collapseRegister
      registerCount={units.length}
      registerStorageKey={`deliverables-${workspace.id}`}
      forceRegisterOpen={Boolean(
        initialCreatorFilter || initialDeliverableId || onBackToSchedule
      )}
    >
      <div className="space-y-4">
        <OperationalTableSection wide>
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <div className="relative min-w-[180px] flex-1">
              <SearchIcon className="pointer-events-none absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search slot, creator, type…"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Select
              value={creatorFilter}
              onValueChange={(value) => {
                setCreatorFilter(value);
                setTypeFilter("all");
              }}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Creator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All creators</SelectItem>
                {creators.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {typeOptions.map((option) => (
                  <SelectItem key={option.groupKey} value={option.groupKey}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-h-[480px] grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <div className="max-h-[min(72vh,720px)] overflow-y-auto border-r">
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : filtered.length === 0 ? (
                <AuroraEmptyState
                  title={
                    units.length === 0
                      ? "No documentation units yet."
                      : "No slots match these filters."
                  }
                  description={
                    units.length === 0
                      ? "Deliverables unlock after Vendor IO acceptance. Add creators under Assignments first. Owner: Operations — Decision Center shows the clearance path."
                      : "Choose All types or another creator to see reel vs story slots."
                  }
                />
              ) : (
                <DocumentationRepositoryList
                  units={filtered}
                  selectedKey={selectedKey}
                  selectionLocked={selectionLocked}
                  hideCreatorHeaders={creatorFilter !== "all"}
                  onSelect={requestSelect}
                />
              )}
            </div>

            <div className="p-3">
              {!selected ? (
                <p className="text-sm text-muted-foreground">
                  Open a type on the left, then pick the exact slot (Reel #1 or
                  Story #3) before you upload.
                </p>
              ) : (
                <div
                  key={selected.unitKey}
                  className="space-y-4"
                  data-documentation-unit={selected.unitKey}
                >
                  <div
                    className="thinkway-aurora-doc-panel flex items-start gap-3 p-3"
                    data-selected-unit={selected.unitKey}
                    aria-live="polite"
                  >
                    <CreatorThumbAvatar
                      name={selected.creatorName ?? "Creator"}
                      size={38}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--camp-text-4)]">
                        Uploading for this slot
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--camp-text)]">
                          {documentationSlotTitle(selected)}
                        </p>
                        {documentationStatusBadge(
                          slotReceiptStatus(selected, boundDetail)
                        )}
                      </div>
                      <p className="truncate text-[12px] text-[var(--camp-text-2)]">
                        {selected.creatorName ?? "Unassigned creator"}
                      </p>
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[12px]">
                        <dt className="text-[var(--camp-text-4)]">Platform</dt>
                        <dd className="truncate text-[var(--camp-text-2)]">
                          {selected.platform
                            ? getPlatformOptionLabel(selected.platform)
                            : "—"}
                        </dd>
                        <dt className="text-[var(--camp-text-4)]">Type</dt>
                        <dd className="truncate text-[var(--camp-text-2)]">
                          {selected.deliverableType
                            ? deliverableTypeLabel(selected.deliverableType)
                            : selected.label}
                        </dd>
                        <dt className="text-[var(--camp-text-4)]">Assignment ID</dt>
                        <dd className="truncate text-[var(--camp-text-2)]">
                          {assignmentDocumentNumber ? (
                            <DocumentNumber value={assignmentDocumentNumber} />
                          ) : (
                            selected.assignmentName
                          )}
                        </dd>
                        <dt className="text-[var(--camp-text-4)]">Status</dt>
                        <dd className="text-[var(--camp-text-2)]">
                          {slotStatusCopy(selected, boundDetail)}
                          {uploadMeter
                            ? uploadMeter.phase === "uploading"
                              ? ` · Uploading ${deliverableUploadPercent(uploadMeter.loaded, uploadMeter.total)}%`
                              : uploadMeter.phase === "preparing"
                                ? " · Preparing upload"
                                : " · Saving upload"
                            : selectionLocked
                              ? " · Upload in progress"
                              : ""}
                        </dd>
                      </dl>
                    </div>
                  </div>

                  {detailLoading && !boundDetail ? (
                    <p className="text-sm text-muted-foreground">
                      Loading documentation for {documentationSlotTitle(selected)}…
                    </p>
                  ) : null}

                  {boundDetail ? (
                    <>
                      <section className="space-y-2">
                        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Play uploaded content
                        </h4>
                        {boundDetail.assets.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No playable file or link yet. Choose an MP4/MOV below or add a
                            link, then wait until the player appears here. Client Workspace
                            only shows files that finish saving.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {boundDetail.assets.map((asset) => (
                              <li
                                key={asset.id}
                                className="rounded-md border px-2.5 py-2 text-xs"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium">
                                    {DELIVERABLE_ASSET_TYPE_LABELS[asset.assetType]}
                                    {asset.label ? ` · ${asset.label}` : ""}
                                  </span>
                                  <span className="text-muted-foreground">
                                    v{asset.currentVersion?.versionNumber ?? "—"} ·{" "}
                                    {asset.medium}
                                  </span>
                                </div>
                                {asset.currentVersion?.externalUrl ? (
                                  <a
                                    href={asset.currentVersion.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 block truncate text-[var(--camp-blue)] hover:underline"
                                  >
                                    {asset.currentVersion.externalUrl}
                                  </a>
                                ) : null}
                                {asset.currentVersion?.textBody ? (
                                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                    {asset.currentVersion.textBody}
                                  </p>
                                ) : null}
                                <DeliverableAssetPreview
                                  campaignHeaderId={campaignId}
                                  assignmentDeliverableId={
                                    selected.assignmentDeliverableId
                                  }
                                  assignmentPostScheduleId={
                                    selected.assignmentPostScheduleId
                                  }
                                  asset={asset}
                                  disabled={pending}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      <section className="space-y-2 rounded-md border p-3">
                        <h4 className="text-xs font-medium">
                          Add documentation · {documentationSlotTitle(selected)}
                        </h4>
                        <div className="grid gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Asset type</Label>
                            <Select
                              value={drafts.assetType}
                              onValueChange={(value) =>
                                setDrafts((prev) => ({ ...prev, assetType: value }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DELIVERABLE_ASSET_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {DELIVERABLE_ASSET_TYPE_LABELS[type]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px]">Upload file</Label>
                            <Input
                              type="file"
                              accept=".mp4,.m4v,.mov,.webm,.jpg,.jpeg,.png,.webp,.pdf,video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,application/pdf"
                              className="h-8 text-xs"
                              disabled={pending || selectionLocked}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (!file || !selected || !boundDetail) return;
                                if (!assertWriteBinding(selected)) return;
                                if (
                                  selected.quantity > 1 &&
                                  !selected.assignmentPostScheduleId
                                ) {
                                  toast.error(
                                    "Post schedule missing for this unit — create posts under Assignments first."
                                  );
                                  return;
                                }
                                if (file.size > DELIVERABLE_ASSET_MAX_BYTES) {
                                  toast.error(DELIVERABLE_ASSET_TOO_LARGE_MESSAGE);
                                  return;
                                }
                                const unitAtUpload = selected;
                                const assetTypeAtUpload = drafts.assetType;
                                const reuseAssetId = unfinishedFileAssetId(
                                  boundDetail.assets,
                                  assetTypeAtUpload
                                );
                                const mimeType = inferDeliverableAssetMime(
                                  file.type,
                                  file.name
                                );
                                if (!isAllowedDeliverableUploadMime(mimeType)) {
                                  toast.error(
                                    "This file type is not supported. Use MP4 or MOV under 100 MB."
                                  );
                                  return;
                                }
                                const session = ++uploadSessionRef.current;
                                setUploadMeter({
                                  phase: "preparing",
                                  fileName: file.name,
                                  loaded: 0,
                                  total: file.size,
                                });
                                setSelectionLocked(true);
                                void (async () => {
                                  try {
                                    if (
                                      selectedKeyRef.current !==
                                      unitAtUpload.unitKey
                                    ) {
                                      toast.error(
                                        DOCUMENTATION_UPLOAD_CANCELLED_MESSAGE
                                      );
                                      return;
                                    }
                                    if (!assertWriteBinding(unitAtUpload)) {
                                      return;
                                    }
                                    const begun =
                                      await beginDeliverableFileUploadAction({
                                        campaignHeaderId: campaignId,
                                        assignmentDeliverableId:
                                          unitAtUpload.assignmentDeliverableId,
                                        assignmentPostScheduleId:
                                          unitAtUpload.assignmentPostScheduleId,
                                        assetType: assetTypeAtUpload,
                                        label: file.name,
                                        assetId: reuseAssetId,
                                        fileName: file.name,
                                        mimeType,
                                        fileSize: file.size,
                                      });
                                    if (!begun.ok) {
                                      toast.error(begun.message);
                                      return;
                                    }
                                    if (session !== uploadSessionRef.current) {
                                      return;
                                    }
                                    setUploadMeter({
                                      phase: "uploading",
                                      fileName: file.name,
                                      loaded: 0,
                                      total: file.size,
                                    });
                                    const uploaded =
                                      await putDeliverableAssetToSignedUrl({
                                        signedUrl: begun.data.signedUrl,
                                        token: begun.data.token,
                                        file,
                                        mimeType,
                                        onProgress: (progress) => {
                                          if (
                                            session !== uploadSessionRef.current
                                          ) {
                                            return;
                                          }
                                          setUploadMeter({
                                            phase: "uploading",
                                            fileName: file.name,
                                            loaded: progress.loaded,
                                            total: progress.total,
                                          });
                                        },
                                      });
                                    if (!uploaded.ok) {
                                      toast.error(uploaded.message);
                                      return;
                                    }
                                    if (
                                      selectedKeyRef.current !==
                                      unitAtUpload.unitKey
                                    ) {
                                      toast.error(
                                        DOCUMENTATION_UPLOAD_CANCELLED_MESSAGE
                                      );
                                      return;
                                    }
                                    if (session !== uploadSessionRef.current) {
                                      return;
                                    }
                                    setUploadMeter({
                                      phase: "finishing",
                                      fileName: file.name,
                                      loaded: file.size,
                                      total: file.size,
                                    });
                                    const completed =
                                      await completeDeliverableFileUploadAction({
                                        campaignHeaderId: campaignId,
                                        assignmentDeliverableId:
                                          unitAtUpload.assignmentDeliverableId,
                                        assignmentPostScheduleId:
                                          unitAtUpload.assignmentPostScheduleId,
                                        assetType: assetTypeAtUpload,
                                        fileName: file.name,
                                        mimeType,
                                        fileSize: file.size,
                                        assetId: begun.data.assetId,
                                        versionId: begun.data.versionId,
                                        versionNumber: begun.data.versionNumber,
                                        storagePath: begun.data.storagePath,
                                      });
                                    if (!completed.ok) {
                                      toast.error(completed.message);
                                      return;
                                    }
                                    toast.success("File uploaded");
                                    refreshList();
                                    loadDetailForKey(
                                      unitAtUpload.unitKey,
                                      units
                                    );
                                  } catch (error) {
                                    toast.error(
                                      friendlyServerActionError(error)
                                    );
                                  } finally {
                                    if (session === uploadSessionRef.current) {
                                      setSelectionLocked(false);
                                      setUploadMeter(null);
                                    }
                                  }
                                })();
                              }}
                            />
                            {uploadMeter ? (
                              <div
                                className="space-y-1.5"
                                aria-live="polite"
                                aria-label="Upload progress"
                              >
                                <Progress
                                  value={deliverableUploadMeterValue(uploadMeter)}
                                  className="h-1.5"
                                />
                                <p className="text-[11px] text-[var(--camp-text-4)]">
                                  {deliverableUploadProgressLabel(uploadMeter)} —
                                  selection is locked for this creator.
                                </p>
                              </div>
                            ) : selectionLocked ? (
                              <p className="text-[11px] text-[var(--camp-text-4)]">
                                Upload in progress — selection is locked for this
                                creator.
                              </p>
                            ) : (
                              <p className="text-[11px] text-[var(--camp-text-4)]">
                                MP4 or MOV, up to 100 MB. This file goes to the
                                slot selected on the left — open Instagram reel
                                for a reel, Instagram story for a story.
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px]">External link</Label>
                            <div className="flex gap-2">
                              <Input
                                value={drafts.linkUrl}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    linkUrl: e.target.value,
                                  }))
                                }
                                placeholder="https://drive.google.com/…"
                                className="h-8 text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-8"
                                disabled={pending || !drafts.linkUrl.trim()}
                                onClick={() =>
                                  withSelected(async (unit) => {
                                    const res =
                                      await addDeliverableExternalLinkAction({
                                        campaignHeaderId: campaignId,
                                        assignmentDeliverableId:
                                          unit.assignmentDeliverableId,
                                        assignmentPostScheduleId:
                                          unit.assignmentPostScheduleId,
                                        assetType: drafts.assetType,
                                        externalUrl: drafts.linkUrl,
                                      });
                                    if (!res.ok) toast.error(res.message);
                                    else {
                                      toast.success("Link added");
                                      setDrafts((prev) => ({
                                        ...prev,
                                        linkUrl: "",
                                      }));
                                    }
                                  })
                                }
                              >
                                Add
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              Caption / copy (does not mark Received)
                            </Label>
                            <Textarea
                              value={drafts.textBody}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  textBody: e.target.value,
                                }))
                              }
                              rows={2}
                              className="text-xs"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              disabled={pending || !drafts.textBody.trim()}
                              onClick={() =>
                                withSelected(async (unit) => {
                                  const res = await addDeliverableTextAssetAction({
                                    campaignHeaderId: campaignId,
                                    assignmentDeliverableId:
                                      unit.assignmentDeliverableId,
                                    assignmentPostScheduleId:
                                      unit.assignmentPostScheduleId,
                                    assetType:
                                      drafts.assetType === "caption"
                                        ? "caption"
                                        : "other",
                                    textBody: drafts.textBody,
                                  });
                                  if (!res.ok) toast.error(res.message);
                                  else {
                                    toast.success("Text saved");
                                    setDrafts((prev) => ({
                                      ...prev,
                                      textBody: "",
                                    }));
                                  }
                                })
                              }
                            >
                              Save text
                            </Button>
                          </div>
                        </div>
                      </section>

                      <section className="space-y-2">
                        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Internal comments
                        </h4>
                        <Textarea
                          value={drafts.commentBody}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              commentBody: e.target.value,
                            }))
                          }
                          rows={2}
                          className="text-xs"
                          placeholder="Internal note…"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8"
                          disabled={pending || !drafts.commentBody.trim()}
                          onClick={() =>
                            withSelected(async (unit) => {
                              const res = await addDeliverableInternalCommentAction({
                                campaignHeaderId: campaignId,
                                assignmentDeliverableId:
                                  unit.assignmentDeliverableId,
                                assignmentPostScheduleId:
                                  unit.assignmentPostScheduleId,
                                body: drafts.commentBody,
                              });
                              if (!res.ok) toast.error(res.message);
                              else {
                                toast.success("Comment added");
                                setDrafts((prev) => ({
                                  ...prev,
                                  commentBody: "",
                                }));
                              }
                            })
                          }
                        >
                          Add comment
                        </Button>
                        <ul className="space-y-2">
                          {boundDetail.comments.map((comment) => (
                            <li
                              key={comment.id}
                              className="rounded-md border px-2 py-1.5 text-xs"
                            >
                              <p className="text-muted-foreground">
                                {comment.authorDisplayName ?? "User"} ·{" "}
                                {new Date(comment.createdAt).toLocaleString()}
                              </p>
                              <p className="mt-0.5 whitespace-pre-wrap">
                                {comment.body}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </OperationalTableSection>
      </div>

      <Dialog
        open={unsavedOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUnsavedOpen(false);
            setPendingSelectKey(null);
          }
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved documentation changes</DialogTitle>
            <DialogDescription>
              You have unsaved link, caption, or comment drafts for{" "}
              {selected ? documentationSlotTitle(selected) : "the current slot"}.
              Save them before switching, discard them, or cancel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUnsavedOpen(false);
                setPendingSelectKey(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={selectionLocked}
              onClick={() => {
                if (selectionLocked) {
                  toast.message(DOCUMENTATION_SELECTION_LOCKED_MESSAGE);
                  return;
                }
                const next = pendingSelectKey;
                setUnsavedOpen(false);
                setPendingSelectKey(null);
                applySelection(next);
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              disabled={pending || !selected || selectionLocked}
              onClick={() => {
                if (!selected || !pendingSelectKey || !boundDetail) return;
                if (!assertWriteBinding(selected)) return;
                const unit = selected;
                const currentDrafts = drafts;
                const next = pendingSelectKey;
                startTransition(async () => {
                  try {
                    const ok = await persistDraftsForUnit(unit, currentDrafts);
                    if (!ok) return;
                    toast.success("Drafts saved");
                    refreshList();
                    setUnsavedOpen(false);
                    setPendingSelectKey(null);
                    applySelection(next);
                  } catch (error) {
                    toast.error(friendlyServerActionError(error));
                  }
                });
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CampaignWorkspaceFrame>
  );
}
