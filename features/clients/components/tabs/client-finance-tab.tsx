"use client";

import { useActionState, useEffect, useState } from "react";
import { DollarSignIcon } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
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
  CLIENT_FORM_FIELD_LABEL_CLASS,
  CLIENT_FORM_FIELD_HINT_CLASS,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/clients/components/client-form-ui";
import {
  updateClientFinanceAction,
  type FormActionState,
} from "@/features/clients/actions";
import { PAYMENT_TERMS_OPTIONS } from "@/features/clients/constants";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

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
            icon={DollarSignIcon}
            title="Billing defaults"
            description="Currency, payment terms, and credit limit."
          >
            <ClientFormGrid className="lg:grid-cols-3">
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
            </ClientFormGrid>

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
                  onCheckedChange={(value) => {
                    setCreditLimitActive(value);
                    markDirty();
                  }}
                  disabled={isPending}
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
                  onCheckedChange={(value) => {
                    setAcceptCreditRisk(value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
              </div>
            </div>
          </ClientFormSection>

          <ClientFormSection
            icon={DollarSignIcon}
            title="Billing contacts"
            description="Where invoices and payment notices are sent."
          >
            <ClientFormGrid>
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
            </ClientFormGrid>
          </ClientFormSection>
        </form>
      </ClientProfileTabShell>
    </>
  );
}
