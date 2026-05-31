"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  updateClientOverviewAction,
  type FormActionState,
} from "@/features/clients/actions";
import {
  CLIENT_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
} from "@/features/clients/constants";
import type { ClientDetail, ClientStatus } from "@/types/database";

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
    <Card>
      <CardHeader>
        <CardTitle>Legal entity overview</CardTitle>
        <p className="text-sm text-muted-foreground">
          Commercial category, VR%, and agency/direct settings live on brands.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
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
                <SelectTrigger className="w-full">
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
                defaultValue={client.billing_email ?? ""}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="billing_phone">Billing phone</Label>
              <Input
                id="billing_phone"
                name="billing_phone"
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
              defaultValue={client.notes ?? ""}
              disabled={isPending}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save overview"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
