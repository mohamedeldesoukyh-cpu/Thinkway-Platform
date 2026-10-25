"use client";
import { useState } from "react";
import { toast } from "sonner";
export function ReviewScheduleDownload({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  async function download(format: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/review-schedule.${format}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not download the schedule. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a"); a.href = url;
      a.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `review-schedule.${format}`;
      a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Download unavailable."); }
    finally { setBusy(false); }
  }
  return <select className="tw-b sm" aria-label="Download review schedule" value="" disabled={busy} onChange={e => { if(e.target.value) void download(e.target.value); }}><option value="">{busy ? "Preparing…" : "Download schedule"}</option><option value="pdf">PDF</option><option value="xlsx">Excel</option><option value="html">HTML</option></select>;
}
