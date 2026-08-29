"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DeliverableExplorerTypePill } from "@/features/campaigns/components/deliverables/deliverable-explorer-cells";
import { DocumentationUnitScriptActions } from "@/features/campaigns/components/script/documentation-unit-script-actions";
import {
  defaultOpenTypeGroupKeys,
  documentationSlotRowLabel,
  documentationTypeGroupKey,
  groupDocumentationUnits,
  type DocumentationTypeGroup,
} from "@/lib/services/deliverables/documentation-list-groups";
import {
  documentationReceiptStatus,
  type DocumentationReceiptStatus,
  type DocumentationUnitSummary,
} from "@/lib/services/deliverables/documentation-types";
import {
  documentationUnitCanHoldScript,
  type CampaignScriptUnitPresence,
  type DocumentationUnitScriptIntent,
} from "@/lib/campaign-script";
import { cn } from "@/lib/utils";

export function documentationStatusBadge(status: DocumentationReceiptStatus) {
  if (status === "received") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">Received</Badge>
    );
  }
  if (status === "incomplete") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/60 text-amber-800 dark:text-amber-300"
      >
        Incomplete
      </Badge>
    );
  }
  return <Badge variant="outline">Missing</Badge>;
}

function safeDue(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parseISO(value.includes("T") ? value : `${value}T00:00:00`);
  if (!isValid(parsed)) return null;
  try {
    return format(parsed, "d MMM");
  } catch {
    return null;
  }
}

function typeProgressLabel(group: DocumentationTypeGroup): string {
  const total = group.units.length;
  if (group.receivedCount === total) return `${total} of ${total} received`;
  if (group.incompleteCount > 0) {
    return `${group.receivedCount} of ${total} received · ${group.incompleteCount} incomplete`;
  }
  return `${group.receivedCount} of ${total} received`;
}

type Props = {
  units: DocumentationUnitSummary[];
  selectedKey: string | null;
  selectionLocked: boolean;
  hideCreatorHeaders: boolean;
  onSelect: (unitKey: string) => void;
  scriptPresence: ReadonlyMap<string, CampaignScriptUnitPresence>;
  campaignId: string;
  onOpenScript: (unitKey: string, intent: DocumentationUnitScriptIntent) => void;
};

export function DocumentationRepositoryList({
  units,
  selectedKey,
  selectionLocked,
  hideCreatorHeaders,
  onSelect,
  scriptPresence,
  campaignId,
  onOpenScript,
}: Props) {
  const creatorGroups = useMemo(() => groupDocumentationUnits(units), [units]);
  const defaultOpen = useMemo(
    () => defaultOpenTypeGroupKeys(creatorGroups, selectedKey),
    [creatorGroups, selectedKey]
  );
  const [typeOpenOverrides, setTypeOpenOverrides] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (!selectedKey) return;
    const selected = units.find((unit) => unit.unitKey === selectedKey);
    if (!selected) return;
    const key = documentationTypeGroupKey(selected);
    setTypeOpenOverrides((prev) => {
      if (!(key in prev) || prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [selectedKey, units]);

  function isTypeOpen(groupKey: string): boolean {
    if (Object.prototype.hasOwnProperty.call(typeOpenOverrides, groupKey)) {
      return Boolean(typeOpenOverrides[groupKey]);
    }
    return defaultOpen.has(groupKey);
  }

  function toggleType(groupKey: string) {
    const nextOpen = !isTypeOpen(groupKey);
    setTypeOpenOverrides((prev) => ({ ...prev, [groupKey]: nextOpen }));
  }

  return (
    <div className="divide-y" role="listbox" aria-label="Documentation slots">
      {creatorGroups.map((creator) => (
        <section key={creator.creatorId ?? creator.creatorName ?? "unassigned"}>
          {!hideCreatorHeaders ? (
            <header className="sticky top-0 z-[1] flex items-center justify-between gap-2 border-b bg-background px-3 py-1.5">
              <p className="truncate text-[11px] font-semibold text-[var(--camp-text)]">
                {creator.creatorName ?? "Unassigned creator"}
              </p>
              <p className="shrink-0 text-[10px] text-muted-foreground">
                {creator.receivedCount} of {creator.unitCount} received
              </p>
            </header>
          ) : null}
          {creator.types.map((typeGroup) => {
            const open = isTypeOpen(typeGroup.groupKey);
            return (
              <div key={`${creator.creatorId ?? "x"}:${typeGroup.groupKey}`}>
                <button
                  type="button"
                  onClick={() => toggleType(typeGroup.groupKey)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30"
                >
                  {open ? (
                    <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {typeGroup.platform && typeGroup.deliverableType ? (
                    <DeliverableExplorerTypePill
                      platform={typeGroup.platform}
                      deliverableType={typeGroup.deliverableType}
                    />
                  ) : (
                    <span className="text-xs font-semibold">{typeGroup.typeLabel}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--camp-text)]">
                    {typeGroup.typeLabel}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {open ? typeProgressLabel(typeGroup) : `${typeGroup.units.length} slots`}
                  </span>
                </button>
                {open ? (
                  <ul>
                    {typeGroup.units.map((unit) => {
                      const isActive = selectedKey === unit.unitKey;
                      const status = documentationReceiptStatus(unit);
                      const due = safeDue(unit.dueDate);
                      const canHoldScript = documentationUnitCanHoldScript(unit);
                      return (
                        <li key={unit.unitKey}>
                          <div
                            role="option"
                            aria-selected={isActive}
                            aria-disabled={selectionLocked && !isActive}
                            className={cn(
                              "flex w-full items-start gap-2 border-l-2 px-3 py-2 pl-8 text-left transition-colors hover:bg-muted/40",
                              isActive
                                ? "border-l-[var(--camp-blue)] bg-[var(--camp-blue-light)]"
                                : "border-l-transparent",
                              selectionLocked &&
                                !isActive &&
                                "cursor-not-allowed opacity-50"
                            )}
                          >
                            <button
                              type="button"
                              disabled={selectionLocked && !isActive}
                              onClick={() => onSelect(unit.unitKey)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-[var(--camp-text)]">
                                  {documentationSlotRowLabel(unit)}
                                </span>
                                {documentationStatusBadge(status)}
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {due ? `Due ${due}` : "No live date"}
                                {status === "incomplete"
                                  ? " · upload did not finish"
                                  : status === "received"
                                    ? ` · ${unit.contentAssetCount} content asset${
                                        unit.contentAssetCount === 1 ? "" : "s"
                                      }`
                                    : " · no file yet"}
                              </p>
                            </button>
                            <div
                              className="shrink-0 pt-0.5"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <DocumentationUnitScriptActions
                                hasScript={scriptPresence.has(unit.unitKey)}
                                campaignId={campaignId}
                                assignmentDeliverableId={unit.assignmentDeliverableId}
                                assignmentPostScheduleId={unit.assignmentPostScheduleId}
                                originalFileName={scriptPresence.get(unit.unitKey)?.originalFileName}
                                originalMimeType={scriptPresence.get(unit.unitKey)?.originalMimeType}
                                hasOriginalDocument={
                                  scriptPresence.get(unit.unitKey)?.hasOriginalDocument
                                }
                                disabled={selectionLocked}
                                unavailableReason={
                                  canHoldScript
                                    ? null
                                    : "This slot needs a post before a script can be attached."
                                }
                                onAdd={() => onOpenScript(unit.unitKey, "edit")}
                                onUpload={() => onOpenScript(unit.unitKey, "upload")}
                                onOpen={() => onOpenScript(unit.unitKey, "edit")}
                                onPreview={() => onOpenScript(unit.unitKey, "preview")}
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
