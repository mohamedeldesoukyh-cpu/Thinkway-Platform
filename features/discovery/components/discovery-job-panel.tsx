"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  jobFeedbackTone,
  jobOutcomeLabel,
  jobStatusLabel,
  jobSummaryMessage,
} from "@/features/discovery/components/discovery-job-feedback";
import type { DiscoveryJobRow } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

type Props = {
  activeJobId: string | null;
  recentJobs: DiscoveryJobRow[];
  onJobUpdate?: (job: DiscoveryJobRow) => void;
};

const TONE_STYLES = {
  neutral: "border-border/60 bg-muted/20",
  success: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  error: "border-destructive/30 bg-destructive/5",
  info: "border-sky-500/30 bg-sky-500/5",
} as const;

export function DiscoveryJobPanel({ activeJobId, recentJobs, onJobUpdate }: Props) {
  const [activeJob, setActiveJob] = useState<DiscoveryJobRow | null>(null);

  useEffect(() => {
    if (!activeJobId) return;

    let cancelled = false;

    const poll = async () => {
      const res = await fetch(`/api/discovery/jobs/${activeJobId}`);
      if (!res.ok || cancelled) return;
      const job = (await res.json()) as DiscoveryJobRow;
      if (cancelled) return;
      setActiveJob(job);
      onJobUpdate?.(job);
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId, onJobUpdate]);

  const displayJob =
    activeJob ?? (activeJobId ? recentJobs.find((job) => job.id === activeJobId) ?? null : null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Crawl activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayJob ? (
          <ActiveJobCard job={displayJob} />
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Run a discovery job to see live status, counts, and crawl logs.
          </p>
        )}

        {recentJobs.length > 0 ? (
          <div className="space-y-2 border-t border-border/40 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Recent jobs
            </p>
            <ul className="space-y-1.5">
              {recentJobs.slice(0, 5).map((job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-2 py-1.5 text-[11px]"
                >
                  <span className="truncate">
                    {job.method ?? job.job_type.replace("discovery:", "")}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="tabular-nums text-muted-foreground">
                      +{job.profiles_discovered}
                    </span>
                    <StatusDot status={job.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActiveJobCard({ job }: { job: DiscoveryJobRow }) {
  const tone = jobFeedbackTone(job);
  const result = job.result;
  const logs = result?.logs ?? [];

  return (
    <div className={cn("space-y-2 rounded-lg border p-3", TONE_STYLES[tone])}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {jobStatusLabel(job.status)}
            </Badge>
            {result?.outcome ? (
              <Badge variant="secondary" className="text-[10px]">
                {jobOutcomeLabel(result.outcome)}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed">{jobSummaryMessage(job)}</p>
        </div>
        <JobStatusIcon status={job.status} outcome={result?.outcome} />
      </div>

      <dl className="grid grid-cols-2 gap-2 text-[11px]">
        <Metric label="Profiles added" value={result?.profiles_added ?? job.profiles_discovered} />
        <Metric label="Live crawl" value={result?.crawl_discovered ?? "—"} />
        <Metric label="Sample seed" value={result?.seed_count ?? (result?.seeded ? "Yes" : "—")} />
        <Metric
          label="Success / fail"
          value={`${job.status === "completed" ? 1 : 0} / ${job.status === "failed" ? 1 : 0}`}
        />
      </dl>

      {job.error_message || result?.crawl_error ? (
        <p className="text-[11px] text-destructive">
          {job.error_message ?? result?.crawl_error}
        </p>
      ) : null}

      {logs.length > 0 ? (
        <div className="max-h-28 space-y-1 overflow-y-auto rounded-md bg-background/60 p-2">
          {logs.slice(-6).map((entry, index) => (
            <p key={`${entry.at}-${index}`} className="text-[10px] text-muted-foreground">
              <span className="uppercase">{entry.level}</span> · {entry.message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function JobStatusIcon({
  status,
  outcome,
}: {
  status: DiscoveryJobRow["status"];
  outcome?: string;
}) {
  if (status === "running" || status === "pending") {
    return <Loader2Icon className="size-4 shrink-0 animate-spin text-sky-500" />;
  }
  if (status === "failed" || outcome === "crawl_blocked") {
    return <XCircleIcon className="size-4 shrink-0 text-destructive" />;
  }
  if (outcome === "partial_success" || outcome === "seeded_fallback") {
    return <AlertTriangleIcon className="size-4 shrink-0 text-amber-500" />;
  }
  return <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />;
}

function StatusDot({ status }: { status: DiscoveryJobRow["status"] }) {
  if (status === "running" || status === "pending") {
    return <Loader2Icon className="size-3 animate-spin text-sky-500" />;
  }
  if (status === "failed") {
    return <XCircleIcon className="size-3 text-destructive" />;
  }
  if (status === "completed") {
    return <CheckCircle2Icon className="size-3 text-emerald-500" />;
  }
  return <CircleDashedIcon className="size-3 text-muted-foreground" />;
}
