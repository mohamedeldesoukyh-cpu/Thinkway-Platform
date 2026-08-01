"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
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
  DELIVERABLE_ASSET_TYPES,
  DELIVERABLE_ASSET_TYPE_LABELS,
  type DocumentationUnitDetail,
  type DocumentationUnitSummary,
} from "@/lib/services/deliverables/documentation-types";
import { cn } from "@/lib/utils";

type Props = {
  workspace: CampaignWorkspace;
  assignmentHierarchy: AssignmentHierarchy;
  initialCreatorFilter?: string | null;
};

function receivedBadge(received: boolean) {
  return received ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">Received</Badge>
  ) : (
    <Badge variant="outline">Missing</Badge>
  );
}

export function CampaignDeliverablesDocumentationTab({
  workspace,
  initialCreatorFilter = null,
}: Props) {
  const campaignId = workspace.id;
  const [units, setUnits] = useState<DocumentationUnitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState(
    initialCreatorFilter ?? "all"
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentationUnitDetail | null>(null);
  const [pending, startTransition] = useTransition();

  const [assetType, setAssetType] = useState<string>("draft_video");
  const [linkUrl, setLinkUrl] = useState("");
  const [textBody, setTextBody] = useState("");
  const [commentBody, setCommentBody] = useState("");

  function refreshList() {
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
  }

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per campaign
  }, [campaignId]);

  useEffect(() => {
    if (!selectedKey) {
      setDetail(null);
      return;
    }
    const unit = units.find((u) => u.unitKey === selectedKey);
    if (!unit) return;
    void getDeliverableDocumentationDetailAction({
      campaignHeaderId: campaignId,
      assignmentDeliverableId: unit.assignmentDeliverableId,
      assignmentPostScheduleId: unit.assignmentPostScheduleId,
    }).then((result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setDetail(result.data);
    });
  }, [selectedKey, units, campaignId]);

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

  const selected = units.find((u) => u.unitKey === selectedKey) ?? null;

  const receivedCount = useMemo(
    () => units.filter((unit) => unit.received).length,
    [units]
  );
  const missingCount = Math.max(0, units.length - receivedCount);

  function withSelected(
    run: (unit: DocumentationUnitSummary) => Promise<void>
  ) {
    if (!selected) return;
    startTransition(async () => {
      await run(selected);
      refreshList();
      setSelectedKey(selected.unitKey);
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
          key: "received",
          label: "Received",
          value: loading ? "…" : String(receivedCount),
          tone: "pos",
        },
        {
          key: "missing",
          label: "Missing",
          value: loading ? "…" : String(missingCount),
          tone: missingCount > 0 ? "amber" : "mut",
        },
        {
          key: "creators",
          label: "Creators",
          value: String(creators.length),
          tone: "blue",
        },
      ]}
      registerLabel="Documentation register"
    >
    <div className="space-y-4">
      <CampaignOperationalSectionHeader
        title="Repository"
        description="Search and open a unit to manage assets and comments."
      />

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
              <p className="p-4 text-sm text-muted-foreground">
                No documentation units. Add deliverables under Assignments first.
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((unit) => (
                  <li key={unit.unitKey}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(unit.unitKey)}
                      className={cn(
                        "flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-muted/40",
                        selectedKey === unit.unitKey && "bg-muted/60"
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
                ))}
              </ul>
            )}
          </div>

          <div className="p-3">
            {!selected || !detail ? (
              <p className="text-sm text-muted-foreground">
                Select a deliverable to manage documentation.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">{detail.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {detail.creatorName} · {detail.platform ?? "—"} ·{" "}
                    {detail.assignmentName}
                  </p>
                  <div className="mt-2">{receivedBadge(detail.received)}</div>
                </div>

                <section className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Assets
                  </h4>
                  {detail.assets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No assets yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.assets.map((asset) => (
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
                  <h4 className="text-xs font-medium">Add documentation</h4>
                  <div className="grid gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Asset type</Label>
                      <Select value={assetType} onValueChange={setAssetType}>
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
                        disabled={pending}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file || !selected) return;
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
                          reader.onload = () => {
                            const result = String(reader.result ?? "");
                            const base64 = result.includes(",")
                              ? result.split(",")[1] ?? ""
                              : result;
                            withSelected(async (unit) => {
                              const res = await uploadDeliverableFileAssetAction(
                                {
                                  campaignHeaderId: campaignId,
                                  assignmentDeliverableId:
                                    unit.assignmentDeliverableId,
                                  assignmentPostScheduleId:
                                    unit.assignmentPostScheduleId,
                                  assetType,
                                  label: file.name,
                                  fileName: file.name,
                                  mimeType: file.type || "application/octet-stream",
                                  fileBase64: base64,
                                }
                              );
                              if (!res.ok) toast.error(res.message);
                              else toast.success("File uploaded");
                            });
                          };
                          reader.readAsDataURL(file);
                          event.target.value = "";
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">External link</Label>
                      <div className="flex gap-2">
                        <Input
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://drive.google.com/…"
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8"
                          disabled={pending || !linkUrl.trim()}
                          onClick={() =>
                            withSelected(async (unit) => {
                              const res = await addDeliverableExternalLinkAction(
                                {
                                  campaignHeaderId: campaignId,
                                  assignmentDeliverableId:
                                    unit.assignmentDeliverableId,
                                  assignmentPostScheduleId:
                                    unit.assignmentPostScheduleId,
                                  assetType,
                                  externalUrl: linkUrl,
                                }
                              );
                              if (!res.ok) toast.error(res.message);
                              else {
                                toast.success("Link added");
                                setLinkUrl("");
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
                        value={textBody}
                        onChange={(e) => setTextBody(e.target.value)}
                        rows={2}
                        className="text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={pending || !textBody.trim()}
                        onClick={() =>
                          withSelected(async (unit) => {
                            const res = await addDeliverableTextAssetAction({
                              campaignHeaderId: campaignId,
                              assignmentDeliverableId:
                                unit.assignmentDeliverableId,
                              assignmentPostScheduleId:
                                unit.assignmentPostScheduleId,
                              assetType:
                                assetType === "caption" ? "caption" : "other",
                              textBody,
                            });
                            if (!res.ok) toast.error(res.message);
                            else {
                              toast.success("Text saved");
                              setTextBody("");
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
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    rows={2}
                    className="text-xs"
                    placeholder="Internal note…"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={pending || !commentBody.trim()}
                    onClick={() =>
                      withSelected(async (unit) => {
                        const res = await addDeliverableInternalCommentAction({
                          campaignHeaderId: campaignId,
                          assignmentDeliverableId: unit.assignmentDeliverableId,
                          assignmentPostScheduleId:
                            unit.assignmentPostScheduleId,
                          body: commentBody,
                        });
                        if (!res.ok) toast.error(res.message);
                        else {
                          toast.success("Comment added");
                          setCommentBody("");
                        }
                      })
                    }
                  >
                    Add comment
                  </Button>
                  <ul className="space-y-2">
                    {detail.comments.map((comment) => (
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
              </div>
            )}
          </div>
        </div>
      </OperationalTableSection>
    </div>
    </CampaignWorkspaceFrame>
  );
}
