"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  updateCampaignHeaderAction,
  type FormActionState,
} from "@/features/campaigns/actions";
import {
  CAMPAIGN_STATUS_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/features/campaigns/constants";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
  DetailFormScrollBody,
  DetailFormSection,
  DetailSheetFooter,
  OperationalDetailSheet,
  OperationalEditPanelHeader,
} from "@/features/campaigns/components/operational-detail-panel";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { CampaignStatus } from "@/types/database";

type CampaignEditSheetProps = {
  workspace: CampaignWorkspace;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  currencyOptions: { value: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CampaignEditSheet({
  workspace,
  accountManagers,
  teams,
  currencyOptions,
  open,
  onOpenChange,
}: CampaignEditSheetProps) {
  const [status, setStatus] = useState<CampaignStatus>(workspace.status);
  const [platform, setPlatform] = useState(workspace.platform ?? "");
  const [currency, setCurrency] = useState(workspace.currency_code);
  const [accountManagerId, setAccountManagerId] = useState(
    workspace.account_manager?.id ?? ""
  );
  const [teamId, setTeamId] = useState(workspace.team?.id ?? "");

  const [state, formAction, isPending] = useActionState(
    updateCampaignHeaderAction,
    { ok: false } satisfies FormActionState
  );

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
    setStatus(workspace.status);
    setPlatform(workspace.platform ?? "");
    setCurrency(workspace.currency_code);
    setAccountManagerId(workspace.account_manager?.id ?? "");
    setTeamId(workspace.team?.id ?? "");
  }, [open, workspace]);

  const campaignLabel = formatDocumentNumberForDisplay(workspace.document_number);

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit campaign"
      description={`Update operational details for ${campaignLabel}`}
    >
      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <OperationalEditPanelHeader
          title="Edit campaign"
          description={`Update operational details for ${campaignLabel}.`}
        />

        <DetailFormScrollBody>
          <input type="hidden" name="campaign_id" value={workspace.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="platform" value={platform} />
          <input type="hidden" name="currency_code" value={currency} />
          <input type="hidden" name="account_manager_id" value={accountManagerId} />
          <input type="hidden" name="team_id" value={teamId} />

          <DetailFormSection label="Campaign name">
            <Input
              id="campaign_name"
              name="name"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={workspace.name}
              required
              disabled={isPending}
            />
          </DetailFormSection>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailFormSection label="Status">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CampaignStatus)}
                disabled={isPending}
              >
                <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DetailFormSection>
            <DetailFormSection label="Platform">
              <SearchableSelect
                value={platform}
                onValueChange={setPlatform}
                options={PLATFORM_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                placeholder="Select platform"
                disabled={isPending}
              />
            </DetailFormSection>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailFormSection label="Currency">
              <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DetailFormSection>
            <DetailFormSection label="Start date">
              <Input
                id="start_date"
                name="start_date"
                type="date"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={workspace.start_date ?? ""}
                disabled={isPending}
              />
            </DetailFormSection>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailFormSection label="End date">
              <Input
                id="end_date"
                name="end_date"
                type="date"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={workspace.end_date ?? ""}
                disabled={isPending}
              />
            </DetailFormSection>
            <DetailFormSection label="Account manager">
              <SearchableSelect
                value={accountManagerId}
                onValueChange={setAccountManagerId}
                options={accountManagers.map((m) => ({
                  value: m.id,
                  label: m.full_name?.trim() || m.email,
                }))}
                placeholder="Assign manager"
                disabled={isPending}
              />
            </DetailFormSection>
          </div>

          <DetailFormSection label="Team">
            <SearchableSelect
              value={teamId}
              onValueChange={setTeamId}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Select team"
              disabled={isPending}
            />
          </DetailFormSection>

          <DetailFormSection label="Client BO number">
            <Input
              id="client_bo_number"
              name="client_bo_number"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={workspace.client_bo_number ?? ""}
              placeholder="Optional client booking order reference"
              disabled={isPending}
            />
          </DetailFormSection>

          <DetailFormSection label="Description">
            <Textarea
              id="description"
              name="description"
              rows={2}
              className="min-h-[4rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1"
              defaultValue={workspace.description ?? ""}
              disabled={isPending}
            />
          </DetailFormSection>

          <DetailFormSection label="Brief">
            <Textarea
              id="brief"
              name="brief"
              rows={3}
              className="min-h-[5rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1"
              defaultValue={workspace.brief ?? ""}
              disabled={isPending}
            />
          </DetailFormSection>

          <FieldError messages={state.fieldErrors?.end_date} />
        </DetailFormScrollBody>

        <DetailSheetFooter>
          <Button size="sm" type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save campaign"}
          </Button>
        </DetailSheetFooter>
      </form>
    </OperationalDetailSheet>
  );
}
