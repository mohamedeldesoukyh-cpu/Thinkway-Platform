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
import { Textarea } from "@/components/ui/textarea";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import {
  updateClientOverviewAction,
  type FormActionState,
} from "@/features/clients/actions";
import {
  CLIENT_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
} from "@/features/clients/constants";
import type { ClientDetail, ClientStatus } from "@/types/database";
import { cn } from "@/lib/utils";

const DETAIL_TEXTAREA_CLASS =
  "min-h-[4.5rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1";

type ClientOverviewTabProps = {
  client: ClientDetail;
  groups: { id: string; name: string; document_number: string }[];
};

export function ClientOverviewTab({ client, groups }: ClientOverviewTabProps) {
  const [status, setStatus] = useState(client.status);
  const [groupId, setGroupId] = useState(client.group_id ?? "");
  const [country, setCountry] = useState(client.country ?? "");

  const [state, formAction, isPending] = useActionState(
    updateClientOverviewAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  const groupOptions = groups.map((g) => ({
    value: g.id,
    label: g.name,
  }));

  return (
    <OperationalFormSection
      title="Legal entity overview"
      description="Commercial category, VR%, and agency/direct settings live on brands."
      footer={
        <Button type="submit" form="client-overview-form" disabled={isPending}>
          {isPending ? "Saving…" : "Save overview"}
        </Button>
      }
    >
      <form id="client-overview-form" action={formAction} className="grid gap-4">
        <input type="hidden" name="client_id" value={client.id} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="group_id" value={groupId} />
        <input type="hidden" name="country" value={country} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Group</Label>
            <SearchableSelect
              value={groupId}
              onValueChange={setGroupId}
              options={groupOptions}
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.group_id} />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ClientStatus)}
              disabled={isPending}
            >
              <SelectTrigger className={cn(DETAIL_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              name="name"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={client.name}
              required
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="legal_name">Legal name</Label>
            <Input
              id="legal_name"
              name="legal_name"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={client.legal_name ?? ""}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              name="industry"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={client.industry ?? ""}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="url"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={client.website ?? ""}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Country</Label>
            <SearchableSelect
              value={country}
              onValueChange={setCountry}
              options={COUNTRY_OPTIONS}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              name="city"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={client.city ?? ""}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="billing_email">Billing email</Label>
            <Input
              id="billing_email"
              name="billing_email"
              type="email"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={client.billing_email ?? ""}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="billing_phone">Billing phone</Label>
            <Input
              id="billing_phone"
              name="billing_phone"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={client.billing_phone ?? ""}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            className={DETAIL_TEXTAREA_CLASS}
            defaultValue={client.notes ?? ""}
            disabled={isPending}
          />
        </div>
      </form>
    </OperationalFormSection>
  );
}
