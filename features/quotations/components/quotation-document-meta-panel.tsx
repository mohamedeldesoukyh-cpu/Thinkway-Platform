"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedAutosave, type AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import {
  QUOTATION_DEPARTMENTS,
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUSES,
  QUOTATION_VERSION_PRESETS,
} from "@/features/quotations/constants";
import { updateQuotationHeader } from "@/features/quotations/actions";
import { formatValidityLabel } from "@/features/quotations/quotation-validity";
import type { QuotationDetail } from "@/features/quotations/types";
import { cn } from "@/lib/utils";
import type { QuotationStatus } from "@/types/database";

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "saved")
    return <span className="text-xs text-success">Saved</span>;
  if (status === "saving")
    return <span className="text-xs text-muted-foreground">Saving…</span>;
  if (status === "error")
    return <span className="text-xs text-destructive">Save failed</span>;
  return null;
}

export function QuotationDocumentMetaPanel({ detail }: { detail: QuotationDetail }) {
  const [preparedBy, setPreparedBy] = useState(detail.prepared_by_name ?? "");
  const [reviewedBy, setReviewedBy] = useState(detail.reviewed_by_name ?? "");
  const [clientSignatory, setClientSignatory] = useState(detail.client_signature_name ?? "");
  const [issueDate, setIssueDate] = useState(detail.issue_date);
  const [validityDate, setValidityDate] = useState(detail.validity_date ?? "");
  const [version, setVersion] = useState(detail.version);
  const [department, setDepartment] = useState(detail.department ?? "Influencer Marketing");
  const [changeSummary, setChangeSummary] = useState(detail.change_summary ?? "");
  const [status, setStatus] = useState<QuotationStatus>(detail.status);

  const { status: saveStatus, schedule } = useDebouncedAutosave<
    Parameters<typeof updateQuotationHeader>[0]
  >(updateQuotationHeader);

  function persist(patch: Partial<Parameters<typeof updateQuotationHeader>[0]>) {
    schedule({
      id: detail.id,
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

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Document details</h3>
        <div className="flex items-center gap-2">
          {detail.is_expired ? (
            <Badge variant="destructive">Expired</Badge>
          ) : (
            <Badge variant="secondary">{formatValidityLabel(detail.validity_date)}</Badge>
          )}
          <SaveIndicator status={saveStatus} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Issue date">
          <Input
            type="date"
            value={issueDate}
            onChange={(e) => {
              setIssueDate(e.target.value);
              persist({ issue_date: e.target.value });
            }}
          />
        </Field>
        <Field label="Validity date">
          <Input
            type="date"
            value={validityDate}
            onChange={(e) => {
              setValidityDate(e.target.value);
              persist({ validity_date: e.target.value || null });
            }}
          />
        </Field>
        <Field label="Status">
          <Select
            value={status}
            onValueChange={(v) => {
              const next = v as QuotationStatus;
              setStatus(next);
              persist({ status: next });
            }}
          >
            <SelectTrigger>
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
        </Field>
        <Field label="Version">
          <Select
            value={version}
            onValueChange={(v) => {
              setVersion(v);
              persist({ version: v, change_summary: changeSummary || "Version updated" });
            }}
          >
            <SelectTrigger>
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
        </Field>
        <Field label="Department">
          <Select
            value={department}
            onValueChange={(v) => {
              setDepartment(v);
              persist({ department: v });
            }}
          >
            <SelectTrigger>
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
        </Field>
        <Field label="Prepared by">
          <Input
            value={preparedBy}
            onChange={(e) => {
              setPreparedBy(e.target.value);
              persist({ prepared_by_name: e.target.value || null });
            }}
          />
        </Field>
        <Field label="Reviewed by">
          <Input
            value={reviewedBy}
            onChange={(e) => {
              setReviewedBy(e.target.value);
              persist({ reviewed_by_name: e.target.value || null });
            }}
          />
        </Field>
        <Field label="Client signatory">
          <Input
            value={clientSignatory}
            onChange={(e) => {
              setClientSignatory(e.target.value);
              persist({ client_signature_name: e.target.value || null });
            }}
          />
        </Field>
        <Field label="Change summary" className="md:col-span-3">
          <Textarea
            rows={2}
            value={changeSummary}
            onChange={(e) => {
              setChangeSummary(e.target.value);
              persist({ change_summary: e.target.value || null });
            }}
            placeholder="Brief note for revision history…"
          />
        </Field>
      </div>

      {detail.revisions.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Revision history
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {detail.revisions.slice(0, 5).map((rev) => (
              <li key={rev.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                <span className="font-medium text-foreground">{rev.version}</span>
                <span>{rev.updated_by_name ?? "—"}</span>
                <span>{new Date(rev.created_at).toLocaleDateString("en-GB")}</span>
                {rev.change_summary ? (
                  <span className="text-foreground">— {rev.change_summary}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
