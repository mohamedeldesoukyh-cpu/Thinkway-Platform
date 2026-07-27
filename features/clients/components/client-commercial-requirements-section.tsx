"use client";

import { useActionState, useEffect, useState } from "react";
import { ClipboardListIcon } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ClientFormField,
  ClientFormSection,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS,
} from "@/features/clients/components/client-form-ui";
import {
  upsertClientCommercialRequirementsAction,
  type FormActionState,
} from "@/features/clients/actions";
import type { ClientCommercialRequirementsRow } from "@/types/database";

export function ClientCommercialRequirementsSection({
  clientId,
  initial,
}: {
  clientId: string;
  initial: ClientCommercialRequirementsRow | null;
}) {
  const [requiredDocs, setRequiredDocs] = useState(
    (initial?.required_document_types ?? []).join(", ")
  );
  const [usageRights, setUsageRights] = useState(initial?.usage_rights ?? "");
  const [approvalWorkflow, setApprovalWorkflow] = useState(
    initial?.approval_workflow ?? ""
  );
  const [exclusivity, setExclusivity] = useState(initial?.exclusivity_notes ?? "");
  const [confidentiality, setConfidentiality] = useState(
    initial?.confidentiality_notes ?? ""
  );
  const [legalClauses, setLegalClauses] = useState(
    Array.isArray(initial?.legal_clauses)
      ? initial!.legal_clauses
          .map((c) => (typeof c === "string" ? c : String((c as { text?: string }).text ?? "")))
          .filter(Boolean)
          .join("\n")
      : ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [state, formAction, isPending] = useActionState(
    upsertClientCommercialRequirementsAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <ClientFormSection
      icon={ClipboardListIcon}
      title="Commercial requirements"
      description="Documents and clauses creators must satisfy for this legal entity. Brands may add extras separately."
    >
      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="client_id" value={clientId} />
        <ClientFormField
          label="Required document types"
          hint="Comma-separated codes, e.g. passport, trade_licence, bank_letter, vat_certificate"
        >
          <Input
            name="required_document_types"
            value={requiredDocs}
            onChange={(e) => setRequiredDocs(e.target.value)}
            className={CLIENT_FORM_INPUT_CLASS}
            disabled={isPending}
          />
        </ClientFormField>
        <ClientFormField label="Usage rights">
          <Textarea
            name="usage_rights"
            value={usageRights}
            onChange={(e) => setUsageRights(e.target.value)}
            className={CLIENT_FORM_TEXTAREA_CLASS}
            rows={3}
            disabled={isPending}
          />
        </ClientFormField>
        <ClientFormField label="Approval workflow">
          <Input
            name="approval_workflow"
            value={approvalWorkflow}
            onChange={(e) => setApprovalWorkflow(e.target.value)}
            className={CLIENT_FORM_INPUT_CLASS}
            disabled={isPending}
          />
        </ClientFormField>
        <ClientFormField label="Legal clauses" hint="One clause per line">
          <Textarea
            name="legal_clauses"
            value={legalClauses}
            onChange={(e) => setLegalClauses(e.target.value)}
            className={CLIENT_FORM_TEXTAREA_CLASS}
            rows={4}
            disabled={isPending}
          />
        </ClientFormField>
        <ClientFormField label="Exclusivity">
          <Textarea
            name="exclusivity_notes"
            value={exclusivity}
            onChange={(e) => setExclusivity(e.target.value)}
            className={CLIENT_FORM_TEXTAREA_CLASS}
            rows={2}
            disabled={isPending}
          />
        </ClientFormField>
        <ClientFormField label="Confidentiality">
          <Textarea
            name="confidentiality_notes"
            value={confidentiality}
            onChange={(e) => setConfidentiality(e.target.value)}
            className={CLIENT_FORM_TEXTAREA_CLASS}
            rows={2}
            disabled={isPending}
          />
        </ClientFormField>
        <ClientFormField label="Notes">
          <Textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={CLIENT_FORM_TEXTAREA_CLASS}
            rows={2}
            disabled={isPending}
          />
        </ClientFormField>
        <button
          type="submit"
          className="platform-v6-btn platform-v6-btn-primary platform-v6-btn-sm w-fit"
          disabled={isPending}
        >
          Save commercial requirements
        </button>
      </form>
    </ClientFormSection>
  );
}
