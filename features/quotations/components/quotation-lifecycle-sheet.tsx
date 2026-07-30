"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  canCreateCampaignFromQuotation,
  canGenerateQuotationVersion,
} from "@/lib/commercial-sync/rules";
import {
  generateQuotationVersion,
  getQuotationLifecycleActivity,
  moveQuotationToShortlist,
} from "@/features/quotations/lifecycle-actions";
import { ConvertQuotationDialog } from "@/features/quotations/components/convert-quotation-dialog";
import { PromoteMasterDataWizard } from "@/features/quotations/components/promote-master-data-wizard";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { PromoteWizardOptions, QuotationDetail } from "@/features/quotations/types";
import { cn } from "@/lib/utils";

type ActivityEvent = {
  id: string;
  action: string;
  summary: string;
  created_at: string;
  actor_name: string | null;
};

type Props = {
  detail: QuotationDetail;
  promoteOptions: PromoteWizardOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "links" | "activity";
};

export function QuotationLifecycleSheet({
  detail,
  promoteOptions,
  open,
  onOpenChange,
  defaultTab = "links",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"links" | "activity">(defaultTab);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [versionOpen, setVersionOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  useEffect(() => {
    if (!open || tab !== "activity") return;
    void getQuotationLifecycleActivity(detail.id).then((res) => {
      if (res.ok && res.data) setActivity(res.data.events);
    });
  }, [tab, detail.id, open]);

  const canMoveToShortlist = !detail.shortlist_id && detail.canManage;
  const canGenerateVersion =
    detail.canManage && canGenerateQuotationVersion(detail.status);
  const canCreateCampaign =
    detail.canManage && canCreateCampaignFromQuotation(detail.status);
  const canPromote =
    detail.canManage && (detail.is_temporary_client || detail.is_temporary_brand);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Done");
      router.refresh();
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="quotation-lifecycle w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Commercial lifecycle</SheetTitle>
            <SheetDescription>
              Linked entities, version actions, and activity history.
            </SheetDescription>
          </SheetHeader>

          <div
            className="mt-4 inline-flex rounded-full border border-[#e3e8f2] bg-[#f6f8fc] p-0.5"
            role="tablist"
            aria-label="Lifecycle sections"
          >
            {(["links", "activity"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  tab === key
                    ? "bg-white text-[#0d1220] shadow-sm"
                    : "text-[#9aa3b5] hover:text-[#6b7280]"
                )}
                onClick={() => setTab(key)}
              >
                {key === "links" ? "Links & actions" : "Activity"}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
            {tab === "links" ? (
              <>
                <div
                  className={cn(
                    "cgroup quotation-creator-card",
                    detail.shortlist_id
                      ? "quotation-creator-card--green"
                      : "quotation-creator-card--orange"
                  )}
                >
                  <div className="ql-card-inner">
                    <p className="ql-card-label">Linked shortlist</p>
                    {detail.shortlist_id ? (
                      <p className="ql-card-value">
                        <Link href={`/discovery/shortlists/${detail.shortlist_id}`}>
                          {detail.shortlist_serial ?? detail.shortlist_id}
                        </Link>
                      </p>
                    ) : (
                      <p className="ql-card-value ql-card-value--muted">Not linked</p>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    "cgroup quotation-creator-card",
                    detail.campaign_header_id
                      ? "quotation-creator-card--green"
                      : "quotation-creator-card--orange"
                  )}
                >
                  <div className="ql-card-inner">
                    <p className="ql-card-label">Linked campaign</p>
                    {detail.campaign_header_id ? (
                      <p className="ql-card-value">
                        <Link href={`/campaigns/${detail.campaign_header_id}`}>
                          {detail.campaign_document_number ?? detail.campaign_header_id}
                        </Link>
                      </p>
                    ) : (
                      <p className="ql-card-value ql-card-value--muted">Not linked</p>
                    )}
                  </div>
                </div>

                <div className="cgroup quotation-creator-card">
                  <div className="ql-card-inner">
                    <p className="ql-card-label">Versions</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {detail.version_chain.map((v) => (
                        <Link
                          key={v.id}
                          href={quotationDetailPath(v.id, v.serial_number)}
                          className={cn(
                            "shortlist-creator-status-pill inline-flex h-[21px] items-center rounded-full px-2.5 text-[10.5px] font-bold",
                            v.id === detail.id
                              ? "bg-[#1d9e75] text-white"
                              : "bg-[#f1f4fa] text-[#727d92]"
                          )}
                        >
                          V{v.version_number}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="cgroup quotation-creator-card">
                  <div className="ql-card-inner ql-actions-inner">
                    <span
                      className={cn(
                        "shortlist-creator-status-pill inline-flex h-[21px] items-center rounded-full px-2.5 text-[10.5px] font-bold",
                        detail.sync_enabled
                          ? "bg-[rgba(236,253,245,0.95)] text-[#1d9e75]"
                          : "bg-[#f1f4fa] text-[#727d92]"
                      )}
                    >
                      {detail.sync_enabled ? "Live sync enabled" : "Snapshot locked"}
                    </span>
                    {canMoveToShortlist ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => run(() => moveQuotationToShortlist(detail.id))}
                      >
                        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                        Move to shortlist
                      </Button>
                    ) : null}
                    {canGenerateVersion ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setVersionOpen(true)}
                      >
                        Generate V{detail.version_number + 1}
                      </Button>
                    ) : null}
                    {canCreateCampaign ? (
                      <Button size="sm" disabled={pending} onClick={() => setConvertOpen(true)}>
                        Convert to Campaign
                      </Button>
                    ) : null}
                    {detail.campaign_header_id ? (
                      <span className="shortlist-creator-status-pill inline-flex h-[21px] items-center rounded-full bg-[rgba(236,253,245,0.95)] px-2.5 text-[10.5px] font-bold text-[#1d9e75]">
                        Linked campaign
                      </span>
                    ) : null}
                    {canPromote ? (
                      <Button size="sm" variant="secondary" onClick={() => setPromoteOpen(true)}>
                        Promote to master data
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <ul className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
                {activity.length === 0 ? (
                  <li className="cgroup quotation-creator-card">
                    <div className="ql-card-inner">
                      <p className="ql-card-value ql-card-value--muted">
                        No lifecycle activity yet.
                      </p>
                    </div>
                  </li>
                ) : (
                  activity.map((event) => (
                    <li key={event.id} className="cgroup quotation-creator-card">
                      <div className="ql-card-inner">
                        <p className="m-0 font-medium text-[#0d1220]">{event.summary}</p>
                        <p className="m-0 mt-1 text-[10px] font-medium text-[#9aa3b5]">
                          {event.actor_name ?? "System"} ·{" "}
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate version V{detail.version_number + 1}</DialogTitle>
            <DialogDescription>
              Creates a new draft quotation inheriting all creators and commercials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="revision-notes">Revision notes</Label>
            <Textarea
              id="revision-notes"
              rows={3}
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="What changed in this revision?"
            />
          </div>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await generateQuotationVersion({
                    quotationId: detail.id,
                    revisionNotes,
                  });
                  if (res.ok) setVersionOpen(false);
                  return res;
                })
              }
            >
              Generate version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PromoteMasterDataWizard
        detail={detail}
        options={promoteOptions}
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
      />

      <ConvertQuotationDialog
        detail={detail}
        open={convertOpen}
        onOpenChange={setConvertOpen}
      />
    </>
  );
}
