"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { ClientCategoryFields } from "@/components/forms/client-category-fields";
import { useClientCategoryClassification, CLIENT_CATEGORY_PAUSE_MESSAGE } from "@/components/forms/use-client-category-classification";
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
  getCityOptionsForCountry,
} from "@/features/clients/constants";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { ClientDetail, ClientStatus } from "@/types/database";
import { cn } from "@/lib/utils";

const DETAIL_TEXTAREA_CLASS =
  "min-h-[4.5rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1";

type ClientOverviewTabProps = {
  client: ClientDetail;
  groups: { id: string; name: string; document_number: string }[];
  masterData: MasterDataOptions;
};

export function ClientOverviewTab({ client, groups, masterData }: ClientOverviewTabProps) {
  const [status, setStatus] = useState(client.status);
  const [groupId, setGroupId] = useState(client.group_id ?? "");
  const [displayName, setDisplayName] = useState(client.name);
  const [country, setCountry] = useState(client.country ?? "");
  const [city, setCity] = useState(client.city ?? "");
  const [categorySlug, setCategorySlug] = useState(client.client_category ?? "");
  const [subcategorySlug, setSubcategorySlug] = useState(
    client.client_subcategory ?? ""
  );
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);
  const [vrRateId, setVrRateId] = useState(client.vr_rate_id ?? "");
  const cityOptions = useMemo(() => {
    const options = getCityOptionsForCountry(country);
    if (city && !options.some((option) => option.value === city)) {
      return [{ value: city, label: city }, ...options];
    }
    return options;
  }, [country, city]);

  const { classifying, classifyingLabel, message: classifyMessage, resetClassificationRequest } =
    useClientCategoryClassification({
      companyName: displayName,
      country,
      website: client.website ?? undefined,
      enabled: !categoryManuallySet,
      onClassified: ({ categorySlug: nextCategory, subcategorySlug: nextSubcategory }) => {
        setCategorySlug(nextCategory);
        setSubcategorySlug(nextSubcategory);
      },
    });

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

    const fieldMessages = state.fieldErrors
      ? Object.values(state.fieldErrors).flat().filter(Boolean)
      : [];
    toast.error(fieldMessages.length > 0 ? fieldMessages[0] : state.message);
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
      description="Intelligence category/subcategory and default VR% for reporting. Brand VR% overrides inherit from here."
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
        <input type="hidden" name="client_category" value={categorySlug} />
        <input type="hidden" name="client_subcategory" value={subcategorySlug} />
        <input type="hidden" name="vr_rate_id" value={vrRateId} />
        <input
          type="hidden"
          name="agency_or_direct"
          value={client.agency_or_direct ?? "agency"}
        />
        <input type="hidden" name="client_io_terms_text" value={clientIoTermsPayload} />

        {state.fieldErrors && !state.ok ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {Object.entries(state.fieldErrors)
              .flatMap(([field, messages]) =>
                (messages ?? []).map((message) => `${field}: ${message}`)
              )
              .join(" · ")}
          </p>
        ) : null}

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
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setCategoryManuallySet(false);
                resetClassificationRequest();
              }}
              required
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.name} />
            {categoryManuallySet ? (
              <p className="text-xs text-muted-foreground">
                {CLIENT_CATEGORY_PAUSE_MESSAGE}
              </p>
            ) : classifyingLabel ? (
              <p className="text-xs text-muted-foreground">{classifyingLabel}</p>
            ) : classifyMessage ? (
              <p className="text-xs text-muted-foreground">{classifyMessage}</p>
            ) : null}
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
            <FieldError messages={state.fieldErrors?.legal_name} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name_ar">Client name (Arabic)</Label>
          <Input
            id="name_ar"
            name="name_ar"
            className={DETAIL_FORM_INPUT_CLASS}
            defaultValue={client.name_ar ?? ""}
            disabled={isPending}
            placeholder="Optional Arabic legal name"
            dir="rtl"
          />
          <FieldError messages={state.fieldErrors?.name_ar} />
        </div>

        <ClientCategoryFields
          categorySlug={categorySlug}
          subcategorySlug={subcategorySlug}
          onCategoryChange={(value) => {
            setCategoryManuallySet(true);
            setCategorySlug(value);
          }}
          onSubcategoryChange={(value) => {
            setCategoryManuallySet(true);
            setSubcategorySlug(value);
          }}
          disabled={isPending}
        />
        <FieldError messages={state.fieldErrors?.client_category} />
        <FieldError messages={state.fieldErrors?.client_subcategory} />

        <div className="grid gap-2 sm:max-w-md">
          <Label>Default VR%</Label>
          <SearchableSelect
            value={vrRateId}
            onValueChange={setVrRateId}
            options={masterData.vrRates.map((rate) => ({
              value: rate.id,
              label: rate.name,
            }))}
            disabled={isPending}
            placeholder="Select default VR rate"
          />
          <p className="text-xs text-muted-foreground">
            Brands inherit this rate unless they set an explicit VR% override.
          </p>
          <FieldError messages={state.fieldErrors?.vr_rate_id} />
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
          <FieldError messages={state.fieldErrors?.website} />
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
