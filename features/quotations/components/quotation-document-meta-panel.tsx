"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import type { AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import {
  QUOTATION_DEPARTMENTS,
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUSES,
  QUOTATION_VERSION_PRESETS,
} from "@/features/quotations/constants";
import { useQuotationManualSave } from "@/features/quotations/components/quotation-manual-save";
import { formatConvertedQuotationValidityLabel } from "@/features/quotations/quotation-validity";
import type { QuotationDetail } from "@/features/quotations/types";
import type { QuotationStatus } from "@/types/database";
import { cn } from "@/lib/utils";

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "pending")
    return <span className="thinkway-campaign-badge thinkway-campaign-badge-amber">Unsaved</span>;
  if (status === "saved")
    return <span className="thinkway-campaign-badge thinkway-campaign-badge-green">Saved</span>;
  if (status === "saving")
    return <span className="text-[10px] text-[var(--camp-text-3)]">Saving…</span>;
  if (status === "error")
    return <span className="thinkway-campaign-badge thinkway-campaign-badge-red">Save failed</span>;
  return null;
}

function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("thinkway-campaign-field-label mb-1.5", className)}>{children}</div>
  );
}

function FlushLabel({ children }: { children: React.ReactNode }) {
  return <span className="dlbl">{children}</span>;
}

type Props = {
  detail: QuotationDetail;
  layout?: "default" | "flush";
};

export function QuotationDocumentMetaPanel({ detail, layout = "default" }: Props) {
  const flush = layout === "flush";
  const { registerMetaPending, saveStatus, hasUnsavedChanges } = useQuotationManualSave();
  const [preparedBy, setPreparedBy] = useState(detail.prepared_by_name ?? "");
  const [reviewedBy, setReviewedBy] = useState(detail.reviewed_by_name ?? "");
  const [clientSignatory, setClientSignatory] = useState(detail.client_signature_name ?? "");
  const [issueDate, setIssueDate] = useState(detail.issue_date);
  const [validityDate, setValidityDate] = useState(detail.validity_date ?? "");
  const [version, setVersion] = useState(detail.version);
  const [department, setDepartment] = useState(detail.department ?? "Influencer Marketing");
  const [changeSummary, setChangeSummary] = useState(detail.change_summary ?? "");
  const [status, setStatus] = useState<QuotationStatus>(detail.status);

  useEffect(() => {
    setPreparedBy(detail.prepared_by_name ?? "");
    setReviewedBy(detail.reviewed_by_name ?? "");
    setClientSignatory(detail.client_signature_name ?? "");
    setIssueDate(detail.issue_date);
    setValidityDate(detail.validity_date ?? "");
    setVersion(detail.version);
    setDepartment(detail.department ?? "Influencer Marketing");
    setChangeSummary(detail.change_summary ?? "");
    setStatus(detail.status);
  }, [
    detail.id,
    detail.prepared_by_name,
    detail.reviewed_by_name,
    detail.client_signature_name,
    detail.issue_date,
    detail.validity_date,
    detail.version,
    detail.department,
    detail.change_summary,
    detail.status,
  ]);

  function persist(patch: Parameters<typeof registerMetaPending>[0]) {
    registerMetaPending({
      prepared_by_name: preparedBy || null,
      reviewed_by_name: reviewedBy || null,
      client_signature_name: clientSignatory || null,
      issue_date: issueDate,
      validity_date: validityDate || null,
      version,
      department,
      change_summary: changeSummary || null,
      status,
      ...patch,
    });
  }

  const validityBadge = detail.is_expired ? (
    <span className="thinkway-campaign-badge thinkway-campaign-badge-red">Expired</span>
  ) : (
    <span className="thinkway-campaign-badge thinkway-campaign-badge-amber">
      {formatConvertedQuotationValidityLabel({
        validityDate: detail.validity_date,
        campaignHeaderId: detail.campaign_header_id,
        status: detail.status,
      })}
    </span>
  );

  const inputClass = flush ? "inp h-10 text-[13px]" : "h-8 text-xs";
  const selectTriggerClass = flush ? "inp h-10 text-[13px]" : "h-8 text-xs";
  const Label = flush ? FlushLabel : FieldLabel;

  const formFields = (
    <>
      <div className={flush ? "dgrid" : "thinkway-campaign-form-grid"}>
        <div className={flush ? "dfield" : undefined}>
          <Label>Issue date</Label>
          <Input
            type="date"
            className={inputClass}
            value={issueDate}
            onChange={(e) => {
              setIssueDate(e.target.value);
              persist({ issue_date: e.target.value });
            }}
          />
        </div>
        <div className={flush ? "dfield" : undefined}>
          <Label>Validity date</Label>
          <Input
            type="date"
            className={inputClass}
            value={validityDate}
            onChange={(e) => {
              setValidityDate(e.target.value);
              persist({ validity_date: e.target.value || null });
            }}
          />
        </div>
        <div className={flush ? "dfield" : undefined}>
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              const next = v as QuotationStatus;
              setStatus(next);
              persist({ status: next });
            }}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUOTATION_STATUSES.filter((s) => s !== "archived").map((s) => (
                <SelectItem key={s} value={s}>
                  {QUOTATION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={flush ? "dfield" : undefined}>
          <Label>Version</Label>
          <Select
            value={version}
            onValueChange={(v) => {
              setVersion(v);
              persist({ version: v, change_summary: changeSummary || "Version updated" });
            }}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUOTATION_VERSION_PRESETS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={flush ? "dfield col-span-2" : undefined}>
          <Label>Department</Label>
          <Select
            value={department}
            onValueChange={(v) => {
              setDepartment(v);
              persist({ department: v });
            }}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUOTATION_DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={flush ? "dfield" : undefined}>
          <Label>Prepared by</Label>
          <Input
            className={cn(inputClass, !preparedBy && flush && "muted placeholder:text-[var(--text-4)]")}
            value={preparedBy}
            placeholder="Add name"
            onChange={(e) => {
              setPreparedBy(e.target.value);
              persist({ prepared_by_name: e.target.value || null });
            }}
          />
        </div>
        <div className={flush ? "dfield" : undefined}>
          <Label>Reviewed by</Label>
          <Input
            className={cn(inputClass, !reviewedBy && flush && "placeholder:text-[var(--text-4)]")}
            value={reviewedBy}
            placeholder="Add name"
            onChange={(e) => {
              setReviewedBy(e.target.value);
              persist({ reviewed_by_name: e.target.value || null });
            }}
          />
        </div>
        <div className={flush ? "dfield" : undefined}>
          <Label>Client signatory</Label>
          <Input
            className={cn(inputClass, !clientSignatory && flush && "placeholder:text-[var(--text-4)]")}
            value={clientSignatory}
            placeholder="Add name"
            onChange={(e) => {
              setClientSignatory(e.target.value);
              persist({ client_signature_name: e.target.value || null });
            }}
          />
        </div>
      </div>

      <div className={flush ? "dfield mb-0" : "px-4 pb-4"}>
        <Label>Change summary</Label>
        <Textarea
          rows={flush ? 3 : 2}
          className={flush ? "ta text-[13px]" : "text-xs"}
          value={changeSummary}
          placeholder="Brief note for revision history…"
          onChange={(e) => {
            setChangeSummary(e.target.value);
            persist({ change_summary: e.target.value || null });
          }}
        />
      </div>

      {detail.revisions.length > 0 ? (
        flush ? (
          detail.revisions.slice(0, 5).map((rev) => (
            <div key={rev.id} className="revline">
              <b>
                {rev.version}
                {rev.change_summary ? ` · ${rev.change_summary}` : " · Initial quotation created"}
              </b>
              <span className="dt">{new Date(rev.created_at).toLocaleDateString("en-GB")}</span>
              <br />
              <span className="text-[11px]">{rev.updated_by_name ?? "—"}</span>
            </div>
          ))
        ) : (
          <div className="border-t border-[var(--camp-border)]">
            {detail.revisions.slice(0, 5).map((rev) => (
              <div key={rev.id} className="thinkway-campaign-activity-item">
                <div>
                  <div className="thinkway-campaign-act-name">
                    {rev.version}
                    {rev.change_summary ? ` · ${rev.change_summary}` : " · Initial quotation created"}
                  </div>
                  <div className="thinkway-campaign-act-by">{rev.updated_by_name ?? "—"}</div>
                </div>
                <span className="thinkway-campaign-act-date">
                  {new Date(rev.created_at).toLocaleDateString("en-GB")}
                </span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </>
  );

  if (flush) {
    return <div>{formFields}</div>;
  }

  return (
    <CampaignFlatSection
      title="Document details"
      description="Version, ownership, and validity."
      actions={
        <div className="flex items-center gap-2">
          {validityBadge}
          {hasUnsavedChanges ? <SaveIndicator status={saveStatus} /> : null}
        </div>
      }
      flushBody
    >
      {formFields}
    </CampaignFlatSection>
  );
}
