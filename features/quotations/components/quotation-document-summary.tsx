"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QuotationDocumentMetaPanel } from "./quotation-document-meta-panel";
import { useQuotationManualSave } from "./quotation-manual-save";
import { QuotationText } from "./quotation-design-locale";
import { ChangeQuotationClientDialog } from "./change-quotation-client-dialog";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import type { QuotationDetail, PromoteWizardOptions } from "../types";

function Values({ values }: { values: Array<[string, React.ReactNode]> }) {
  return <div className="kv">{values.map(([label, value]) => <div key={label}><u><QuotationText>{label}</QuotationText></u><b>{value || "Not set"}</b></div>)}</div>;
}

export function QuotationDocumentSummary({ detail }: { detail: QuotationDetail }) {
  const [editing, setEditing] = useState(false);
  const save = useQuotationManualSave();
  const pending = save.getMetaPending();
  const current = { ...detail, ...pending };
  return <section id="quotation-document" className="card q-section-target">
    <div className="card__h"><h2><QuotationText>Document details</QuotationText></h2><span className="sp" />
      <span className="chip chip--round">{current.version}</span><span className="chip chip--round">Lifecycle: {current.status.replaceAll("_", " ")}</span>
      {detail.canManage && <button type="button" className="b" onClick={() => setEditing(true)}>Edit details</button>}
      <p>Lifecycle status is the document’s state with the client. It is not the per-line save status in the grid.</p>
    </div>
    <div className="card__b"><Values values={[
      ["Quotation number", formatDocumentNumberForDisplay(detail.serial_number)], ["Issue date", current.issue_date],
      ["Valid until", current.validity_date], ["Version", current.version], ["Department", current.department],
      ["Prepared by", current.prepared_by_name], ["Reviewed by", current.reviewed_by_name], ["Client signatory", current.client_signature_name],
      ["Linked shortlist", detail.shortlist_serial ? formatDocumentNumberForDisplay(detail.shortlist_serial) : "Not linked"],
      ["Campaign", detail.campaign_name || "Not linked"], ["Snapshot", detail.sync_enabled ? "Live sync" : "Locked"],
    ]} />
      <h3 className="q-history-heading">Change history</h3><div className="qx-timeline">
        {detail.revisions.length ? detail.revisions.map(revision => <div className="qx-timeline__i" key={revision.id}><time>{new Date(revision.created_at).toLocaleDateString("en-GB")}</time><b>{revision.updated_by_name || "Not set"}</b><span>{revision.version} · {revision.change_summary || "Initial quotation created"}</span></div>) : <p className="q-help">No revisions recorded.</p>}
      </div>
    </div>
    <Dialog open={editing} onOpenChange={setEditing}><DialogContent className="tq-redesign qx q-redesign-body q-document-edit" data-shortcut-pane>
      <DialogTitle>Document details</DialogTitle><DialogDescription>Changes are staged for quotation Save.</DialogDescription>
      <QuotationDocumentMetaPanel detail={detail} layout="flush" />
      <button type="button" className="b b--pri" onClick={() => setEditing(false)}>Done</button>
    </DialogContent></Dialog>
  </section>;
}

export function QuotationClientSummary({ detail, options }: { detail: QuotationDetail; options: PromoteWizardOptions }) {
  const save = useQuotationManualSave();
  return <section id="quotation-client" className="card q-section-target">
    <div className="card__h"><h2><QuotationText>Client &amp; brand</QuotationText></h2><span className="sp" />
      {detail.canManage && !detail.is_archived && !["approved", "archived", "cancelled"].includes(detail.status) && <ChangeQuotationClientDialog detail={detail} options={options} disabled={save.hasUnsavedChanges || save.savePending} />}
    </div>
    <div className="card__b"><Values values={[
      ["Client", detail.is_temporary_client ? detail.temporary_client_name : detail.client_name],
      ["Brand", detail.is_temporary_brand ? detail.temporary_brand_name : detail.brand_name],
      ["Group", detail.group_name], ["Agency", detail.agency_name], ["Campaign", detail.campaign_name || "Not linked"],
    ]} /></div>
  </section>;
}
