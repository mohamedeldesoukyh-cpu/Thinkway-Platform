"use client";

import { useActionState, useEffect, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  FileTextIcon,
  LinkIcon,
  MessageSquareIcon,
  WalletIcon,
} from "lucide-react";
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
import { recordVendorPaymentAction } from "@/features/billing/actions";
import { generateVendorIosFromLinesAction } from "@/features/io/generate-vendor-io-action";
import {
  logVendorIoCommunicationAction,
  saveSignedIoExternalLinkAction,
  type FormActionState,
} from "@/features/vendors/actions";
import { PaymentReadinessStrip } from "@/features/vendors/components/payment-readiness-strip";
import {
  VendorFormField,
  VendorFormGrid,
  VendorFormSection,
  VENDOR_FORM_INPUT_CLASS,
  VENDOR_FORM_TEXTAREA_CLASS,
} from "@/features/vendors/components/vendor-form-ui";
import type { VendorPayoutRow, VendorWorkspace } from "@/features/vendors/types";
import { formatMoney } from "@/features/vendors/utils";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import { cn } from "@/lib/utils";

const COMM_CHANNELS = [
  { value: "manual", label: "Manual" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram_dm", label: "Instagram DM" },
  { value: "tiktok", label: "TikTok" },
  { value: "phone", label: "Phone" },
] as const;

export function VendorPaymentOpsSection({
  workspace,
}: {
  workspace: VendorWorkspace;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    workspace.payouts[0]?.id ?? null
  );
  const selected =
    workspace.payouts.find((p) => p.id === selectedId) ?? workspace.payouts[0] ?? null;

  const [genState, genAction, genPending] = useActionState(
    generateVendorIosFromLinesAction,
    { ok: false }
  );
  const [payState, payAction, payPending] = useActionState(
    recordVendorPaymentAction,
    { ok: false }
  );
  const [signedState, signedAction, signedPending] = useActionState(
    saveSignedIoExternalLinkAction,
    { ok: false } satisfies FormActionState
  );
  const [commState, commAction, commPending] = useActionState(
    logVendorIoCommunicationAction,
    { ok: false } satisfies FormActionState
  );
  const [channel, setChannel] = useState("manual");
  const [provider, setProvider] = useState("google_drive");

  useEffect(() => {
    for (const state of [genState, payState, signedState, commState]) {
      if (!state.message) continue;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [genState, payState, signedState, commState]);

  return (
    <div className="space-y-4 px-4 md:px-5">
      <PaymentReadinessStrip readiness={workspace.payment_readiness} />

      <VendorFormSection
        icon={WalletIcon}
        title="Payment workspace"
        description="Payment, PO, IO, signed IO, communication, and readiness — without leaving CRM."
      >
        {workspace.payouts.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            No campaign assignments yet. Assign this creator to a campaign to open payment ops.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[12px]">
              <thead className="border-b text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Campaign</th>
                  <th className="px-2 py-2 font-medium">Client / Brand</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Payment</th>
                  <th className="px-2 py-2 font-medium">Readiness</th>
                  <th className="px-2 py-2 font-medium">PO</th>
                  <th className="px-2 py-2 font-medium">IO</th>
                  <th className="px-2 py-2 font-medium">Signed IO</th>
                  <th className="px-2 py-2 font-medium">Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workspace.payouts.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/40",
                      selected?.id === row.id && "bg-muted/60"
                    )}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className="px-2 py-2.5">
                      <p className="font-medium text-foreground">
                        {row.campaign_name ?? "Campaign"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.campaign_document_number ?? "—"}
                      </p>
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground">
                      {[row.client_name, row.brand_name].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">
                      {formatMoney(row.amount, row.currency)}
                    </td>
                    <td className="px-2 py-2.5 capitalize">
                      {VENDOR_PAYMENT_STATUS_LABELS[row.status] ?? row.status}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge
                        variant="outline"
                        className={
                          workspace.payment_readiness.ready
                            ? "border-[var(--brand-product)]/40 text-[var(--brand-product)]"
                            : "border-amber-500/40 text-amber-800"
                        }
                      >
                        {workspace.payment_readiness.ready ? "YES" : "NO"}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5">
                      {row.po_number ? (
                        <span>
                          Issued · {row.po_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not Issued</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      {row.io ? (
                        <span>
                          Generated · v{row.io.revision_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not Generated</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      {row.signed_io ? (
                        <span className="capitalize">
                          {row.signed_io.artifact_kind.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Missing</span>
                      )}
                    </td>
                    <td className="max-w-[160px] truncate px-2 py-2.5 text-muted-foreground">
                      {row.bank_label ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </VendorFormSection>

      {selected ? (
        <PaymentOpsDetail
          workspace={workspace}
          payout={selected}
          genAction={genAction}
          genPending={genPending}
          payAction={payAction}
          payPending={payPending}
          signedAction={signedAction}
          signedPending={signedPending}
          commAction={commAction}
          commPending={commPending}
          channel={channel}
          setChannel={setChannel}
          provider={provider}
          setProvider={setProvider}
        />
      ) : null}

      <VendorFormSection
        icon={MessageSquareIcon}
        title="Payment timeline"
        description="Payment, PO, IO, signed IO, and communication events."
      >
        {workspace.payment_timeline.length === 0 &&
        workspace.io_communications.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-muted-foreground">
            No payment timeline events yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {[
              ...workspace.payment_timeline.map((e) => ({
                id: e.id,
                at: e.created_at,
                label: e.summary,
              })),
              ...workspace.io_communications.map((c) => ({
                id: c.id,
                at: c.occurred_at,
                label: `Communication · ${c.channel.replace(/_/g, " ")}${
                  c.subject ? ` · ${c.subject}` : ""
                }`,
              })),
            ]
              .sort((a, b) => b.at.localeCompare(a.at))
              .slice(0, 40)
              .map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                  <p className="text-[12px] text-foreground">{item.label}</p>
                  <p className="shrink-0 text-[11px] text-muted-foreground">
                    {format(new Date(item.at), "dd MMM yyyy HH:mm")}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </VendorFormSection>
    </div>
  );
}

function PaymentOpsDetail({
  workspace,
  payout,
  genAction,
  genPending,
  payAction,
  payPending,
  signedAction,
  signedPending,
  commAction,
  commPending,
  channel,
  setChannel,
  provider,
  setProvider,
}: {
  workspace: VendorWorkspace;
  payout: VendorPayoutRow;
  genAction: (payload: FormData) => void;
  genPending: boolean;
  payAction: (payload: FormData) => void;
  payPending: boolean;
  signedAction: (payload: FormData) => void;
  signedPending: boolean;
  commAction: (payload: FormData) => void;
  commPending: boolean;
  channel: string;
  setChannel: (v: string) => void;
  provider: string;
  setProvider: (v: string) => void;
}) {
  const ready = workspace.payment_readiness.ready;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <VendorFormSection
        icon={FileTextIcon}
        title="PO & Influencer Order"
        description="Reuse existing PO fields and Vendor IO generation."
      >
        <div className="space-y-3 text-[12px]">
          <div className="rounded-md border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Purchase order
            </p>
            {payout.po_number ? (
              <div className="mt-1 space-y-1">
                <p className="font-medium">Issued · {payout.po_number}</p>
                <p className="text-muted-foreground">
                  Status: {payout.po_status ?? "—"}
                  {payout.po_issue_date
                    ? ` · ${format(new Date(payout.po_issue_date), "dd MMM yyyy")}`
                    : ""}
                </p>
                {payout.campaign_id ? (
                  <Link
                    href={`/campaigns/${payout.campaign_id}?tab=overview`}
                    className="text-[var(--brand-product)] underline-offset-2 hover:underline"
                  >
                    View PO
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 font-medium text-muted-foreground">Not Issued</p>
            )}
          </div>

          <div className="rounded-md border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Influencer order (IO)
            </p>
            {payout.io ? (
              <div className="mt-1 space-y-1">
                <p className="font-medium">
                  Generated · {payout.io.document_number ?? payout.io.id.slice(0, 8)}
                </p>
                <p className="text-muted-foreground">
                  Version {payout.io.revision_number}
                  {payout.io.document_generated_at
                    ? ` · ${format(new Date(payout.io.document_generated_at), "dd MMM yyyy")}`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/ios/vendor/${payout.io.id}/preview`}
                    className="text-[var(--brand-product)] underline-offset-2 hover:underline"
                  >
                    View IO
                  </Link>
                </div>
                {payout.io_versions.length > 1 ? (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    <p className="text-[10px] uppercase text-muted-foreground">
                      Version history
                    </p>
                    {payout.io_versions.map((v) => (
                      <p key={v.id} className="text-muted-foreground">
                        v{v.revision_number}
                        {v.is_superseded ? " (previous)" : " (current)"} ·{" "}
                        {format(new Date(v.created_at), "dd MMM yyyy")}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-1 space-y-2">
                <p className="font-medium text-muted-foreground">Not Generated</p>
                {payout.campaign_id && payout.line_id ? (
                  <form action={genAction}>
                    <input type="hidden" name="campaign_id" value={payout.campaign_id} />
                    <input type="hidden" name="line_ids" value={payout.line_id} />
                    <Button type="submit" size="sm" disabled={genPending}>
                      Generate IO
                    </Button>
                  </form>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Assign a campaign line before generating IO.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </VendorFormSection>

      <VendorFormSection
        icon={LinkIcon}
        title="Signed IO"
        description="Upload is supported via IO documents; prefer external links (Drive / OneDrive / SharePoint / Dropbox)."
      >
        {payout.signed_io ? (
          <div className="mb-3 rounded-md border px-3 py-2 text-[12px]">
            <p className="font-medium capitalize">
              {payout.signed_io.artifact_kind.replace(/_/g, " ")}
              {payout.signed_io.provider ? ` · ${payout.signed_io.provider}` : ""}
            </p>
            <p className="text-muted-foreground">
              {payout.signed_io.file_name ?? "Signed artifact"}
              {" · "}
              {format(new Date(payout.signed_io.uploaded_at), "dd MMM yyyy")}
            </p>
            {payout.signed_io.url ? (
              <a
                href={payout.signed_io.url}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--brand-product)] underline-offset-2 hover:underline"
              >
                Open link
              </a>
            ) : null}
          </div>
        ) : (
          <p className="mb-3 text-[12px] text-muted-foreground">No signed IO on file.</p>
        )}

        {payout.io ? (
          <form action={signedAction} className="space-y-2">
            <input type="hidden" name="influencer_id" value={workspace.id} />
            <input type="hidden" name="vendor_io_id" value={payout.io.id} />
            <input type="hidden" name="assignment_id" value={payout.assignment_id} />
            <VendorFormGrid>
              <VendorFormField label="Provider">
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className={VENDOR_FORM_INPUT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_drive">Google Drive</SelectItem>
                    <SelectItem value="onedrive">OneDrive</SelectItem>
                    <SelectItem value="sharepoint">SharePoint</SelectItem>
                    <SelectItem value="dropbox">Dropbox</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="provider" value={provider} />
              </VendorFormField>
              <VendorFormField label="File name">
                <Input name="file_name" className={VENDOR_FORM_INPUT_CLASS} />
              </VendorFormField>
            </VendorFormGrid>
            <VendorFormField label="External URL">
              <Input
                name="url"
                type="url"
                required
                placeholder="https://"
                className={VENDOR_FORM_INPUT_CLASS}
              />
            </VendorFormField>
            <Button type="submit" size="sm" disabled={signedPending}>
              Link signed IO
            </Button>
          </form>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            Generate an IO before linking a signed copy.
          </p>
        )}
      </VendorFormSection>

      <VendorFormSection
        icon={MessageSquareIcon}
        title="Communication log"
        description="Manual logging now; channels prepared for future automatic sending."
      >
        <form action={commAction} className="space-y-2">
          <input type="hidden" name="influencer_id" value={workspace.id} />
          <input type="hidden" name="assignment_id" value={payout.assignment_id} />
          {payout.io ? (
            <input type="hidden" name="vendor_io_id" value={payout.io.id} />
          ) : null}
          <VendorFormField label="Channel">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className={VENDOR_FORM_INPUT_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMM_CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="channel" value={channel} />
          </VendorFormField>
          <VendorFormField label="Subject">
            <Input name="subject" className={VENDOR_FORM_INPUT_CLASS} />
          </VendorFormField>
          <VendorFormField label="Notes">
            <Textarea name="body" rows={3} className={VENDOR_FORM_TEXTAREA_CLASS} />
          </VendorFormField>
          <Button type="submit" size="sm" disabled={commPending}>
            Log communication
          </Button>
        </form>
      </VendorFormSection>

      <VendorFormSection
        icon={WalletIcon}
        title="Record payment"
        description="Blocked only by Payment Readiness — never by legal document gaps."
      >
        <form action={payAction} className="space-y-2">
          <input type="hidden" name="assignment_id" value={payout.assignment_id} />
          <input type="hidden" name="campaign_id" value={payout.campaign_id ?? ""} />
          <input
            type="hidden"
            name="batch_name"
            value={`CRM payout · ${workspace.display_name} · ${payout.campaign_name ?? "campaign"}`}
          />
          <input type="hidden" name="amount" value={String(payout.amount)} />
          <VendorFormField label="Notes">
            <Textarea name="notes" rows={2} className={VENDOR_FORM_TEXTAREA_CLASS} />
          </VendorFormField>
          {!ready ? (
            <p className="text-[12px] text-amber-800 dark:text-amber-200">
              Complete required bank fields before recording payment.
            </p>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={payPending || !ready || !payout.campaign_id || payout.status === "paid"}
          >
            {payout.status === "paid" ? "Already paid" : "Approve & record payment"}
          </Button>
        </form>
      </VendorFormSection>
    </div>
  );
}
