"use client";

import { ClipboardListIcon, MapPinIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { ClientCategoryFields } from "@/components/forms/client-category-fields";
import type { ClientCategorySuggestionState } from "@/components/forms/client-category-suggestion";
import { useClientCategoryClassification } from "@/components/forms/use-client-category-classification";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  CLIENT_FORM_FIELD_HINT_CLASS,
  CLIENT_FORM_GHOST_BUTTON_CLASS,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_PRIMARY_BUTTON_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS,
} from "@/features/clients/components/client-form-ui";
import {
  createClientAction,
  type CreateClientFormState,
} from "@/features/clients/actions";
import {
  AGENCY_OR_DIRECT_OPTIONS,
  COUNTRY_OPTIONS,
  getCityOptionsForCountry,
} from "@/features/clients/constants";
import { checkClientNameAvailable } from "@/features/validation/actions";
import type { AgencyOrDirect } from "@/types/database";
import { cn } from "@/lib/utils";

const initialState: CreateClientFormState = { ok: false };

type NewClientDialogProps = {
  groups: { id: string; name: string }[];
  currencyOptions: { value: string; label: string }[];
};

export function NewClientDialog({ groups, currencyOptions }: NewClientDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [entityName, setEntityName] = useState("");
  const [agencyOrDirect, setAgencyOrDirect] = useState<AgencyOrDirect>("agency");
  const [status, setStatus] = useState("prospect");
  const [currency, setCurrency] = useState(DEFAULT_PLATFORM_CURRENCY);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [subcategorySlug, setSubcategorySlug] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [classificationMeta, setClassificationMeta] =
    useState<ClientCategorySuggestionState | null>(null);

  const cityOptions = useMemo(() => getCityOptionsForCountry(country), [country]);

  const {
    suggestion,
    resetClassificationRequest,
  } = useClientCategoryClassification({
    companyName: entityName,
    country,
    enabled: open && !categoryTouched,
    onClassified: (result) => {
      if (!categoryTouched) {
        setCategorySlug(result.categorySlug);
        setSubcategorySlug(result.subcategorySlug);
        setClassificationMeta(result);
      }
    },
  });

  useEffect(() => {
    if (open && !categoryTouched && suggestion && !categorySlug && !subcategorySlug) {
      setCategorySlug(suggestion.categorySlug);
      setSubcategorySlug(suggestion.subcategorySlug);
      setClassificationMeta(suggestion);
    }
  }, [open, categoryTouched, suggestion, categorySlug, subcategorySlug]);

  function resetDialogForm() {
    setGroupId("");
    setEntityName("");
    setAgencyOrDirect("agency");
    setStatus("prospect");
    setCurrency(DEFAULT_PLATFORM_CURRENCY);
    setCountry("");
    setCity("");
    setCategorySlug("");
    setSubcategorySlug("");
    setCategoryTouched(false);
    setClassificationMeta(null);
    resetClassificationRequest();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetDialogForm();
    }
  }

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    entityName,
    checkClientNameAvailable,
    [agencyOrDirect],
    open && Boolean(agencyOrDirect)
  );
  const [state, formAction, isPending] = useActionState(
    createClientAction,
    initialState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      resetDialogForm();
      setOpen(false);
      if (state.clientId) {
        router.push(`/clients/${state.clientId}`);
      }
      return;
    }

    const fieldMessages = state.fieldErrors
      ? Object.values(state.fieldErrors).flat().filter(Boolean)
      : [];
    toast.error(
      fieldMessages.length > 0 ? fieldMessages[0] : state.message
    );
  }, [state, router]);

  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New Client
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden rounded-[20px] border-border p-0 shadow-[var(--card-shadow)] sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border bg-background/70 px-6 py-4 backdrop-blur-md">
          <DialogTitle className="text-[25px] font-extrabold tracking-[-0.02em]">
            New client
          </DialogTitle>
          <DialogDescription className="mt-[5px] text-sm">
            Add a client legal entity. Optionally link to a holding group now or
            assign one later from the client profile.
          </DialogDescription>
        </DialogHeader>
        <ClientFormKeyboardShortcuts
          formId="new-client-form"
          enabled={open}
          disabled={isPending || isDuplicate || checking}
        />
        <form
          id="new-client-form"
          action={formAction}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            if (isPending || isDuplicate || checking) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
          <input type="hidden" name="currency" value={currency} />
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
              !categoryTouched && Boolean(classificationMeta) ? true : false
            )}
          />
          <input
            type="hidden"
            name="category_manually_set"
            value={String(categoryTouched)}
          />

          <div className="grid min-h-0 flex-1 gap-[18px] overflow-y-auto px-6 py-5">
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
              icon={ClipboardListIcon}
              title="Identity"
              description="Legal name and classification"
              className="shadow-none"
            >
              <ClientFormGrid>
                <ClientFormField label="Client name (English)" htmlFor="name">
                  <Input
                    id="name"
                    name="name"
                    value={entityName}
                    onChange={(e) => {
                      setEntityName(e.target.value);
                      setCategoryTouched(false);
                      resetClassificationRequest();
                    }}
                    required
                    disabled={isPending}
                    placeholder="e.g. Mindshare LTD"
                    className={CLIENT_FORM_INPUT_CLASS}
                  />
                  <FieldError messages={state.fieldErrors?.name} />
                  {duplicateMessage ? (
                    <p className="text-xs text-destructive">{duplicateMessage}</p>
                  ) : checking ? (
                    <p className={CLIENT_FORM_FIELD_HINT_CLASS}>Checking availability…</p>
                  ) : null}
                </ClientFormField>

                <ClientFormField label="Client name (Arabic)" htmlFor="name_ar">
                  <Input
                    id="name_ar"
                    name="name_ar"
                    disabled={isPending}
                    placeholder="Optional Arabic legal name"
                    dir="rtl"
                    className={CLIENT_FORM_INPUT_CLASS}
                  />
                  <FieldError messages={state.fieldErrors?.name_ar} />
                </ClientFormField>
              </ClientFormGrid>

              <ClientCategoryFields
                categorySlug={categorySlug}
                subcategorySlug={subcategorySlug}
                onCategoryChange={(value) => {
                  setCategoryTouched(true);
                  setCategorySlug(value);
                  setClassificationMeta(null);
                }}
                onSubcategoryChange={(value) => {
                  setCategoryTouched(true);
                  setSubcategorySlug(value);
                  setClassificationMeta(null);
                }}
                disabled={isPending}
                layout="grid"
              />
              <FieldError messages={state.fieldErrors?.client_category} />
              <FieldError messages={state.fieldErrors?.client_subcategory} />

              <ClientFormField label="Holding group (optional)">
                <SearchableSelect
                  value={groupId}
                  onValueChange={setGroupId}
                  options={groupOptions}
                  disabled={isPending}
                  placeholder={
                    groups.length > 0 ? "Link to group (optional)" : "No groups yet"
                  }
                  className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
                />
                <FieldError messages={state.fieldErrors?.group_id} />
                {groups.length === 0 ? (
                  <p className={CLIENT_FORM_FIELD_HINT_CLASS}>
                    You can create a client without a group and link one later.
                  </p>
                ) : null}
              </ClientFormField>

              <ClientFormField label="Relationship type">
                <Select
                  value={agencyOrDirect}
                  onValueChange={(v) => setAgencyOrDirect(v as AgencyOrDirect)}
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
              </ClientFormField>
            </ClientFormSection>

            <ClientFormSection
              icon={MapPinIcon}
              title="Location & defaults"
              description="Region and billing currency"
              className="shadow-none"
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
                    placeholder="Optional"
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

              <ClientFormField label="Currency">
                <Select
                  value={currency}
                  onValueChange={setCurrency}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(CLIENT_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
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
              </ClientFormField>

              <ClientFormField label="Notes" htmlFor="notes">
                <Textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  disabled={isPending}
                  className={CLIENT_FORM_TEXTAREA_CLASS}
                />
              </ClientFormField>

              <p className="text-xs text-muted-foreground">
                Client IO terms use the platform default. Customize them from the client
                profile after creation.
              </p>
            </ClientFormSection>
          </div>

          <DialogFooter className="shrink-0 gap-2.5 border-t border-border bg-background/90 px-6 py-3.5 backdrop-blur-[14px]">
            <button
              type="button"
              className={CLIENT_FORM_GHOST_BUTTON_CLASS}
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
              disabled={isPending || isDuplicate || checking}
            >
              {isPending ? "Creating…" : "Create client"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
