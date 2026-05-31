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
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_CATEGORY_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  getClientSubcategoryOptions,
} from "@/features/clients/constants";
import type { ClientDetail, ClientStatus } from "@/types/database";

type ClientOverviewTabProps = {
  client: ClientDetail;
};

export function ClientOverviewTab({ client }: ClientOverviewTabProps) {
  const [status, setStatus] = useState(client.status);
  const [category, setCategory] = useState(client.client_category ?? "");
  const [subcategory, setSubcategory] = useState(client.client_subcategory ?? "");
  const [agencyOrDirect, setAgencyOrDirect] = useState(
    client.agency_or_direct ?? ""
  );
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

  const subcategoryOptions = getClientSubcategoryOptions(category);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="client_category" value={category} />
          <input type="hidden" name="client_subcategory" value={subcategory} />
          <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
          <input type="hidden" name="country" value={country} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Client name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={client.name}
                required
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.name} />
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
              <FieldError messages={state.fieldErrors?.website} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  setSubcategory("");
                }}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Subcategory</Label>
              <Select
                value={subcategory}
                onValueChange={setSubcategory}
                disabled={isPending || !category}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {subcategoryOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label>Agency or direct</Label>
              <Select
                value={agencyOrDirect}
                onValueChange={setAgencyOrDirect}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_OR_DIRECT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <FieldError messages={state.fieldErrors?.billing_email} />
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
