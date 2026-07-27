"use client";

import { useActionState, useEffect, useState } from "react";
import { LandmarkIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  upsertInfluencerBankAccountAction,
  setDefaultVerifiedBankAccountAction,
  type FormActionState,
} from "@/features/vendors/actions";
import {
  VendorFormField,
  VendorFormGrid,
  VendorFormSection,
  VENDOR_FORM_INPUT_CLASS,
  VENDOR_FORM_TEXTAREA_CLASS,
} from "@/features/vendors/components/vendor-form-ui";
import type { VendorWorkspace } from "@/features/vendors/types";
import { BANK_RELATIONSHIP_OPTIONS } from "@/lib/creators/crm/payment-readiness";

export function VendorBankAccountsSection({
  workspace,
}: {
  workspace: VendorWorkspace;
}) {
  const accounts = workspace.bank_accounts ?? [];
  const [relationship, setRelationship] = useState("account_owner");
  const [upsertState, upsertAction, upsertPending] = useActionState(
    upsertInfluencerBankAccountAction,
    { ok: false } satisfies FormActionState
  );
  const [defaultState, defaultAction, defaultPending] = useActionState(
    setDefaultVerifiedBankAccountAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!upsertState.message) return;
    if (upsertState.ok) toast.success(upsertState.message);
    else toast.error(upsertState.message);
  }, [upsertState]);

  useEffect(() => {
    if (!defaultState.message) return;
    if (defaultState.ok) toast.success(defaultState.message);
    else toast.error(defaultState.message);
  }, [defaultState]);

  return (
    <div className="space-y-4 px-4 md:px-5">
      <VendorFormSection
        icon={LandmarkIcon}
        title="Bank accounts"
        description="Payment Readiness uses beneficiary, relationship, bank, currency, SWIFT, and IBAN or account number."
      >
        {accounts.length === 0 ? (
          <p className="mb-3 text-[12px] text-muted-foreground">
            No bank accounts yet. Add the account Finance will pay.
          </p>
        ) : (
          <ul className="mb-4 divide-y divide-border rounded-lg border">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">
                    {account.beneficiary_name || account.account_holder || "Beneficiary"}
                    {account.bank_name ? ` · ${account.bank_name}` : ""}
                    {account.currency ? ` · ${account.currency}` : ""}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {account.relationship_type
                      ? account.relationship_type.replace(/_/g, " ")
                      : "No relationship"}
                    {" · "}
                    {account.iban || account.account_number || "No IBAN/account"}
                    {account.swift ? ` · SWIFT ${account.swift}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {account.is_default ? (
                    <Badge variant="secondary">Default</Badge>
                  ) : null}
                  {account.is_verified ? (
                    <Badge variant="outline">Verified</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700">
                      Unverified
                    </Badge>
                  )}
                  {!account.is_default || !account.is_verified ? (
                    <form action={defaultAction}>
                      <input type="hidden" name="influencer_id" value={workspace.id} />
                      <input type="hidden" name="bank_account_id" value={account.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={defaultPending}
                      >
                        Set verified default
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={upsertAction} className="space-y-3 rounded-lg border border-dashed p-3">
          <input type="hidden" name="influencer_id" value={workspace.id} />
          <p className="text-[12px] font-medium text-foreground">Add bank account</p>
          <VendorFormGrid>
            <VendorFormField label="Beneficiary name">
              <Input
                name="beneficiary_name"
                required
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={upsertPending}
              />
            </VendorFormField>
            <VendorFormField label="Relationship">
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger className={VENDOR_FORM_INPUT_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANK_RELATIONSHIP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="relationship_type" value={relationship} />
            </VendorFormField>
            {relationship === "other" ? (
              <VendorFormField label="Relationship description">
                <Input
                  name="relationship_description"
                  required
                  className={VENDOR_FORM_INPUT_CLASS}
                  disabled={upsertPending}
                />
              </VendorFormField>
            ) : null}
            <VendorFormField label="Bank name">
              <Input
                name="bank_name"
                required
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={upsertPending}
              />
            </VendorFormField>
            <VendorFormField label="Currency">
              <Input
                name="currency"
                maxLength={3}
                required
                placeholder="EGP"
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={upsertPending}
              />
            </VendorFormField>
            <VendorFormField label="SWIFT code">
              <Input
                name="swift"
                required
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={upsertPending}
              />
            </VendorFormField>
            <VendorFormField label="IBAN">
              <Input name="iban" className={VENDOR_FORM_INPUT_CLASS} disabled={upsertPending} />
            </VendorFormField>
            <VendorFormField label="Account number">
              <Input
                name="account_number"
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={upsertPending}
              />
            </VendorFormField>
            <VendorFormField label="Branch">
              <Input
                name="branch_name"
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={upsertPending}
              />
            </VendorFormField>
            <VendorFormField label="Routing number">
              <Input
                name="routing_number"
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={upsertPending}
              />
            </VendorFormField>
            <VendorFormField label="Sort code">
              <Input
                name="sort_code"
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={upsertPending}
              />
            </VendorFormField>
            <VendorFormField label="National ID">
              <Input
                name="national_id"
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={upsertPending}
              />
            </VendorFormField>
            <VendorFormField label="Tax number">
              <Input
                name="tax_number"
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={upsertPending}
              />
            </VendorFormField>
          </VendorFormGrid>
          <VendorFormField label="Address">
            <Input name="address" className={VENDOR_FORM_INPUT_CLASS} disabled={upsertPending} />
          </VendorFormField>
          <VendorFormField label="Notes">
            <Textarea
              name="notes"
              rows={2}
              className={VENDOR_FORM_TEXTAREA_CLASS}
              disabled={upsertPending}
            />
          </VendorFormField>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <input type="checkbox" name="is_default" value="true" defaultChecked />
            Make default
          </label>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <input type="checkbox" name="is_verified" value="true" />
            Mark verified
          </label>
          <p className="text-[11px] text-muted-foreground">
            Provide IBAN or Account Number (not both required).
          </p>
          <Button type="submit" size="sm" disabled={upsertPending}>
            Save account
          </Button>
        </form>
      </VendorFormSection>
    </div>
  );
}
