"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  assignCampaignVendorAction,
  searchInfluencersAction,
  updateCampaignVendorAction,
  type FormActionState,
} from "@/features/campaigns/actions";
import {
  CAMPAIGN_VENDOR_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/features/campaigns/constants";
import type {
  CampaignLineWorkspace,
  CampaignVendorAssignment,
  InfluencerSearchResult,
} from "@/features/campaigns/types";

type CampaignVendorSheetProps = {
  campaignId: string;
  lines: CampaignLineWorkspace[];
  assignment: CampaignVendorAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CampaignVendorSheet({
  campaignId,
  lines,
  assignment,
  open,
  onOpenChange,
}: CampaignVendorSheetProps) {
  const isEdit = assignment !== null;
  const [lineId, setLineId] = useState(assignment?.campaign_line_id ?? "");
  const [status, setStatus] = useState(assignment?.status ?? "invited");
  const [currency, setCurrency] = useState(assignment?.currency ?? "USD");
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [results, setResults] = useState<InfluencerSearchResult[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState(
    assignment?.influencer_id ?? ""
  );
  const [isSearching, startSearch] = useTransition();

  const [createState, createAction, createPending] = useActionState(
    assignCampaignVendorAction,
    { ok: false }
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateCampaignVendorAction,
    { ok: false } satisfies FormActionState
  );

  const state = isEdit ? updateState : createState;
  const formAction = isEdit ? updateAction : createAction;
  const isPending = isEdit ? updatePending : createPending;

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setLineId(assignment?.campaign_line_id ?? lines[0]?.id ?? "");
    setStatus(assignment?.status ?? "invited");
    setCurrency(assignment?.currency ?? "USD");
    setSelectedInfluencerId(assignment?.influencer_id ?? "");
    setSearch("");
    setResults([]);
  }, [open, assignment, lines]);

  function runSearch() {
    startSearch(async () => {
      const fd = new FormData();
      fd.set("search", search);
      fd.set("platform", platformFilter);
      const result = await searchInfluencersAction({ results: [] }, fd);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setResults(result.results);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit vendor assignment" : "Assign vendor"}
          </SheetTitle>
          <SheetDescription>
            Link influencers to campaign lines with pricing and status.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 px-6 pb-6">
          <input type="hidden" name="campaign_id" value={campaignId} />
          {isEdit ? (
            <input type="hidden" name="assignment_id" value={assignment.id} />
          ) : null}
          <input type="hidden" name="campaign_line_id" value={lineId} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="currency" value={currency} />
          {!isEdit ? (
            <input type="hidden" name="influencer_id" value={selectedInfluencerId} />
          ) : null}

          {!isEdit ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="grid gap-2">
                <Label htmlFor="vendor_search">Search influencers</Label>
                <div className="flex gap-2">
                  <Input
                    id="vendor_search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name or vendor #…"
                    disabled={isPending}
                  />
                  <Button type="button" variant="outline" onClick={runSearch} disabled={isSearching}>
                    Search
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Platform filter</Label>
                <SearchableSelect
                  value={platformFilter}
                  onValueChange={setPlatformFilter}
                  options={[
                    { value: "", label: "All platforms" },
                    ...PLATFORM_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    })),
                  ]}
                  disabled={isPending}
                />
              </div>
              {results.length > 0 ? (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        selectedInfluencerId === r.id
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                      onClick={() => setSelectedInfluencerId(r.id)}
                    >
                      <span className="font-medium">{r.display_name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {r.document_number}
                      </span>
                      {r.platforms.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {r.platforms
                            .map((p) => `${p.platform}: @${p.handle}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
              <FieldError messages={state.fieldErrors?.influencer_id} />
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>Campaign line</Label>
            <Select value={lineId} onValueChange={setLineId} disabled={isPending}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select line" />
              </SelectTrigger>
              <SelectContent>
                {lines.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.document_number} — {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="agreed_fee">Agreed fee</Label>
              <Input
                id="agreed_fee"
                name="agreed_fee"
                type="number"
                min={0}
                step="0.01"
                defaultValue={assignment?.agreed_fee ?? 0}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deliverable_count">Deliverables</Label>
              <Input
                id="deliverable_count"
                name="deliverable_count"
                type="number"
                min={0}
                defaultValue={assignment?.deliverable_count ?? 0}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_VENDOR_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={isPending || (!isEdit && !selectedInfluencerId)}
            >
              {isPending ? "Saving…" : isEdit ? "Save assignment" : "Assign vendor"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
