"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CollapsibleWorkspaceSection } from "@/components/workspace/collapsible-workspace-section";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailSheetFooter,
} from "@/features/campaigns/components/operational-detail-panel";
import {
  applyClientIoPaymentTermsPresetAction,
  updateClientIoAction,
} from "@/features/io/actions";
import { generateClientIoDocumentAction } from "@/features/io/generate-client-io-document-action";
import { useRouter } from "next/navigation";
import { ClientIoAmendmentHistory } from "@/features/io/components/client-io-amendment-history";
import {
  ClientIoAssignmentComposer,
  type ClientIoComposerAssignment,
} from "@/features/io/components/client-io-assignment-composer";
import { ClientIoMilestonesEditor } from "@/features/io/components/client-io-milestones-editor";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { ClientIoViewMenu } from "@/features/io/components/client-io-view-menu";
import { ClientIoEmailPreviewSection } from "@/features/io/components/client-io-email-preview";
import { ClientIoRecipientsEditor } from "@/features/io/components/client-io-recipients-editor";
import { ClientIoSendControls } from "@/features/io/components/client-io-send-controls";
import { ClientIoSendHistory } from "@/features/io/components/client-io-send-history";
import { ClientIoTermsEditorField } from "@/features/io/components/client-io-terms-editor";
import { isClientIoRegenerateAllowed } from "@/lib/io/client-io-assignments";
import type {
  ClientIoRow,
  ClientIoSendHistoryEntry,
  ClientIoSendRecipient,
  ClientIoVersionSummary,
} from "@/features/io/types";
import type {
  ClientIoMilestoneDraft,
  ClientIoMilestoneTemplateId,
} from "@/lib/io/client-io-milestones";
import {
  getClientIoPaymentTermsPreset,
  type ClientIoPaymentTermsPresetId,
} from "@/lib/io/client-io-payment-terms";
import { sumClientIoComposerAgreedAmount } from "@/lib/email/io-email-summary";
import { publishClientIoLiveRecipients } from "@/lib/io/client-io-live-recipients";
import {
  parseSendRecipientsJson,
  seedRecipientsFromContacts,
  serializeSendRecipients,
  type ClientIoRecipientEntry,
} from "@/lib/io/client-io-send-recipients";
import {
  parseTermsText,
  resolveDefaultTermsForClient,
  serializeTermsText,
  termsAreEqual,
  type ClientIoTerm,
} from "@/lib/io/client-io-terms";

const MILESTONE_TO_PAYMENT_PRESET: Partial<
  Record<ClientIoMilestoneTemplateId, ClientIoPaymentTermsPresetId>
> = {
  approval_100: "advance",
  net_30: "net_30",
  net_60: "net_60",
  net_90: "net_90",
  custom: "custom",
};

const INITIAL_STATE = { ok: false } as const;

type Props = {
  row: ClientIoRow;
  recipients: ClientIoSendRecipient[];
  sendHistory?: ClientIoSendHistoryEntry[];
  senderName?: string | null;
  clientDefaultTermsText?: string | null;
  brandName?: string | null;
  currencyCode?: string;
  campaignStartDate?: string | null;
  campaignEndDate?: string | null;
  assignments?: ClientIoComposerAssignment[];
  versions?: ClientIoVersionSummary[];
  milestones?: ClientIoMilestoneDraft[];
};

function SummaryItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value?.trim() || "—"}</dd>
    </div>
  );
}

export function ClientIoForm({
  row,
  recipients,
  sendHistory = [],
  senderName = null,
  clientDefaultTermsText = null,
  brandName = null,
  currencyCode = "USD",
  campaignStartDate = null,
  campaignEndDate = null,
  assignments = [],
  versions = [],
  milestones = [],
}: Props) {
  const defaultTerms = useMemo(
    () => resolveDefaultTermsForClient(clientDefaultTermsText),
    [clientDefaultTermsText]
  );

  const initialTerms = useMemo(() => {
    return parseTermsText(row.terms_text) ?? defaultTerms;
  }, [row.terms_text, defaultTerms]);

  const contactSeeds = useMemo(
    () => recipients.map((r) => ({ label: r.label, email: r.email })),
    [recipients]
  );

  const [terms, setTerms] = useState<ClientIoTerm[]>(initialTerms);
  const [useDefaultTerms, setUseDefaultTerms] = useState(() => !parseTermsText(row.terms_text));
  const [billingTerms, setBillingTerms] = useState(row.billing_terms ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState(row.attachment_url ?? "");
  // UI may seed contacts for convenience, but dirty-check against persisted IO recipients
  // so "Save draft" stays enabled until those seeds are stored.
  const [sendRecipients, setSendRecipients] = useState<ClientIoRecipientEntry[]>(() =>
    seedRecipientsFromContacts(parseSendRecipientsJson(row.send_recipients), contactSeeds)
  );
  const [draftBaseline, setDraftBaseline] = useState(() =>
    JSON.stringify({
      terms: initialTerms,
      useDefaultTerms: !parseTermsText(row.terms_text),
      billingTerms: row.billing_terms ?? "",
      attachmentUrl: row.attachment_url ?? "",
      sendRecipients: parseSendRecipientsJson(row.send_recipients),
    })
  );

  const router = useRouter();
  const [saveState, saveAction, saving] = useActionState(updateClientIoAction, INITIAL_STATE);
  const [presetState, presetAction, applyingPreset] = useActionState(
    applyClientIoPaymentTermsPresetAction,
    INITIAL_STATE
  );
  const [generateState, generateAction, generating] = useActionState(
    generateClientIoDocumentAction,
    INITIAL_STATE
  );

  useEffect(() => {
    const nextTerms = parseTermsText(row.terms_text) ?? defaultTerms;
    const nextUseDefault = !parseTermsText(row.terms_text);
    const nextBilling = row.billing_terms ?? "";
    const nextAttachment = row.attachment_url ?? "";
    const nextPersistedRecipients = parseSendRecipientsJson(row.send_recipients);
    const nextRecipients = seedRecipientsFromContacts(nextPersistedRecipients, contactSeeds);
    setTerms(nextTerms);
    setUseDefaultTerms(nextUseDefault);
    setBillingTerms(nextBilling);
    setAttachmentUrl(nextAttachment);
    setSendRecipients(nextRecipients);
    setDraftBaseline(
      JSON.stringify({
        terms: nextTerms,
        useDefaultTerms: nextUseDefault,
        billingTerms: nextBilling,
        attachmentUrl: nextAttachment,
        sendRecipients: nextPersistedRecipients,
      })
    );
  }, [row, defaultTerms, contactSeeds]);

  useEffect(() => {
    if (!saveState.message) return;
    if (saveState.ok) {
      toast.success(saveState.message);
      setDraftBaseline(
        JSON.stringify({
          terms,
          useDefaultTerms,
          billingTerms,
          attachmentUrl,
          sendRecipients,
        })
      );
      // Keep preview / export / send HTML aligned with the saved commercial terms.
      if (
        Boolean(row.document_generated_at || row.generated_html_url || row.terms_html) &&
        isClientIoRegenerateAllowed(row.status)
      ) {
        const form = document.getElementById("client-io-generate") as HTMLFormElement | null;
        form?.requestSubmit();
      }
    } else toast.error(saveState.message);
    // Intentionally depend on saveState only — capture draft values at success time.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save completion snapshot
  }, [saveState]);

  useEffect(() => {
    if (!presetState.message) return;
    if (presetState.ok) {
      toast.success(presetState.message);
      router.refresh();
    } else toast.error(presetState.message);
  }, [presetState, router]);

  useEffect(() => {
    if (!generateState.message) return;
    if (generateState.ok) toast.success(generateState.message);
    else toast.error(generateState.message);
  }, [generateState]);

  // Keep hero toolbar Send in sync with live recipient edits (including multi-add).
  useEffect(() => {
    publishClientIoLiveRecipients(row.id, sendRecipients);
  }, [row.id, sendRecipients]);

  const hasDocument = Boolean(
    row.document_generated_at || row.generated_html_url || row.terms_html
  );
  const canRegenerate = isClientIoRegenerateAllowed(row.status);
  const selectedCount = row.selected_assignment_ids?.length ?? 0;

  const sendRecipientsPayload = useMemo(
    () => serializeSendRecipients(sendRecipients),
    [sendRecipients]
  );

  const emailSummary = useMemo(() => {
    const agreed = sumClientIoComposerAgreedAmount(
      assignments,
      row.selected_assignment_ids,
      currencyCode
    );
    return {
      campaign_start_date: campaignStartDate,
      campaign_end_date: campaignEndDate,
      agreed_amount: agreed?.amount ?? null,
      // Always sync to campaign/workspace currency (brand SSOT upstream).
      currency_code: currencyCode,
    };
  }, [
    assignments,
    row.selected_assignment_ids,
    currencyCode,
    campaignStartDate,
    campaignEndDate,
  ]);

  const termsTextPayload = useMemo(() => {
    if (useDefaultTerms || termsAreEqual(terms, defaultTerms)) {
      return "";
    }
    return serializeTermsText(terms);
  }, [terms, defaultTerms, useDefaultTerms]);

  const draftDirty = useMemo(() => {
    return (
      JSON.stringify({
        terms,
        useDefaultTerms,
        billingTerms,
        attachmentUrl,
        sendRecipients,
      }) !== draftBaseline
    );
  }, [
    terms,
    useDefaultTerms,
    billingTerms,
    attachmentUrl,
    sendRecipients,
    draftBaseline,
  ]);

  function beginCustomPaymentTerms() {
    setUseDefaultTerms(false);
    toast.message(
      "Custom payment terms — edit the schedule and Payment Terms clause, then Save."
    );
  }

  function handleMilestoneTemplateApplied(templateId: ClientIoMilestoneTemplateId) {
    const presetId = MILESTONE_TO_PAYMENT_PRESET[templateId];
    if (presetId === "custom") {
      beginCustomPaymentTerms();
      return;
    }
    if (presetId) {
      // Ready Net / Advance templates are applied via the payment-preset form buttons.
      const button = document.querySelector(
        `button[form="client-io-payment-preset"][value="${presetId}"]`
      ) as HTMLButtonElement | null;
      button?.click();
      return;
    }
    if (
      templateId === "fifty_fifty" ||
      templateId === "monthly_3" ||
      templateId === "completion_100"
    ) {
      setUseDefaultTerms(false);
      const label =
        templateId === "fifty_fifty"
          ? "50% / 50%"
          : templateId === "monthly_3"
            ? "Monthly (3 installments)"
            : "100% on completion";
      setBillingTerms(label);
    }
  }

  function handleTermsChange(nextTerms: ClientIoTerm[]) {
    setTerms(nextTerms);
    setUseDefaultTerms(false);
  }

  function handleRecoverTerms() {
    setTerms(defaultTerms);
    setUseDefaultTerms(true);
    toast.message("Terms reset to default. Save draft to apply.");
  }

  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Client IO · {row.campaign_name}
            {row.document_number ? ` · ${row.document_number}` : null}
          </h2>
          <div className="inline-flex flex-wrap items-center gap-2">
            <IoStatusBadge status={row.status} />
            {hasDocument ? <ClientIoViewMenu clientIoId={row.id} /> : null}
          </div>
        </div>
      }
    >
      <div className="px-6 py-4">
        <div className="space-y-3">
          <CollapsibleWorkspaceSection
            title="Document details"
            summary={`${row.document_number ?? "Draft"} · ${row.status} · ${row.client_name ?? "Client"}`}
            defaultOpen={false}
          >
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryItem label="Document number" value={row.document_number} />
              <SummaryItem label="Campaign" value={row.campaign_name} />
              <SummaryItem label="Client" value={row.client_name} />
              <SummaryItem label="Brand" value={brandName} />
              <SummaryItem label="Status" value={row.status} />
              <SummaryItem label="Billing terms" value={billingTerms || row.billing_terms} />
            </dl>
          </CollapsibleWorkspaceSection>

          {/*
            Assignment / milestones / amendment each own a <form>. Keep them
            outside client-io-save — nested forms break submit (DEF-R22-01).
          */}
          <ClientIoAssignmentComposer
            clientIoId={row.id}
            campaignHeaderId={row.campaign_header_id}
            status={row.status}
            currencyCode={currencyCode}
            assignments={assignments}
            selectedAssignmentIds={row.selected_assignment_ids ?? []}
          />

          <ClientIoMilestonesEditor
            clientIoId={row.id}
            campaignHeaderId={row.campaign_header_id}
            status={row.status}
            isSuperseded={row.is_superseded}
            milestones={milestones}
            onTemplateApplied={handleMilestoneTemplateApplied}
          />

          <ClientIoAmendmentHistory tip={row} versions={versions} />

          <form id="client-io-payment-preset" action={presetAction} className="hidden">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
          </form>

          <form id="client-io-save" action={saveAction} className="flex flex-col">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
            <input type="hidden" name="status" value={row.status} />
            <input type="hidden" name="terms_text" value={termsTextPayload} />
            <input type="hidden" name="send_recipients" value={sendRecipientsPayload} />

            <ClientIoRecipientsEditor
              recipients={sendRecipients}
              onChange={setSendRecipients}
              disabled={saving}
              unsavedHint={
                draftDirty &&
                parseSendRecipientsJson(row.send_recipients).length === 0 &&
                sendRecipients.some((r) => r.email.trim())
              }
            />

            <ClientIoEmailPreviewSection
              io={row}
              senderName={senderName}
              recipients={sendRecipients}
              hasDocument={hasDocument}
              emailSummary={emailSummary}
            />

            <CollapsibleWorkspaceSection
              title="Payment terms"
              summary={billingTerms || row.billing_terms || "Set billing schedule"}
              defaultOpen={false}
            >
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Ready options update billing terms and the Payment Terms clause used in CIO
                  preview, export, and send. Use Custom to edit the clause manually, then Save.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "advance",
                      "net_30",
                      "net_60",
                      "net_90",
                    ] as Exclude<ClientIoPaymentTermsPresetId, "custom">[]
                  ).map((id) => {
                    const preset = getClientIoPaymentTermsPreset(id);
                    return (
                      <Button
                        key={id}
                        type="submit"
                        form="client-io-payment-preset"
                        name="preset_id"
                        value={id}
                        size="sm"
                        variant="outline"
                        title={preset.description}
                        disabled={saving || applyingPreset}
                      >
                        {applyingPreset ? "Applying…" : preset.label}
                      </Button>
                    );
                  })}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    title={getClientIoPaymentTermsPreset("custom").description}
                    disabled={saving || applyingPreset}
                    onClick={beginCustomPaymentTerms}
                  >
                    Custom
                  </Button>
                </div>
                <Input
                  id="billing_terms"
                  name="billing_terms"
                  value={billingTerms}
                  onChange={(e) => {
                    setBillingTerms(e.target.value);
                    setUseDefaultTerms(false);
                  }}
                  placeholder="Payment schedule label (e.g. Net 30 Days)"
                  className={DETAIL_FORM_INPUT_CLASS}
                />
                {draftDirty ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? "Saving…" : "Save payment terms & clause"}
                    </Button>
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Unsaved edits — save to refresh preview / export / send.
                    </p>
                  </div>
                ) : null}
              </div>
            </CollapsibleWorkspaceSection>

            <CollapsibleWorkspaceSection
              title="Terms & conditions"
              summary={`${terms.length} clause${terms.length === 1 ? "" : "s"} in document Section 8`}
              defaultOpen={false}
            >
              <ClientIoTermsEditorField
                label="Terms & conditions"
                terms={terms}
                onChange={handleTermsChange}
                onRecover={handleRecoverTerms}
                description="Structured terms injected into Section 8 of the Client IO template. Payment Terms clause updates automatically when you pick a ready payment option above."
              />
            </CollapsibleWorkspaceSection>

            <CollapsibleWorkspaceSection
              title="Attachment URL"
              summary={attachmentUrl?.trim() ? attachmentUrl : "No PO/SOW/PDF link"}
              defaultOpen={false}
            >
              <Input
                id="attachment_url"
                name="attachment_url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://..."
                className={DETAIL_FORM_INPUT_CLASS}
              />
            </CollapsibleWorkspaceSection>

            <ClientIoSendHistory history={sendHistory} />
          </form>
        </div>
      </div>

      <form id="client-io-generate" action={generateAction} className="hidden">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
      </form>

      <DetailSheetFooter>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              form="client-io-generate"
              type="submit"
              variant="outline"
              size="sm"
              disabled={generating || !canRegenerate || selectedCount === 0}
              title={
                !canRegenerate
                  ? "Regenerate is locked after send. Use an amendment (Slice 2.2.B)."
                  : selectedCount === 0
                    ? "Select and save at least one Assignment first."
                    : undefined
              }
            >
              {generating
                ? "Generating…"
                : hasDocument
                  ? "Regenerate document"
                  : "Generate document"}
            </Button>
            <ClientIoSendControls
              io={row}
              campaignId={row.campaign_header_id}
              sendRecipientsJson={sendRecipientsPayload}
              recipientCount={sendRecipients.filter((r) => r.email.trim()).length}
              hasDocument={hasDocument}
              recipientsNeedSave={
                draftDirty &&
                parseSendRecipientsJson(row.send_recipients).length === 0 &&
                sendRecipients.some((r) => r.email.trim())
              }
            />
          </div>
          <Button
            form="client-io-save"
            type="submit"
            variant={draftDirty ? "default" : "outline"}
            size="sm"
            disabled={saving || !draftDirty}
          >
            {saving ? "Saving…" : draftDirty ? "Save draft" : "Saved"}
          </Button>
        </div>
      </DetailSheetFooter>
    </OperationalTableSection>
  );
}
