"use client";

import { useActionState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientIoAmendmentAction } from "@/features/io/actions";

export function ClientIoCreateAmendment({ clientIoId, campaignHeaderId }: {
  clientIoId: string;
  campaignHeaderId: string;
}) {
  const [state, action, pending] = useActionState(createClientIoAmendmentAction, { ok: false });
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const openedAmendment = useRef<string | null>(null);
  useEffect(() => {
    if (!state.message) return;
    if (!state.ok || !state.amendmentId) { toast.error(state.message); return; }
    if (openedAmendment.current === state.amendmentId) return;
    openedAmendment.current = state.amendmentId;
    toast.success(state.message);
    const next = new URLSearchParams(query);
    next.set("io", state.amendmentId);
    // Open the new draft in its campaign, including when started from the IO register.
    next.set("tab", "client-io");
    const target = pathname.startsWith("/campaigns/") ? pathname : `/campaigns/${campaignHeaderId}`;
    router.replace(`${target}?${next.toString()}`, { scroll: false });
    router.refresh();
  }, [state, router, pathname, query, campaignHeaderId]);
  return <form action={action} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-foreground dark:border-amber-900 dark:bg-amber-950/30">
    <input type="hidden" name="id" value={clientIoId} />
    <input type="hidden" name="campaign_header_id" value={campaignHeaderId} />
    <p className="text-sm font-medium">Update the creators in this Client IO</p>
    <p className="text-xs text-muted-foreground">The issued version stays unchanged. Create a draft amendment, select the remaining and new assignments, save your selection, then generate and send it for client approval.</p>
    <Input name="reason" aria-label="Amendment reason" placeholder="Reason for amendment (optional)" disabled={pending || state.ok} />
    <Button type="submit" disabled={pending || state.ok}>{pending ? "Creating amendment…" : state.ok ? "Opening amendment…" : "Create amendment & edit assignments"}</Button>
  </form>;
}
