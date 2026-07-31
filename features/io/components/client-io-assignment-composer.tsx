"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailFormSection,
} from "@/features/campaigns/components/operational-detail-panel";
import { saveClientIoAssignmentsAction } from "@/features/io/actions";
import { formatMoney } from "@/lib/campaigns/utils";
import { isClientIoComposerEditable } from "@/lib/io/client-io-assignments";
import type { ClientIoStatus } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

export type ClientIoComposerAssignment = {
  id: string;
  document_number: string;
  name: string;
  influencer_name: string | null;
  revenue_before_vat: number;
  currency_code?: string;
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
  const [saveState, saveAction, saving] = useActionState(
    saveClientIoAssignmentsAction,
    INITIAL_STATE
  );

  useEffect(() => {
    setSelected(new Set(selectedAssignmentIds));
  }, [selectedAssignmentIds]);

  useEffect(() => {
    if (!saveState.message) return;
    if (saveState.ok) toast.success(saveState.message);
    else toast.error(saveState.message);
  }, [saveState]);

  const selectedPayload = useMemo(
    () => JSON.stringify([...selected]),
    [selected]
  );

  const selectedRevenue = useMemo(() => {
    return assignments
      .filter((row) => selected.has(row.id))
      .reduce((sum, row) => sum + Number(row.revenue_before_vat ?? 0), 0);
  }, [assignments, selected]);

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

  if (assignments.length === 0) {
    return (
      <DetailFormSection label="Assignments" className="py-3.5">
        <p className="text-sm text-muted-foreground">
          {selectedAssignmentIds.length > 0
            ? `${selectedAssignmentIds.length} Assignment${selectedAssignmentIds.length === 1 ? "" : "s"} selected. Open the campaign Client IO tab to review composition.`
            : "Compose Assignments from the campaign Client IO tab (or add Assignments to the campaign first)."}
        </p>
      </DetailFormSection>
    );
  }

  return (
    <DetailFormSection label="Assignments" className="py-3.5">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Select the Assignments included in this Client IO. Document commercial totals use the
          selection only. Issued documents freeze an Assignment snapshot so later schedule edits
          do not change history.
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
            const label =
              row.influencer_name?.trim() ||
              row.name?.trim() ||
              row.document_number ||
              "Assignment";
            return (
              <li key={row.id} className="flex items-start gap-3 px-3 py-2.5">
                <Checkbox
                  checked={checked}
                  disabled={!editable || saving}
                  onCheckedChange={(value) => toggle(row.id, value === true)}
                  className="mt-0.5"
                  aria-label={`Include ${label}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatMoney(Number(row.revenue_before_vat ?? 0), currencyCode)}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {row.document_number}
                    <span className="mx-1.5 text-border">·</span>
                    <span className="font-mono text-[10px]">{row.id.slice(0, 8)}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {selected.size} selected · rollup{" "}
            <span className="font-medium text-foreground">
              {formatMoney(selectedRevenue, currencyCode)}
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
    </DetailFormSection>
  );
}
