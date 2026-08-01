"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  getDeliverableAssetDownloadUrlAction,
  getDeliverableDocumentationDetailAction,
  listDeliverableDocumentationAction,
  uploadDeliverableFileAssetAction,
} from "@/features/campaigns/actions/deliverable-documentation-actions";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import {
  DOCUMENTATION_SELECTION_LOCKED_MESSAGE,
  DOCUMENTATION_UPLOAD_CANCELLED_MESSAGE,
  assertDocumentationEditorBinding,
} from "@/features/campaigns/components/tabs/documentation-editor-binding";
import {
  DELIVERABLE_ASSET_TYPES,
  DELIVERABLE_ASSET_TYPE_LABELS,
  type DocumentationUnitDetail,
  type DocumentationUnitSummary,
} from "@/lib/services/deliverables/documentation-types";
import { DocumentNumber } from "@/components/ui/document-number";
import { cn } from "@/lib/utils";

type Props = {
  workspace: CampaignWorkspace;
  assignmentHierarchy: AssignmentHierarchy;
  initialCreatorFilter?: string | null;
};

const DEFAULT_ASSET_TYPE = "draft_video";

function receivedBadge(received: boolean) {
  return received ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">Received</Badge>
  ) : (
    <Badge variant="outline">Missing</Badge>
  );
}

type EditorDrafts = {
  assetType: string;
  linkUrl: string;
  textBody: string;
  commentBody: string;
};

function emptyDrafts(): EditorDrafts {
  return {
    assetType: DEFAULT_ASSET_TYPE,
    linkUrl: "",
    textBody: "",
    commentBody: "",
  };
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
}: Props) {
  const campaignId = workspace.id;
  const [units, setUnits] = useState<DocumentationUnitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState(
    initialCreatorFilter ?? "all"
  );
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

  const detailRequestIdRef = useRef(0);
  const uploadSessionRef = useRef(0);
  const selectedKeyRef = useRef<string | null>(null);
  const detailRef = useRef<DocumentationUnitDetail | null>(null);
  selectedKeyRef.current = selectedKey;
  detailRef.current = detail;

  const refreshList = useCallback(() => {
    setLoading(true);
    void listDeliverableDocumentationAction({
      campaignHeaderId: campaignId,
    }).then((result) => {
      setLoading(false);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setUnits(result.data);
    });
  }, [campaignId]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

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
      }).then((result) => {
        if (requestId !== detailRequestIdRef.current) return;
        if (selectedKeyRef.current !== unitKey) return;
        setDetailLoading(false);
        if (!result.ok) {
          toast.error(result.message);
          setDetail(null);
          return;
        }
        setDetail(result.data);
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
    loadDetailForKey(selectedKey, units);
  }, [selectedKey, units, loadDetailForKey]);

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
      if (!q) return true;
      return [
        unit.label,
        unit.creatorName,
        unit.assignmentName,
        unit.platform,
        unit.deliverableType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [units, search, creatorFilter]);

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

  const applySelection = useCallback((nextKey: string | null) => {
    setDrafts(emptyDrafts());
    setSelectedKey(nextKey);
  }, []);

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
      if (!assertWriteBinding(unit)) return;
      await run(unit);
      refreshList();
      loadDetailForKey(unit.unitKey, units);
    });
  }

  return (
    <CampaignWorkspaceFrame
      title="Deliverables"
      subtitle="Documentation repository — files, links, captions, versions, and comments"
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
    >
      <div className="space-y-4">
        <OperationalTableSection wide>
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <div className="relative min-w-[220px] flex-1">
              <SearchIcon className="pointer-events-none absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search creator, deliverable, assignment…"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
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
          </div>

          <div className="grid min-h-[480px] grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="border-r">
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : filtered.length === 0 ? (
                <AuroraEmptyState
                  title="No documentation units yet."
                  description="Add deliverables under Assignments first, then return here to upload files, links, and captions."
                />
              ) : (
                <ul className="divide-y" role="listbox" aria-label="Documentation units">
                  {filtered.map((unit) => {
                    const isActive = selectedKey === unit.unitKey;
                    return (
                      <li key={unit.unitKey}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          aria-disabled={selectionLocked && !isActive}
                          disabled={selectionLocked && !isActive}
                          onClick={() => requestSelect(unit.unitKey)}
                          className={cn(
                            "flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                            isActive && "bg-muted/60",
                            selectionLocked && !isActive && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">
                              {unit.label}
                            </span>
                            {receivedBadge(unit.received)}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {unit.creatorName ?? "—"} · {unit.assignmentName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {unit.contentAssetCount} content asset
                            {unit.contentAssetCount === 1 ? "" : "s"}
                            {unit.latestVersionLabel
                              ? ` · ${unit.latestVersionLabel}`
                              : ""}
                            {unit.revisionCount > 0
                              ? ` · ${unit.revisionCount} version(s)`
                              : ""}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-3">
              {!selected ? (
                <p className="text-sm text-muted-foreground">
                  Select a creator deliverable to manage documentation.
                </p>
              ) : (
                <div
                  key={selected.unitKey}
                  className="space-y-4"
                  data-documentation-unit={selected.unitKey}
                >
                  {/* Persistent context — always follows selected row immediately */}
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--camp-text)]">
                          {selected.creatorName ?? "Unassigned creator"}
                        </p>
                        {receivedBadge(selected.received)}
                      </div>
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[12px]">
                        <dt className="text-[var(--camp-text-4)]">Platform</dt>
                        <dd className="truncate text-[var(--camp-text-2)]">
                          {selected.platform ?? "—"}
                        </dd>
                        <dt className="text-[var(--camp-text-4)]">Deliverable</dt>
                        <dd className="truncate text-[var(--camp-text-2)]">
                          {selected.deliverableType ?? selected.label}
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
                        <dd className="truncate text-[var(--camp-text-2)]">
                          {selected.received
                            ? "Documentation received"
                            : "Documentation missing"}
                          {selectionLocked ? " · Upload in progress" : ""}
                        </dd>
                      </dl>
                    </div>
                  </div>

                  {detailLoading && !boundDetail ? (
                    <p className="text-sm text-muted-foreground">
                      Loading documentation for {selected.creatorName ?? "this creator"}…
                    </p>
                  ) : null}

                  {boundDetail ? (
                    <>
                      <section className="space-y-2">
                        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Existing documentation
                        </h4>
                        {boundDetail.assets.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No assets yet for this creator deliverable.
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
                                {asset.currentVersion?.storagePath ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-2 h-7"
                                    disabled={pending}
                                    onClick={() =>
                                      withSelected(async (unit) => {
                                        const res =
                                          await getDeliverableAssetDownloadUrlAction({
                                            campaignHeaderId: campaignId,
                                            assignmentDeliverableId:
                                              unit.assignmentDeliverableId,
                                            assignmentPostScheduleId:
                                              unit.assignmentPostScheduleId,
                                            versionId: asset.currentVersion!.id,
                                          });
                                        if (!res.ok) {
                                          toast.error(res.message);
                                          return;
                                        }
                                        window.open(res.data.url, "_blank");
                                      })
                                    }
                                  >
                                    Download
                                  </Button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      <section className="space-y-2 rounded-md border p-3">
                        <h4 className="text-xs font-medium">
                          Add documentation · {selected.creatorName ?? "Selected"}
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
                              className="h-8 text-xs"
                              disabled={pending || selectionLocked}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file || !selected || !boundDetail) return;
                                if (!assertWriteBinding(selected)) {
                                  event.target.value = "";
                                  return;
                                }
                                if (
                                  selected.quantity > 1 &&
                                  !selected.assignmentPostScheduleId
                                ) {
                                  toast.error(
                                    "Post schedule missing for this unit — create posts under Assignments first."
                                  );
                                  return;
                                }
                                const reader = new FileReader();
                                const unitAtUpload = selected;
                                const assetTypeAtUpload = drafts.assetType;
                                const session = ++uploadSessionRef.current;
                                setSelectionLocked(true);
                                reader.onerror = () => {
                                  if (session === uploadSessionRef.current) {
                                    setSelectionLocked(false);
                                  }
                                  toast.error("Could not read the selected file.");
                                };
                                reader.onload = () => {
                                  const result = String(reader.result ?? "");
                                  const base64 = result.includes(",")
                                    ? result.split(",")[1] ?? ""
                                    : result;
                                  startTransition(async () => {
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
                                      const res =
                                        await uploadDeliverableFileAssetAction({
                                          campaignHeaderId: campaignId,
                                          assignmentDeliverableId:
                                            unitAtUpload.assignmentDeliverableId,
                                          assignmentPostScheduleId:
                                            unitAtUpload.assignmentPostScheduleId,
                                          assetType: assetTypeAtUpload,
                                          label: file.name,
                                          fileName: file.name,
                                          mimeType:
                                            file.type ||
                                            "application/octet-stream",
                                          fileBase64: base64,
                                        });
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
                                      if (!res.ok) toast.error(res.message);
                                      else {
                                        toast.success("File uploaded");
                                        refreshList();
                                        loadDetailForKey(
                                          unitAtUpload.unitKey,
                                          units
                                        );
                                      }
                                    } finally {
                                      if (session === uploadSessionRef.current) {
                                        setSelectionLocked(false);
                                      }
                                    }
                                  });
                                };
                                reader.readAsDataURL(file);
                                event.target.value = "";
                              }}
                            />
                            {selectionLocked ? (
                              <p className="text-[11px] text-[var(--camp-text-4)]">
                                Upload in progress — selection is locked for this
                                creator.
                              </p>
                            ) : null}
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
              {selected?.creatorName ?? "the current creator"}. Save them before
              switching, discard them, or cancel.
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
                  const ok = await persistDraftsForUnit(unit, currentDrafts);
                  if (!ok) return;
                  toast.success("Drafts saved");
                  refreshList();
                  setUnsavedOpen(false);
                  setPendingSelectKey(null);
                  applySelection(next);
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
