"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import { ClientIoTermsEditor } from "@/features/io/components/client-io-terms-editor";
import { CLIENT_IO_DEFAULT_TERMS } from "@/lib/io/client-io-default-terms";
import {
  parseTermsText,
  serializeTermsText,
  termsAreEqual,
  type ClientIoTerm,
} from "@/lib/io/client-io-terms";
import {
  CLIENT_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  INDUSTRY_OPTIONS,
  getCityOptionsForCountry,
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
  const [city, setCity] = useState(client.city ?? "");
  const [industry, setIndustry] = useState(client.industry ?? "");
  const cityOptions = useMemo(() => {
    const options = getCityOptionsForCountry(country);
    if (city && !options.some((option) => option.value === city)) {
      return [{ value: city, label: city }, ...options];
    }
    return options;
  }, [country, city]);

  const industryOptions = useMemo(() => {
    if (industry && !INDUSTRY_OPTIONS.some((option) => option.value === industry)) {
      return [{ value: industry, label: industry }, ...INDUSTRY_OPTIONS];
    }
    return INDUSTRY_OPTIONS;
  }, [industry]);
  const [ioTerms, setIoTerms] = useState<ClientIoTerm[]>(
    () => parseTermsText(client.client_io_terms_text) ?? CLIENT_IO_DEFAULT_TERMS
  );
  const [usePlatformIoTerms, setUsePlatformIoTerms] = useState(
    () => !parseTermsText(client.client_io_terms_text)
  );

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

  const clientIoTermsPayload =
    usePlatformIoTerms || termsAreEqual(ioTerms, CLIENT_IO_DEFAULT_TERMS)
      ? ""
      : serializeTermsText(ioTerms);

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
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="industry" value={industry} />
        <input type="hidden" name="client_io_terms_text" value={clientIoTermsPayload} />

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
            <Label>Industry</Label>
            <Select
              value={industry || undefined}
              onValueChange={setIndustry}
              disabled={isPending}
            >
              <SelectTrigger className={cn(DETAIL_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {industryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError messages={state.fieldErrors?.industry} />
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
              onValueChange={(value) => {
                setCountry(value);
                setCity("");
              }}
              options={COUNTRY_OPTIONS}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label>City</Label>
            <SearchableSelect
              value={city}
              onValueChange={setCity}
              options={cityOptions}
              disabled={isPending || !country}
              placeholder={country ? "Select city" : "Select country first"}
            />
            <FieldError messages={state.fieldErrors?.city} />
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

        <div className="grid gap-2 rounded-xl border border-border/60 bg-muted/10 p-4">
          <Label>Default Client IO terms</Label>
          <p className="text-xs text-muted-foreground">
            When set, these terms become the default for all Client IOs on this legal entity.
          </p>
          <ClientIoTermsEditor
            terms={ioTerms}
            onChange={(next) => {
              setIoTerms(next);
              setUsePlatformIoTerms(false);
            }}
            onRecover={() => {
              setIoTerms(CLIENT_IO_DEFAULT_TERMS);
              setUsePlatformIoTerms(true);
            }}
            disabled={isPending}
          />
        </div>
      </form>
    </OperationalFormSection>
  );
}
