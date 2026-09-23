"use client";

import { campaignMoney, CampaignMoneyTotal } from "@/features/campaigns/components/campaign-money";
import { assignmentClientBilling } from "@/lib/assignments/client-billing-commercial";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CreatorNameStack } from "@/components/creator/creator-name-stack";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CollapsibleWorkspaceSection } from "@/components/workspace/collapsible-workspace-section";
import { DETAIL_FORM_INPUT_CLASS } from "@/features/campaigns/components/operational-detail-panel";
import { updateAssignmentCommercialNotesAction } from "@/features/campaigns/actions";
import { saveClientIoAssignmentsAction } from "@/features/io/actions";
import { isClientIoComposerEditable } from "@/lib/io/client-io-assignments";
import { resolveCreatorIdentity } from "@/lib/text/decode-html-entities";
import type { ClientIoStatus } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

export type ClientIoComposerAssignment = {
  id: string;
  document_number: string;
  name: string;
  influencer_name: string | null;
  revenue_before_vat: number;
  currency_code?: string;
  revenue_fx_override?: string | null;
  usage_rights_amount?: number;
  agency_fee_amount?: number;
  agency_fee_percent?: number;
  revenue_vat_percent?: number;
  revenue_vat_exempt?: boolean;
  description?: string | null;
  usage_period?: string | null;
};

type Props = {
  clientIoId: string;
  campaignHeaderId: string;
  status: ClientIoStatus;
  currencyCode: string;
  assignments: ClientIoComposerAssignment[];
  selectedAssignmentIds: string[];
};

export function ClientIoAssignmentComposer({
  clientIoId,
  campaignHeaderId,
  status,
  currencyCode,
  assignments,
  selectedAssignmentIds,
}: Props) {
  const editable = isClientIoComposerEditable(status);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectedAssignmentIds)
  );
  const [notesById, setNotesById] = useState<
    Record<string, { description: string; usagePeriod: string }>
  >(() =>
    Object.fromEntries(
      assignments.map((row) => [
        row.id,
        {
          description: row.description ?? "",
          usagePeriod: row.usage_period ?? "",
        },
      ])
    )
  );
  const [saveState, saveAction, saving] = useActionState(
    saveClientIoAssignmentsAction,
    INITIAL_STATE
  );
  const notesRef = useRef(notesById);
  const dirtyNotes = useRef(new Set<string>());
  const savingNotes = useRef(new Set<string>());
  const [noteStatus, setNoteStatus] = useState<Record<string, string>>({});
  const selectionSource = JSON.stringify(selectedAssignmentIds);

  useEffect(() => {
    setSelected(new Set(JSON.parse(selectionSource) as string[]));
  }, [selectionSource]);

  useEffect(() => {
    setNotesById(previous => {
      const next = Object.fromEntries(assignments.map(row => [row.id,
        dirtyNotes.current.has(row.id) || savingNotes.current.has(row.id)
          ? previous[row.id] ?? { description: "", usagePeriod: "" }
          : { description: row.description ?? "", usagePeriod: row.usage_period ?? "" }
      ]));
      notesRef.current = next;
      return next;
    });
  }, [assignments]);

  useEffect(() => {
    if (!saveState.message) return;
    if (saveState.ok) toast.success(saveState.message);
    else toast.error(saveState.message);
  }, [saveState]);

  const selectedPayload = useMemo(
    () => JSON.stringify([...selected]),
    [selected]
  );


  function toggle(id: string, next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  function selectAll() {
    setSelected(new Set(assignments.map((row) => row.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function changeNotes(lineId: string, patch: Partial<{ description: string; usagePeriod: string }>) {
    dirtyNotes.current.add(lineId);
    const next = { ...notesRef.current, [lineId]: { ...notesRef.current[lineId], ...patch } };
    notesRef.current = next;
    setNotesById(next);
    setNoteStatus(previous => ({ ...previous, [lineId]: "Unsaved changes" }));
  }

  async function persistNotes(lineId: string) {
    if (savingNotes.current.has(lineId) || !dirtyNotes.current.has(lineId)) return;
    savingNotes.current.add(lineId);
    setNoteStatus(previous => ({ ...previous, [lineId]: "Saving…" }));
    try {
      // Serialize saves per assignment. Other rows and fields remain editable.
      while (dirtyNotes.current.has(lineId)) {
        const draft = notesRef.current[lineId];
        const result = await updateAssignmentCommercialNotesAction({
          campaign_id: campaignHeaderId, line_id: lineId,
          description: draft.description.trim() || null,
          usage_period: draft.usagePeriod.trim() || null,
        });
        if (!result.ok) throw new Error(result.message ?? "Could not save assignment notes.");
        if (notesRef.current[lineId] === draft) dirtyNotes.current.delete(lineId);
      }
      setNoteStatus(previous => ({ ...previous, [lineId]: "Saved" }));
    } catch (error) {
      setNoteStatus(previous => ({ ...previous, [lineId]: "Not saved — retry" }));
      toast.error(error instanceof Error ? error.message : "Could not save assignment notes.");
    } finally { savingNotes.current.delete(lineId); }
  }

  if (assignments.length === 0) {
    return (
      <CollapsibleWorkspaceSection
        title="Assignments"
        summary="No campaign assignments available to compose yet"
        defaultOpen={false}
      >
        <p className="text-sm text-muted-foreground">
          {selectedAssignmentIds.length > 0
            ? `${selectedAssignmentIds.length} Assignment${selectedAssignmentIds.length === 1 ? "" : "s"} selected. Open the campaign Client IO tab to review composition.`
            : "Compose Assignments from the campaign Client IO tab (or add Assignments to the campaign first)."}
        </p>
      </CollapsibleWorkspaceSection>
    );
  }

  const selectedCount = selectedAssignmentIds.length;

  return (
    <CollapsibleWorkspaceSection
      title="Assignments"
      summary={`${selectedCount} of ${assignments.length} selected for this Client IO`}
      badge={
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {assignments.length}
        </span>
      }
      defaultOpen={false}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Select the Assignments included in this Client IO. Document commercial totals use the
          selection only. Full Description and Usage Period edit here or on Assignments — both sync
          to preview/export (and Description syncs to the linked quotation).
        </p>

        {editable ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={selectAll}>
              Select all
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
              Clear
            </Button>
          </div>
        ) : (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Selection is locked after send. Amendments (Slice 2.2.B) will create a new version.
          </p>
        )}

        <ul className="divide-y divide-border/60 rounded-md border border-border/70">
          {assignments.map((row) => {
            const checked = selected.has(row.id);
            const identity = resolveCreatorIdentity(
              row.influencer_name || row.name,
              null
            );
            const ariaLabel = identity.name || row.document_number || "Assignment";
            const notes = notesById[row.id] ?? {
              description: "",
              usagePeriod: "",
            };
            return (
              <li key={row.id} className="space-y-2 px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={checked}
                    disabled={!editable || saving}
                    onCheckedChange={(value) => toggle(row.id, value === true)}
                    className="mt-0.5"
                    aria-label={`Include ${ariaLabel}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CreatorNameStack
                        name={identity.name}
                        handle={identity.handle}
                        nameClassName="text-sm font-medium"
                      />
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {campaignMoney(assignmentClientBilling(row).totalBilling, row.currency_code || currencyCode, row.revenue_fx_override)}
                        <span className="block">Including fees and VAT</span>
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {row.document_number}
                      <span className="mx-1.5 text-border">·</span>
                      <span className="font-mono text-[10px]">{row.id.slice(0, 8)}</span>
                    </p>
                  </div>
                </div>
                <div className="ml-7 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Full Description
                    </p>
                    <Textarea
                      aria-label={`Full description for ${ariaLabel}`}
                      value={notes.description}
                      onChange={event => changeNotes(row.id, { description: event.target.value })}
                      onBlur={() => void persistNotes(row.id)}
                      rows={2}
                      disabled={!editable}
                      placeholder="Full description…"
                      className="min-h-[3rem] resize-y text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Usage Period
                    </p>
                    <Input
                      aria-label={`Usage period for ${ariaLabel}`}
                      value={notes.usagePeriod}
                      onChange={event => changeNotes(row.id, { usagePeriod: event.target.value })}
                      onBlur={() => void persistNotes(row.id)}
                      disabled={!editable}
                      placeholder="e.g. 30 days / Organic only"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
                {noteStatus[row.id] ? <p aria-live="polite" className="ml-7 text-xs text-muted-foreground">
                  {noteStatus[row.id]}
                  {noteStatus[row.id] === "Not saved — retry" ? <Button type="button" size="sm" variant="ghost" onClick={() => void persistNotes(row.id)}>Retry save</Button> : null}
                </p> : null}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {selected.size} selected · total including fees and VAT{" "}
            <span className="font-medium text-foreground">
              {<CampaignMoneyTotal currency={currencyCode} amounts={assignments.filter(row => selected.has(row.id)).map(row => ({ amount: assignmentClientBilling(row).totalBilling, currency: row.currency_code || currencyCode, override: row.revenue_fx_override }))} />}
            </span>
          </p>
          {editable ? (
            <form action={saveAction} className="inline-flex items-center gap-2">
              <input type="hidden" name="id" value={clientIoId} />
              <input type="hidden" name="campaign_header_id" value={campaignHeaderId} />
              <input type="hidden" name="selected_assignment_ids" value={selectedPayload} />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className={DETAIL_FORM_INPUT_CLASS}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save selection"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </CollapsibleWorkspaceSection>
  );
}
