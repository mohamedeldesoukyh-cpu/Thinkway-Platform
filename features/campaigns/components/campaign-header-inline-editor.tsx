"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UnsavedChangesBar } from "@/components/forms/unsaved-changes-bar";
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
import { updateCampaignHeaderAction } from "@/features/campaigns/actions";
import { CAMPAIGN_STATUS_OPTIONS } from "@/features/campaigns/constants";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";
import type { CampaignStatus } from "@/types/database";

type Draft = {
  name: string;
  status: CampaignStatus;
  start_date: string;
  end_date: string;
  target_market: string;
  description: string;
  brief: string;
  account_manager_id: string;
  platform: string;
  currency_code: string;
  team_id: string;
  group_id: string;
};

function draftFromWorkspace(workspace: CampaignWorkspace): Draft {
  return {
    name: workspace.name ?? "",
    status: workspace.status,
    start_date: workspace.start_date ?? "",
    end_date: workspace.end_date ?? "",
    target_market: workspace.target_market ?? "",
    description: workspace.description ?? "",
    brief: workspace.brief ?? "",
    account_manager_id: workspace.account_manager?.id ?? "",
    platform: workspace.platform ?? "",
    currency_code: workspace.currency_code,
    team_id: workspace.team?.id ?? "",
    group_id: workspace.group?.id ?? "",
  };
}

type CampaignHeaderInlineEditorProps = {
  workspace: CampaignWorkspace;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
};

/**
 * V1 inline edit — Campaign header & general information only (D4).
 * Client/Brand are display-only (hierarchy synced from brand).
 */
export function CampaignHeaderInlineEditor({
  workspace,
  accountManagers,
  editing,
  onEditingChange,
}: CampaignHeaderInlineEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftFromWorkspace(workspace));
  const [baseline, setBaseline] = useState(() => draftFromWorkspace(workspace));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const next = draftFromWorkspace(workspace);
    setBaseline(next);
    if (!editing) setDraft(next);
  }, [workspace, editing]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [baseline, draft]
  );

  const reset = useCallback(() => {
    setDraft(baseline);
  }, [baseline]);

  const cancel = useCallback(() => {
    setDraft(baseline);
    onEditingChange(false);
  }, [baseline, onEditingChange]);

  const save = useCallback(() => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("campaign_id", workspace.id);
      formData.set("name", draft.name);
      formData.set("status", draft.status);
      formData.set("start_date", draft.start_date);
      formData.set("end_date", draft.end_date);
      formData.set("target_market", draft.target_market);
      formData.set("description", draft.description);
      formData.set("brief", draft.brief);
      formData.set("account_manager_id", draft.account_manager_id);
      formData.set("platform", draft.platform);
      formData.set("currency_code", draft.currency_code);
      formData.set("team_id", draft.team_id);
      formData.set("group_id", draft.group_id);

      const result = await updateCampaignHeaderAction({ ok: false }, formData);
      if (!result.ok) {
        toast.error(result.message ?? "Could not save campaign.");
        return;
      }
      toast.success(result.message ?? "Campaign updated.");
      setBaseline(draft);
      onEditingChange(false);
      router.refresh();
    });
  }, [draft, onEditingChange, router, workspace.id]);

  if (!editing) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-background p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="inline-campaign-name">Campaign name</Label>
          <Input
            id="inline-campaign-name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Legal entity</Label>
          <Input value={workspace.client?.name ?? "—"} disabled readOnly />
        </div>
        <div className="space-y-1.5">
          <Label>Brand</Label>
          <Input value={workspace.brand?.name ?? "—"} disabled readOnly />
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={draft.status}
            onValueChange={(value) =>
              setDraft((d) => ({ ...d, status: value as CampaignStatus }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Campaign owner</Label>
          <Select
            value={draft.account_manager_id || "__none__"}
            onValueChange={(value) =>
              setDraft((d) => ({
                ...d,
                account_manager_id: value === "__none__" ? "" : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {accountManagers.map((am) => (
                <SelectItem key={am.id} value={am.id}>
                  {am.full_name?.trim() || am.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inline-start">Start date</Label>
          <Input
            id="inline-start"
            type="date"
            value={draft.start_date}
            onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inline-end">End date</Label>
          <Input
            id="inline-end"
            type="date"
            value={draft.end_date}
            onChange={(e) => setDraft((d) => ({ ...d, end_date: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label>Target market</Label>
          <Select
            value={draft.target_market || "__inherit__"}
            onValueChange={(value) =>
              setDraft((d) => ({
                ...d,
                target_market: value === "__inherit__" ? "" : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select target market" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__inherit__">
                Use legal entity country (default)
              </SelectItem>
              {COUNTRY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Used on Client IO as Target Market. Independent of legal entity country
            (e.g. client Egypt, market UAE).
          </p>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="inline-objectives">Objectives / notes</Label>
          <Textarea
            id="inline-objectives"
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="inline-brief">Brief</Label>
          <Textarea
            id="inline-brief"
            rows={4}
            value={draft.brief}
            onChange={(e) => setDraft((d) => ({ ...d, brief: e.target.value }))}
          />
        </div>
      </div>

      <UnsavedChangesBar
        isDirty={isDirty}
        isSaving={pending}
        onSave={save}
        onCancel={cancel}
        onReset={reset}
      />
    </div>
  );
}
