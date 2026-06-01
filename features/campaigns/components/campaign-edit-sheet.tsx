"use client";

import { useActionState, useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  updateCampaignHeaderAction,
  type FormActionState,
} from "@/features/campaigns/actions";
import {
  CAMPAIGN_STATUS_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/features/campaigns/constants";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit campaign</SheetTitle>
          <SheetDescription>
            Update operational details for {workspace.document_number}.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 px-6 pb-6">
          <input type="hidden" name="campaign_id" value={workspace.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="platform" value={platform} />
          <input type="hidden" name="currency_code" value={currency} />
          <input type="hidden" name="account_manager_id" value={accountManagerId} />
          <input type="hidden" name="team_id" value={teamId} />

          <div className="grid gap-2">
            <Label htmlFor="campaign_name">Campaign name</Label>
            <Input
              id="campaign_name"
              name="name"
              defaultValue={workspace.name}
              required
              disabled={isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CampaignStatus)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
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
            </div>
            <div className="grid gap-2">
              <Label>Platform</Label>
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
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                <SelectTrigger className="w-full">
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={workspace.start_date ?? ""}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={workspace.end_date ?? ""}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Account manager</Label>
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
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Team</Label>
            <SearchableSelect
              value={teamId}
              onValueChange={setTeamId}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Select team"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={workspace.description ?? ""}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="brief">Brief</Label>
            <Textarea
              id="brief"
              name="brief"
              rows={3}
              defaultValue={workspace.brief ?? ""}
              disabled={isPending}
            />
          </div>

          <FieldError messages={state.fieldErrors?.end_date} />

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save campaign"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
