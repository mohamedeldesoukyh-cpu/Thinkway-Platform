"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  canCreateCampaignFromQuotation,
  canGenerateQuotationVersion,
} from "@/lib/commercial-sync/rules";
import {
  createCampaignFromQuotation,
  generateQuotationVersion,
  getQuotationLifecycleActivity,
  moveQuotationToShortlist,
  promoteQuotationToMasterData,
} from "@/features/quotations/lifecycle-actions";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { QuotationDetail } from "@/features/quotations/types";

type ActivityEvent = {
  id: string;
  action: string;
  summary: string;
  created_at: string;
  actor_name: string | null;
};

type Props = {
  detail: QuotationDetail;
  groupOptions: Array<{ id: string; name: string }>;
};

export function QuotationLifecyclePanel({ detail, groupOptions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"links" | "activity">("links");
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [versionOpen, setVersionOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [groupId, setGroupId] = useState(groupOptions[0]?.id ?? "");

  useEffect(() => {
    if (tab !== "activity") return;
    void getQuotationLifecycleActivity(detail.id).then((res) => {
      if (res.ok && res.data) setActivity(res.data.events);
    });
  }, [tab, detail.id]);

  const canMoveToShortlist = !detail.shortlist_id && detail.canManage;
  const canGenerateVersion =
    detail.canManage && canGenerateQuotationVersion(detail.status);
  const canCreateCampaign =
    detail.canManage && canCreateCampaignFromQuotation(detail.status);
  const canPromote =
    detail.canManage &&
    (detail.is_temporary_client || detail.is_temporary_brand) &&
    groupOptions.length > 0;

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
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Commercial lifecycle</h3>
        <div
          className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
          role="tablist"
          aria-label="Lifecycle sections"
        >
          {(["links", "activity"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${
                tab === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
              onClick={() => setTab(key)}
            >
              {key === "links" ? "Links & actions" : "Activity"}
            </button>
          ))}
        </div>
      </div>

      {tab === "links" ? (
        <>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Linked shortlist
              </p>
              {detail.shortlist_id ? (
                <Link
                  href={`/discovery/shortlists/${detail.shortlist_id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {detail.shortlist_serial ?? detail.shortlist_id}
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">Not linked</p>
              )}
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Linked campaign
              </p>
              {detail.campaign_header_id ? (
                <Link
                  href={`/campaigns/${detail.campaign_header_id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {detail.campaign_document_number ?? detail.campaign_header_id}
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">Not linked</p>
              )}
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Versions
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {detail.version_chain.map((v) => (
                  <Link key={v.id} href={quotationDetailPath(v.id)}>
                    <Badge
                      variant={v.id === detail.id ? "default" : "outline"}
                      className="font-mono text-[10px]"
                    >
                      V{v.version_number}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {detail.sync_enabled ? (
              <Badge variant="secondary" className="text-[10px]">
                Live sync enabled
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Snapshot locked
              </Badge>
            )}
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
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => createCampaignFromQuotation({ quotationId: detail.id }))
                }
              >
                Create campaign
              </Button>
            ) : null}
            {canPromote ? (
              <Button size="sm" variant="secondary" onClick={() => setPromoteOpen(true)}>
                Promote to master data
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {activity.length === 0 ? (
            <li className="text-xs text-muted-foreground">No lifecycle activity yet.</li>
          ) : (
            activity.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2"
              >
                <p>{event.summary}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {event.actor_name ?? "System"} ·{" "}
                  {new Date(event.created_at).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>
      )}

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

      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to master data</DialogTitle>
            <DialogDescription>
              Creates legal entity &quot;{detail.temporary_client_name}&quot; and brand
              &quot;{detail.temporary_brand_name}&quot; in the selected group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Group</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              disabled={pending || !groupId}
              onClick={() =>
                run(async () => {
                  const res = await promoteQuotationToMasterData({
                    quotationId: detail.id,
                    groupId,
                  });
                  if (res.ok) setPromoteOpen(false);
                  return res;
                })
              }
            >
              Promote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
