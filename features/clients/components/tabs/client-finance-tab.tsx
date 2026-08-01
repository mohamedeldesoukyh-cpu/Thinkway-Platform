"use client";

import { useActionState, useEffect, useState } from "react";
import { MailIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { PlatformV6ToggleRow } from "@/components/platform/platform-v6-layout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ClientFormField,
  ClientFormGrid,
  ClientFormKeyboardShortcuts,
  ClientFormSection,
  ClientProfileTabShell,
  CLIENT_FORM_FIELD_HINT_CLASS,
  CLIENT_FORM_FIELD_LABEL_CLASS,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import {
  updateClientFinanceAction,
  type FormActionState,
} from "@/features/clients/actions";
import { PAYMENT_TERMS_OPTIONS } from "@/features/clients/constants";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

function CreditLimitToggleFields({
  creditLimitActive,
  acceptCreditRisk,
  onCreditLimitActiveChange,
  onAcceptCreditRiskChange,
  disabled,
}: {
  creditLimitActive: boolean;
  acceptCreditRisk: boolean;
  onCreditLimitActiveChange: (value: boolean) => void;
  onAcceptCreditRiskChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <div className="platform-v6-toggle-grid">
        <PlatformV6ToggleRow
          id="credit_limit_active"
          title="CL Active"
          description="Enforce credit limit on new campaign creation when a limit is set."
          checked={creditLimitActive}
          onCheckedChange={onCreditLimitActiveChange}
          disabled={disabled}
        />
        <PlatformV6ToggleRow
          id="accept_credit_risk"
          title="Accept risk"
          description="Allow users to acknowledge and proceed when exposure exceeds the limit."
          checked={acceptCreditRisk}
          onCheckedChange={onAcceptCreditRiskChange}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-[18px] rounded-[12px] border border-border bg-muted p-[18px] sm:grid-cols-2">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className={CLIENT_FORM_FIELD_LABEL_CLASS}>CL Active</p>
          <p className={CLIENT_FORM_FIELD_HINT_CLASS}>
            Enforce credit limit on new campaign creation when a limit is set.
          </p>
        </div>
        <Switch
          id="credit_limit_active"
          checked={creditLimitActive}
          onCheckedChange={onCreditLimitActiveChange}
          disabled={disabled}
        />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className={CLIENT_FORM_FIELD_LABEL_CLASS}>Accept risk</p>
          <p className={CLIENT_FORM_FIELD_HINT_CLASS}>
            Allow users to acknowledge and proceed when exposure exceeds the limit.
          </p>
        </div>
        <Switch
          id="accept_credit_risk"
          checked={acceptCreditRisk}
          onCheckedChange={onAcceptCreditRiskChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function ClientFinanceTab({
  client,
  currencyOptions,
  onCancel,
  shortcutsEnabled = true,
}: {
  client: ClientDetail;
  currencyOptions: { value: string; label: string }[];
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();
  const [currency, setCurrency] = useState(client.currency);
  const [paymentTerms, setPaymentTerms] = useState(client.payment_terms ?? "");
  const [creditLimit, setCreditLimit] = useState(
    client.credit_limit != null ? String(client.credit_limit) : ""
  );
  const [creditLimitActive, setCreditLimitActive] = useState(
    client.credit_limit_active ?? false
  );
  const [acceptCreditRisk, setAcceptCreditRisk] = useState(
    client.accept_credit_risk ?? false
  );
  const [billingEmail, setBillingEmail] = useState(client.billing_email ?? "");
  const [billingPhone, setBillingPhone] = useState(client.billing_phone ?? "");
  const [isDirty, setIsDirty] = useState(false);

  const [state, formAction, isPending] = useActionState(
    updateClientFinanceAction,
    { ok: false } satisfies FormActionState
  );

  function markDirty() {
    setIsDirty(true);
  }

  function discardChanges() {
    setCurrency(client.currency);
    setPaymentTerms(client.payment_terms ?? "");
    setCreditLimit(client.credit_limit != null ? String(client.credit_limit) : "");
    setCreditLimitActive(client.credit_limit_active ?? false);
    setAcceptCreditRisk(client.accept_credit_risk ?? false);
    setBillingEmail(client.billing_email ?? "");
    setBillingPhone(client.billing_phone ?? "");
    setIsDirty(false);
  }

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      setIsDirty(false);
      return;
    }
    toast.error(state.message);
  }, [state]);

  return (
    <>
      <ClientFormKeyboardShortcuts
        formId="client-finance-form"
        enabled={shortcutsEnabled}
        disabled={isPending}
      />
      <ClientProfileTabShell
        title="Finance"
        description="Billing defaults and credit settings for this legal entity."
        onCancel={onCancel}
        saveFormId="client-finance-form"
        saveLabel="Save finance"
        saveDisabled={isPending}
        isSaving={isPending}
        isDirty={isDirty}
        onDiscard={discardChanges}
        discardDisabled={isPending}
      >
        <form id="client-finance-form" action={formAction} className="grid gap-[18px]">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="payment_terms" value={paymentTerms} />
          <input
            type="hidden"
            name="credit_limit_active"
            value={creditLimitActive ? "true" : "false"}
          />
          <input
            type="hidden"
            name="accept_credit_risk"
            value={acceptCreditRisk ? "true" : "false"}
          />

          <ClientFormSection
            icon={WalletIcon}
            title="Billing defaults"
            description="Currency, payment terms, and credit limit."
          >
            <ClientFormGrid
              columns={platformV6 ? 4 : undefined}
              className={cn(!platformV6 && "lg:grid-cols-3", platformV6 && "mb-5")}
            >
              <ClientFormField label="Currency">
                <Select
                  value={currency}
                  onValueChange={(value) => {
                    setCurrency(value);
                    markDirty();
                  }}
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
              <ClientFormField label="Payment terms">
                <Select
                  value={paymentTerms}
                  onValueChange={(value) => {
                    setPaymentTerms(value);
                    markDirty();
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(CLIENT_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClientFormField>
              <ClientFormField label="Credit limit" htmlFor="credit_limit">
                <Input
                  id="credit_limit"
                  name="credit_limit"
                  type="number"
                  min={0}
                  step="0.01"
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={creditLimit}
                  onChange={(e) => {
                    setCreditLimit(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.credit_limit} />
              </ClientFormField>
              {platformV6 ? <div className="hidden md:block" aria-hidden /> : null}
            </ClientFormGrid>

            <CreditLimitToggleFields
              creditLimitActive={creditLimitActive}
              acceptCreditRisk={acceptCreditRisk}
              onCreditLimitActiveChange={(value) => {
                setCreditLimitActive(value);
                markDirty();
              }}
              onAcceptCreditRiskChange={(value) => {
                setAcceptCreditRisk(value);
                markDirty();
              }}
              disabled={isPending}
            />
            {!creditLimitActive ? (
              <p className={cn(CLIENT_FORM_FIELD_HINT_CLASS, "mt-3")}>
                Credit limit not active — finance approval is not required for onboarding.
              </p>
            ) : null}
          </ClientFormSection>

          <ClientFormSection
            icon={MailIcon}
            title="Billing contacts"
            description="Where invoices and payment notices are sent."
          >
            <ClientFormGrid columns={platformV6 ? 3 : undefined}>
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
                />
              </ClientFormField>
              {platformV6 ? <div className="hidden md:block" aria-hidden /> : null}
            </ClientFormGrid>
          </ClientFormSection>
        </form>
      </ClientProfileTabShell>
    </>
  );
}
