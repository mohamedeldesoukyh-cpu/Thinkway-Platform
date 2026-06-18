"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  Building2Icon,
  DollarSignIcon,
  FileTextIcon,
  MapPinIcon,
} from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { ClientCategoryFields } from "@/components/forms/client-category-fields";
import {
  ClientCategorySuggestion,
  type ClientCategorySuggestionState,
} from "@/components/forms/client-category-suggestion";
import {
  useClientCategoryClassification,
  CLIENT_CATEGORY_PAUSE_MESSAGE,
} from "@/components/forms/use-client-category-classification";
import { SearchableSelect } from "@/components/forms/searchable-select";
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
  ClientFormField,
  ClientFormGrid,
  ClientFormPageHeader,
  ClientFormSaveBar,
  ClientFormSection,
  ClientFormUnsavedStatus,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_MAX_WIDTH,
  CLIENT_FORM_PRIMARY_BUTTON_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS,
} from "@/features/clients/components/client-form-ui";
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
  const [classificationMeta, setClassificationMeta] =
    useState<ClientCategorySuggestionState | null>(() => {
      if (
        client.client_category &&
        client.client_subcategory &&
        client.approved_by_user
      ) {
        return {
          categorySlug: client.client_category,
          subcategorySlug: client.client_subcategory,
          confidence: client.classification_confidence ?? 100,
          source:
            (client.classification_source as ClientCategorySuggestionState["source"]) ??
            "approved",
          reason: client.classification_reason ?? undefined,
        };
      }
      return null;
    });
  const [vrRateId, setVrRateId] = useState(client.vr_rate_id ?? "");
  const cityOptions = useMemo(() => {
    const options = getCityOptionsForCountry(country);
    if (city && !options.some((option) => option.value === city)) {
      return [{ value: city, label: city }, ...options];
    }
    return options;
  }, [country, city]);

  const {
    classifyingLabel,
    message: classifyMessage,
    suggestion,
    suggestionApplied,
    acceptSuggestion,
    overrideSuggestion,
    resetClassificationRequest,
  } = useClientCategoryClassification({
    companyName: displayName,
    country,
    website: client.website ?? undefined,
    clientId: client.id,
    useStoredApproved:
      !categoryManuallySet &&
      Boolean(client.approved_by_user && client.client_category),
    enabled: !categoryManuallySet,
    onClassified: (result) => {
      setCategorySlug(result.categorySlug);
      setSubcategorySlug(result.subcategorySlug);
      setClassificationMeta(result);
    },
  });

  const [ioTerms, setIoTerms] = useState<ClientIoTerm[]>(
    () => parseTermsText(client.client_io_terms_text) ?? CLIENT_IO_DEFAULT_TERMS
  );
  const [usePlatformIoTerms, setUsePlatformIoTerms] = useState(
    () => !parseTermsText(client.client_io_terms_text)
  );
  const [formKey, setFormKey] = useState(0);

  function buildClassificationMetaFromClient(): ClientCategorySuggestionState | null {
    if (
      client.client_category &&
      client.client_subcategory &&
      client.approved_by_user
    ) {
      return {
        categorySlug: client.client_category,
        subcategorySlug: client.client_subcategory,
        confidence: client.classification_confidence ?? 100,
        source:
          (client.classification_source as ClientCategorySuggestionState["source"]) ??
          "approved",
        reason: client.classification_reason ?? undefined,
      };
    }
    return null;
  }

  function discardChanges() {
    setStatus(client.status);
    setGroupId(client.group_id ?? "");
    setDisplayName(client.name);
    setCountry(client.country ?? "");
    setCity(client.city ?? "");
    setCategorySlug(client.client_category ?? "");
    setSubcategorySlug(client.client_subcategory ?? "");
    setCategoryManuallySet(false);
    setClassificationMeta(buildClassificationMetaFromClient());
    setVrRateId(client.vr_rate_id ?? "");
    setIoTerms(
      parseTermsText(client.client_io_terms_text) ?? CLIENT_IO_DEFAULT_TERMS
    );
    setUsePlatformIoTerms(!parseTermsText(client.client_io_terms_text));
    resetClassificationRequest();
    setFormKey((key) => key + 1);
  }

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

  const classificationStatusHint = categoryManuallySet ? (
    <p className="text-xs text-muted-foreground">{CLIENT_CATEGORY_PAUSE_MESSAGE}</p>
  ) : classifyingLabel ? (
    <p className="text-xs text-muted-foreground">{classifyingLabel}</p>
  ) : classifyMessage ? (
    <p className="text-xs text-muted-foreground">{classifyMessage}</p>
  ) : null;

  return (
    <div className={cn("mx-auto w-full pb-[120px]", CLIENT_FORM_MAX_WIDTH)}>
      <ClientFormPageHeader
        title="Edit legal entity"
        description="Update the client's profile, billing, and default insertion-order terms."
      />

      <form
        key={formKey}
        id="client-overview-form"
        action={formAction}
        className="grid gap-[18px]"
      >
        <input type="hidden" name="client_id" value={client.id} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="group_id" value={groupId} />
        <input type="hidden" name="country" value={country} />
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="client_category" value={categorySlug} />
        <input type="hidden" name="client_subcategory" value={subcategorySlug} />
        <input
          type="hidden"
          name="classification_source"
          value={classificationMeta?.source ?? ""}
        />
        <input
          type="hidden"
          name="classification_confidence"
          value={classificationMeta?.confidence ?? ""}
        />
        <input
          type="hidden"
          name="classification_reason"
          value={classificationMeta?.reason ?? ""}
        />
        <input
          type="hidden"
          name="suggestion_accepted"
          value={String(
            !categoryManuallySet && Boolean(classificationMeta) ? true : false
          )}
        />
        <input
          type="hidden"
          name="category_manually_set"
          value={String(categoryManuallySet)}
        />
        <input type="hidden" name="vr_rate_id" value={vrRateId} />
        <input
          type="hidden"
          name="agency_or_direct"
          value={client.agency_or_direct ?? "agency"}
        />
        <input type="hidden" name="client_io_terms_text" value={clientIoTermsPayload} />

        {state.fieldErrors && !state.ok ? (
          <p className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {Object.entries(state.fieldErrors)
              .flatMap(([field, messages]) =>
                (messages ?? []).map((message) => `${field}: ${message}`)
              )
              .join(" · ")}
          </p>
        ) : null}

        <ClientFormSection
          icon={Building2Icon}
          title="Identity"
          description="Legal name and classification"
        >
          <ClientFormGrid>
            <ClientFormField label="Group">
              <SearchableSelect
                value={groupId}
                onValueChange={setGroupId}
                options={groupOptions}
                disabled={isPending}
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
              <FieldError messages={state.fieldErrors?.group_id} />
            </ClientFormField>
            <ClientFormField label="Status">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ClientStatus)}
                disabled={isPending}
              >
                <SelectTrigger className={cn(CLIENT_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
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
            </ClientFormField>
          </ClientFormGrid>

          <ClientFormGrid>
            <ClientFormField label="Client name (English)" htmlFor="name">
              <Input
                id="name"
                name="name"
                className={CLIENT_FORM_INPUT_CLASS}
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setCategoryManuallySet(false);
                  resetClassificationRequest();
                }}
                required
                disabled={isPending}
                placeholder="e.g. Mindshare LTD"
              />
              <FieldError messages={state.fieldErrors?.name} />
              {classificationStatusHint}
            </ClientFormField>
            <ClientFormField label="Client name (Arabic)" htmlFor="name_ar">
              <Input
                id="name_ar"
                name="name_ar"
                className={CLIENT_FORM_INPUT_CLASS}
                defaultValue={client.name_ar ?? ""}
                disabled={isPending}
                placeholder="Optional Arabic legal name"
                dir="rtl"
              />
              <FieldError messages={state.fieldErrors?.name_ar} />
            </ClientFormField>
          </ClientFormGrid>

          <ClientFormField label="Legal name" htmlFor="legal_name">
            <Input
              id="legal_name"
              name="legal_name"
              className={CLIENT_FORM_INPUT_CLASS}
              defaultValue={client.legal_name ?? ""}
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.legal_name} />
          </ClientFormField>

          <ClientCategorySuggestion
            suggestion={categoryManuallySet ? null : suggestion}
            applied={suggestionApplied}
            onAccept={acceptSuggestion}
            onOverride={() => {
              overrideSuggestion();
              setCategoryManuallySet(true);
            }}
            disabled={isPending}
          />

          <ClientCategoryFields
            categorySlug={categorySlug}
            subcategorySlug={subcategorySlug}
            onCategoryChange={(value) => {
              setCategoryManuallySet(true);
              setCategorySlug(value);
              setClassificationMeta(null);
            }}
            onSubcategoryChange={(value) => {
              setCategoryManuallySet(true);
              setSubcategorySlug(value);
              setClassificationMeta(null);
            }}
            disabled={isPending}
            layout="grid"
          />
          <FieldError messages={state.fieldErrors?.client_category} />
          <FieldError messages={state.fieldErrors?.client_subcategory} />
        </ClientFormSection>

        <ClientFormSection
          icon={DollarSignIcon}
          title="Commercial"
          description="Rates and online presence"
        >
          <ClientFormGrid>
            <ClientFormField
              label="Default VR%"
              hint="Brands inherit this rate unless they set an explicit VR% override."
            >
              <SearchableSelect
                value={vrRateId}
                onValueChange={setVrRateId}
                options={masterData.vrRates.map((rate) => ({
                  value: rate.id,
                  label: rate.name,
                }))}
                disabled={isPending}
                placeholder="Select default VR rate"
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
              <FieldError messages={state.fieldErrors?.vr_rate_id} />
            </ClientFormField>
            <ClientFormField label="Website" htmlFor="website">
              <Input
                id="website"
                name="website"
                type="url"
                className={CLIENT_FORM_INPUT_CLASS}
                defaultValue={client.website ?? ""}
                disabled={isPending}
                placeholder="https://"
              />
              <FieldError messages={state.fieldErrors?.website} />
            </ClientFormField>
          </ClientFormGrid>
        </ClientFormSection>

        <ClientFormSection
          icon={MapPinIcon}
          title="Location & billing"
          description="Where invoices are sent"
        >
          <ClientFormGrid>
            <ClientFormField label="Country">
              <SearchableSelect
                value={country}
                onValueChange={(value) => {
                  setCountry(value);
                  setCity("");
                }}
                options={COUNTRY_OPTIONS}
                disabled={isPending}
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
            </ClientFormField>
            <ClientFormField label="City">
              <SearchableSelect
                value={city}
                onValueChange={setCity}
                options={cityOptions}
                disabled={isPending || !country}
                placeholder={country ? "Select city" : "Select country first"}
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
              <FieldError messages={state.fieldErrors?.city} />
            </ClientFormField>
          </ClientFormGrid>

          <ClientFormGrid>
            <ClientFormField label="Billing email" htmlFor="billing_email">
              <Input
                id="billing_email"
                name="billing_email"
                type="email"
                className={CLIENT_FORM_INPUT_CLASS}
                defaultValue={client.billing_email ?? ""}
                disabled={isPending}
                placeholder="billing@company.com"
              />
            </ClientFormField>
            <ClientFormField label="Billing phone" htmlFor="billing_phone">
              <Input
                id="billing_phone"
                name="billing_phone"
                className={CLIENT_FORM_INPUT_CLASS}
                defaultValue={client.billing_phone ?? ""}
                disabled={isPending}
                placeholder="+20 1XX XXX XXXX"
              />
            </ClientFormField>
          </ClientFormGrid>

          <ClientFormField label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              className={CLIENT_FORM_TEXTAREA_CLASS}
              defaultValue={client.notes ?? ""}
              disabled={isPending}
              placeholder="Internal notes about this client…"
            />
          </ClientFormField>
        </ClientFormSection>

        <ClientFormSection
          icon={FileTextIcon}
          title="Default Client IO terms"
          description="These become the default for all Client IOs on this legal entity"
        >
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
        </ClientFormSection>

        <ClientFormSaveBar
          status={<ClientFormUnsavedStatus />}
          onDiscard={discardChanges}
          discardDisabled={isPending}
        >
          <button
            type="submit"
            className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </ClientFormSaveBar>
      </form>
    </div>
  );
}
