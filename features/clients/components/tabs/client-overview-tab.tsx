"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseIcon,
  FileTextIcon,
  MapPinIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { ClientCategoryFields } from "@/components/forms/client-category-fields";
import type { ClientCategorySuggestionState } from "@/components/forms/client-category-suggestion";
import { useClientCategoryClassification } from "@/components/forms/use-client-category-classification";
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
  ClientFormKeyboardShortcuts,
  ClientFormSection,
  ClientProfileTabShell,
  CLIENT_FORM_FIELD_HINT_CLASS,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS,
} from "@/features/clients/components/client-form-ui";
import { EntityLogoField } from "@/features/entity-logos/components/entity-logo-field";
import {
  updateClientOverviewAction,
  type ClientOverviewSavePatch,
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
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  getCityOptionsForCountry,
} from "@/features/clients/constants";
import { assessClientOverviewCommercialReadiness } from "@/lib/clients/client-profile-readiness";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { AgencyOrDirect, ClientDetail, ClientStatus } from "@/types/database";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  PLATFORM_V6_ICON_AMBER,
  PLATFORM_V6_ICON_GREEN,
} from "@/components/platform/platform-v6-layout";

type ClientOverviewTabProps = {
  client: ClientDetail;
  groups: { id: string; name: string; document_number: string }[];
  masterData: MasterDataOptions;
  onCancel?: () => void;
  /** When false, Ctrl+S is not wired to this form (e.g. another profile tab is active). */
  shortcutsEnabled?: boolean;
  onboardingSlot?: ReactNode;
  /** Applies persisted overview fields returned by the save action. */
  onClientPatch?: (patch: ClientOverviewSavePatch) => void;
};

export function ClientOverviewTab({
  client,
  groups,
  masterData,
  onCancel,
  shortcutsEnabled = true,
  onboardingSlot,
  onClientPatch,
}: ClientOverviewTabProps) {
  const router = useRouter();
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
  const [agencyOrDirect, setAgencyOrDirect] = useState<AgencyOrDirect>(
    (client.agency_or_direct ?? "agency") as AgencyOrDirect
  );
  const [legalName, setLegalName] = useState(client.legal_name ?? "");
  const [nameAr, setNameAr] = useState(client.name_ar ?? "");
  const [website, setWebsite] = useState(client.website ?? "");
  const [billingEmail, setBillingEmail] = useState(client.billing_email ?? "");
  const [billingPhone, setBillingPhone] = useState(client.billing_phone ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const cityOptions = useMemo(() => {
    const options = getCityOptionsForCountry(country);
    if (city && !options.some((option) => option.value === city)) {
      return [{ value: city, label: city }, ...options];
    }
    return options;
  }, [country, city]);

  const {
    suggestion,
    resetClassificationRequest,
  } = useClientCategoryClassification({
    companyName: displayName,
    country,
    website: website || undefined,
    clientId: client.id,
    useStoredApproved:
      !categoryManuallySet &&
      Boolean(client.approved_by_user && client.client_category),
    enabled: !categoryManuallySet,
    onClassified: (result) => {
      if (!categoryManuallySet) {
        setCategorySlug(result.categorySlug);
        setSubcategorySlug(result.subcategorySlug);
        setClassificationMeta(result);
      }
    },
  });

  // Silently pre-fill category when classification returns and fields are empty.
  useEffect(() => {
    if (
      !categoryManuallySet &&
      suggestion &&
      !categorySlug &&
      !subcategorySlug
    ) {
      setCategorySlug(suggestion.categorySlug);
      setSubcategorySlug(suggestion.subcategorySlug);
      setClassificationMeta(suggestion);
    }
  }, [categoryManuallySet, suggestion, categorySlug, subcategorySlug]);

  const [ioTerms, setIoTerms] = useState<ClientIoTerm[]>(
    () => parseTermsText(client.client_io_terms_text) ?? CLIENT_IO_DEFAULT_TERMS
  );
  const [usePlatformIoTerms, setUsePlatformIoTerms] = useState(
    () => !parseTermsText(client.client_io_terms_text)
  );

  function markDirty() {
    setIsDirty(true);
  }

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
    setAgencyOrDirect((client.agency_or_direct ?? "agency") as AgencyOrDirect);
    setLegalName(client.legal_name ?? "");
    setNameAr(client.name_ar ?? "");
    setWebsite(client.website ?? "");
    setBillingEmail(client.billing_email ?? "");
    setBillingPhone(client.billing_phone ?? "");
    setNotes(client.notes ?? "");
    setIoTerms(
      parseTermsText(client.client_io_terms_text) ?? CLIENT_IO_DEFAULT_TERMS
    );
    setUsePlatformIoTerms(!parseTermsText(client.client_io_terms_text));
    resetClassificationRequest();
    setIsDirty(false);
    setFormKey((key) => key + 1);
  }

  function handleCancel() {
    discardChanges();
    onCancel?.();
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
      setIsDirty(false);
      if (state.clientPatch) {
        setGroupId(state.clientPatch.group_id ?? "");
        onClientPatch?.(state.clientPatch);
      }
      router.refresh();
      return;
    }

    const fieldMessages = state.fieldErrors
      ? Object.values(state.fieldErrors).flat().filter(Boolean)
      : [];
    toast.error(fieldMessages.length > 0 ? fieldMessages[0] : state.message);
  }, [state, router, onClientPatch]);

  useEffect(() => {
    if (isDirty) {
      return;
    }
    setGroupId(client.group_id ?? "");
  }, [client.group_id, client.id, isDirty]);

  const groupOptions = groups.map((g) => ({
    value: g.id,
    label: g.name,
  }));

  const commercialReadiness = useMemo(
    () => assessClientOverviewCommercialReadiness(client),
    [client]
  );

  const clientIoTermsPayload =
    usePlatformIoTerms || termsAreEqual(ioTerms, CLIENT_IO_DEFAULT_TERMS)
      ? ""
      : serializeTermsText(ioTerms);

  return (
    <>
    <ClientFormKeyboardShortcuts
      formId="client-overview-form"
      enabled={shortcutsEnabled}
      disabled={isPending}
    />
    <ClientProfileTabShell
      title="Edit legal entity"
      description="Update the client's profile, billing, and default insertion-order terms."
      beforeHeader={onboardingSlot}
      onCancel={handleCancel}
      saveFormId="client-overview-form"
      saveDisabled={isPending}
      isSaving={isPending}
      isDirty={isDirty}
      onDiscard={discardChanges}
      discardDisabled={isPending}
    >
        <form
          key={formKey}
          id="client-overview-form"
          action={formAction}
          className="grid gap-[18px]"
          onSubmit={(event) => {
            if (isPending) {
              event.preventDefault();
            }
          }}
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
        <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
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

        {!groupId ? (
          <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-950">
            <p className="font-medium">No holding group linked</p>
            <p className="mt-1 text-[12px] text-amber-900/80">
              Holding groups are optional. Link one below only if this legal entity belongs
              to a holding group — brands can be added either way.
            </p>
          </div>
        ) : null}

        {!commercialReadiness.complete ? (
          <div className="rounded-[10px] border border-amber-300/80 bg-amber-50 px-4 py-3 text-[12px] text-amber-950">
            <p className="font-medium">Commercial profile incomplete</p>
            <p className="mt-1 text-[12px] text-amber-900/80">
              Complete the fields below. Default VR% is optional and does not affect
              onboarding progress.
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-amber-900">
              {commercialReadiness.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <ClientFormSection
          icon={UserIcon}
          title="Identity"
          description="Legal entity name and status"
        >
          <EntityLogoField
            kind="client"
            entityId={client.id}
            logoUrl={client.logo_url}
            label="Client logo"
            hint="Used in Client Workspace when the group has no logo. PNG, JPG, or WebP · up to 2 MB."
            disabled={isPending}
          />
          <ClientFormGrid columns={3}>
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
                  markDirty();
                }}
                required
                disabled={isPending}
                placeholder="e.g. Mindshare LTD"
              />
              <FieldError messages={state.fieldErrors?.name} />
            </ClientFormField>
            <ClientFormField label="Client name (Arabic)" htmlFor="name_ar">
              <Input
                id="name_ar"
                name="name_ar"
                className={CLIENT_FORM_INPUT_CLASS}
                value={nameAr}
                onChange={(e) => {
                  setNameAr(e.target.value);
                  markDirty();
                }}
                disabled={isPending}
                placeholder="Optional Arabic legal name"
                dir="rtl"
              />
              <FieldError messages={state.fieldErrors?.name_ar} />
            </ClientFormField>
            <ClientFormField label="Legal name" htmlFor="legal_name">
              <Input
                id="legal_name"
                name="legal_name"
                className={CLIENT_FORM_INPUT_CLASS}
                value={legalName}
                onChange={(e) => {
                  setLegalName(e.target.value);
                  markDirty();
                }}
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.legal_name} />
            </ClientFormField>
          </ClientFormGrid>

          <ClientFormGrid columns={3}>
            <ClientFormField label="Status">
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as ClientStatus);
                  markDirty();
                }}
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
            <div className="hidden md:block" aria-hidden />
            <div className="hidden md:block" aria-hidden />
          </ClientFormGrid>
        </ClientFormSection>

        <ClientFormSection
          icon={BriefcaseIcon}
          iconClassName={PLATFORM_V6_ICON_GREEN}
          title="Commercial profile"
          description="Classification and rates inherited by brands and campaigns"
        >
          <ClientFormGrid columns={3}>
            <ClientFormField
              label="Holding group (optional)"
              hint="Only if this legal entity belongs to a holding group."
            >
              <SearchableSelect
                value={groupId}
                onValueChange={(value) => {
                  setGroupId(value);
                  markDirty();
                }}
                options={groupOptions}
                disabled={isPending}
                placeholder={
                  groups.length > 0 ? "Select holding group" : "No groups yet"
                }
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
              <FieldError messages={state.fieldErrors?.group_id} />
              {groups.length === 0 ? (
                <p className={CLIENT_FORM_FIELD_HINT_CLASS}>
                  Create a holding group first if you need group-level reporting.
                </p>
              ) : null}
            </ClientFormField>
            <ClientFormField label="Relationship type">
              <Select
                value={agencyOrDirect}
                onValueChange={(v) => {
                  setAgencyOrDirect(v as AgencyOrDirect);
                  markDirty();
                }}
                disabled={isPending}
              >
                <SelectTrigger className={cn(CLIENT_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_OR_DIRECT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError messages={state.fieldErrors?.agency_or_direct} />
            </ClientFormField>
            <ClientFormField
              label="Default VR%"
              hint="Brands inherit this rate unless they set an explicit VR% override."
            >
              <SearchableSelect
                value={vrRateId}
                onValueChange={(value) => {
                  setVrRateId(value);
                  markDirty();
                }}
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
          </ClientFormGrid>

          <ClientCategoryFields
            categorySlug={categorySlug}
            subcategorySlug={subcategorySlug}
            onCategoryChange={(value) => {
              setCategoryManuallySet(true);
              setCategorySlug(value);
              setClassificationMeta(null);
              markDirty();
            }}
            onSubcategoryChange={(value) => {
              setCategoryManuallySet(true);
              setSubcategorySlug(value);
              setClassificationMeta(null);
              markDirty();
            }}
            disabled={isPending}
            layout="grid"
          />
          <FieldError messages={state.fieldErrors?.client_category} />
          <FieldError messages={state.fieldErrors?.client_subcategory} />

          <ClientFormGrid columns={3}>
            <ClientFormField label="Website" htmlFor="website">
              <Input
                id="website"
                name="website"
                type="url"
                className={CLIENT_FORM_INPUT_CLASS}
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  markDirty();
                }}
                disabled={isPending}
                placeholder="https://"
              />
              <FieldError messages={state.fieldErrors?.website} />
            </ClientFormField>
            <div className="hidden md:block" aria-hidden />
            <div className="hidden md:block" aria-hidden />
          </ClientFormGrid>
        </ClientFormSection>

        <ClientFormSection
          icon={MapPinIcon}
          iconClassName={PLATFORM_V6_ICON_AMBER}
          title="Location & billing"
          description="Where invoices are sent"
        >
          <ClientFormGrid columns={3}>
            <ClientFormField label="Country">
              <SearchableSelect
                value={country}
                onValueChange={(value) => {
                  setCountry(value);
                  setCity("");
                  markDirty();
                }}
                options={COUNTRY_OPTIONS}
                disabled={isPending}
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
            </ClientFormField>
            <ClientFormField label="City">
              <SearchableSelect
                value={city}
                onValueChange={(value) => {
                  setCity(value);
                  markDirty();
                }}
                options={cityOptions}
                disabled={isPending || !country}
                placeholder={country ? "Select city" : "Select country first"}
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
              <FieldError messages={state.fieldErrors?.city} />
            </ClientFormField>
            <div className="hidden md:block" aria-hidden />
          </ClientFormGrid>

          <ClientFormGrid columns={3}>
            <ClientFormField label="Billing email" htmlFor="billing_email">
              <Input
                id="billing_email"
                name="billing_email"
                type="email"
                className={CLIENT_FORM_INPUT_CLASS}
                value={billingEmail}
                onChange={(e) => {
                  setBillingEmail(e.target.value);
                  markDirty();
                }}
                disabled={isPending}
                placeholder="billing@company.com"
              />
            </ClientFormField>
            <ClientFormField label="Billing phone" htmlFor="billing_phone">
              <Input
                id="billing_phone"
                name="billing_phone"
                className={CLIENT_FORM_INPUT_CLASS}
                value={billingPhone}
                onChange={(e) => {
                  setBillingPhone(e.target.value);
                  markDirty();
                }}
                disabled={isPending}
                placeholder="+20 1XX XXX XXXX"
              />
            </ClientFormField>
            <div className="hidden md:block" aria-hidden />
          </ClientFormGrid>

          <ClientFormField label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              className={CLIENT_FORM_TEXTAREA_CLASS}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                markDirty();
              }}
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
              markDirty();
            }}
            onRecover={() => {
              setIoTerms(CLIENT_IO_DEFAULT_TERMS);
              setUsePlatformIoTerms(true);
              markDirty();
            }}
            disabled={isPending}
          />
        </ClientFormSection>
        </form>
    </ClientProfileTabShell>
    </>
  );
}
