"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, RadarIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { OperationalTableSearchField } from "@/components/tables/operational-table-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addToShortlistAction,
  enrichDiscoveredProfileAction,
  matchCampaignBriefAction,
  startDiscoveryJobAction,
} from "@/features/discovery/actions";
import { DiscoveryJobPanel } from "@/features/discovery/components/discovery-job-panel";
import {
  isTerminalJobStatus,
  jobSummaryMessage,
} from "@/features/discovery/components/discovery-job-feedback";
import { DiscoveryProfileCard } from "@/features/discovery/components/discovery-profile-card";
import type {
  CampaignMatchResult,
  DiscoveryJobRow,
  DiscoveryJobStats,
  DiscoverySearchResult,
} from "@/lib/discovery/types";
import { DISCOVERY_PLATFORMS } from "@/lib/discovery/types";

type Props = {
  initialResults: DiscoverySearchResult;
  stats: DiscoveryJobStats;
  shortlists: Array<{ id: string; name: string }>;
  recentJobs: DiscoveryJobRow[];
};

const DISCOVERY_PRESETS = [
  { method: "hashtag" as const, label: "Hashtag crawl", hashtag: "fashion" },
  { method: "hashtag" as const, label: "Beauty hashtag", hashtag: "beauty" },
  { method: "location" as const, label: "UAE creators", country: "AE", query: "dubai" },
  { method: "trend" as const, label: "TikTok trend", trend: "viral" },
];

export function DiscoveryWorkspace({
  initialResults,
  stats: initialStats,
  shortlists,
  recentJobs: initialRecentJobs,
}: Props) {
  const router = useRouter();
  const [results, setResults] = useState(initialResults);
  const [stats, setStats] = useState(initialStats);
  const [recentJobs, setRecentJobs] = useState(initialRecentJobs);
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("");
  const [country, setCountry] = useState("");
  const [brief, setBrief] = useState("");
  const [matches, setMatches] = useState<CampaignMatchResult[]>([]);
  const [selectedShortlist, setSelectedShortlist] = useState(shortlists[0]?.id ?? "");
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const handledTerminalJobs = useRef<Set<string>>(new Set());

  const refreshRecentJobs = useCallback(async () => {
    const res = await fetch("/api/discovery/jobs?limit=8");
    if (!res.ok) return;
    const data = (await res.json()) as { jobs: DiscoveryJobRow[] };
    setRecentJobs(data.jobs);
  }, []);

  const runSearch = useCallback(() => {
    startTransition(async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (platform) params.set("platform", platform);
      if (country.trim()) params.set("country", country.trim());
      const res = await fetch(`/api/discovery/search?${params.toString()}`);
      const data = (await res.json()) as DiscoverySearchResult;
      setResults(data);
    });
  }, [q, platform, country]);

  const handleJobUpdate = useCallback(
    (job: DiscoveryJobRow) => {
      setRecentJobs((current) => {
        const exists = current.some((row) => row.id === job.id);
        if (exists) {
          return current.map((row) => (row.id === job.id ? job : row));
        }
        return [job, ...current].slice(0, 8);
      });

      if (!isTerminalJobStatus(job.status)) return;
      if (handledTerminalJobs.current.has(job.id)) return;
      handledTerminalJobs.current.add(job.id);

      const added = job.result?.profiles_added ?? job.profiles_discovered ?? 0;
      if (job.status === "completed") {
        toast.success(jobSummaryMessage(job));
        setStats((current) => ({
          ...current,
          profiles: current.profiles + added,
          completedJobs: current.completedJobs + 1,
          runningJobs: Math.max(0, current.runningJobs - 1),
          profilesAddedToday: current.profilesAddedToday + added,
        }));
        runSearch();
        router.refresh();
      } else {
        toast.error(job.error_message ?? "Discovery job failed");
        setStats((current) => ({
          ...current,
          failedJobs: current.failedJobs + 1,
          runningJobs: Math.max(0, current.runningJobs - 1),
        }));
      }

      void refreshRecentJobs();
    },
    [refreshRecentJobs, router, runSearch]
  );

  const startDiscoveryJob = (payload: Parameters<typeof startDiscoveryJobAction>[0]) => {
    startTransition(async () => {
      try {
        const response = await startDiscoveryJobAction(payload);
        if (!response.queued) {
          toast.error("Job saved but worker queue unavailable — check REDIS_URL.");
        } else {
          toast.info("Crawl started — tracking progress below.");
        }
        setActiveJobId(response.jobId);
        setStats((current) => ({
          ...current,
          runningJobs: current.runningJobs + 1,
        }));
        await refreshRecentJobs();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to start discovery job");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Discovered profiles" value={stats.profiles} />
        <StatCard label="Running jobs" value={stats.runningJobs} />
        <StatCard label="Completed jobs" value={stats.completedJobs} />
        <StatCard label="Failed jobs" value={stats.failedJobs} />
        <StatCard label="Added today" value={stats.profilesAddedToday} />
        <StatCard label="Saved shortlists" value={stats.shortlists} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <RadarIcon className="size-4 text-[var(--brand-product)]" />
            Discovery search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <OperationalTableSearchField
              value={q}
              onChange={setQ}
              onClear={() => setQ("")}
              placeholder="Search creators, bio, niche, city…"
            />
            <select
              className="h-8 rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground hover:bg-muted/40"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              aria-label="Platform"
            >
              <option value="">All platforms</option>
              {DISCOVERY_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Input
              className="h-8 w-24 text-xs"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
            />
            <Button size="sm" onClick={runSearch} disabled={isPending}>
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : "Search"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {results.total} profiles · merged internal + public discovery search
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {results.profiles.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No discovered profiles yet. Start a discovery job — sample creators load automatically
                if live crawling is empty or blocked.
              </CardContent>
            </Card>
          ) : (
            results.profiles.map((profile) => (
              <DiscoveryProfileCard
                key={profile.id}
                profile={profile}
                enriching={enrichingId === profile.id}
                onEnrich={(id) => {
                  setEnrichingId(id);
                  startTransition(async () => {
                    try {
                      const response = await enrichDiscoveredProfileAction(id);
                      setActiveJobId(response.jobId);
                      if (!response.queued) {
                        toast.error("Enrichment queued in DB but Redis worker unavailable.");
                      } else {
                        toast.info("Enrichment started.");
                      }
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Enrichment failed to start"
                      );
                    } finally {
                      setEnrichingId(null);
                    }
                  });
                }}
                onSave={(id) => {
                  if (!selectedShortlist) {
                    toast.error("Select a shortlist first.");
                    return;
                  }
                  startTransition(async () => {
                    try {
                      await addToShortlistAction(selectedShortlist, id);
                      toast.success("Added to shortlist");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Shortlist save failed");
                    }
                  });
                }}
              />
            ))
          )}
        </div>

        <div className="space-y-4">
          <DiscoveryJobPanel
            activeJobId={activeJobId}
            recentJobs={recentJobs}
            onJobUpdate={handleJobUpdate}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Run discovery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {DISCOVERY_PRESETS.map((job) => (
                <Button
                  key={job.label}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  disabled={isPending}
                  onClick={() =>
                    startDiscoveryJob({
                      method: job.method,
                      platform: job.method === "trend" ? "tiktok" : "instagram",
                      hashtag: "hashtag" in job ? job.hashtag : undefined,
                      locationCountry: "country" in job ? job.country : undefined,
                      locationQuery: "query" in job ? job.query : undefined,
                      trendKey: "trend" in job ? job.trend : undefined,
                    })
                  }
                >
                  {job.label}
                </Button>
              ))}
              <p className="pt-1 text-[10px] text-muted-foreground">
                Live crawl runs first. If it fails or finds nothing, realistic sample creators are
                seeded automatically for local testing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Shortlist</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                className="h-8 w-full rounded-lg border border-border/50 bg-transparent px-2 text-xs"
                value={selectedShortlist}
                onChange={(e) => setSelectedShortlist(e.target.value)}
                aria-label="Shortlist"
              >
                <option value="">Select shortlist</option>
                {shortlists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <SparklesIcon className="size-4" />
                AI campaign match
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="text-xs">Campaign brief</Label>
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Beauty launch in UAE, micro-influencers, high engagement…"
                className="min-h-[100px] text-xs"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!brief.trim() || isPending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const rows = await matchCampaignBriefAction({ brief, limit: 10 });
                      setMatches(rows);
                      if (rows.length === 0) {
                        toast.warning("No matches yet — run a discovery job to seed creators.");
                      } else {
                        toast.success(`Found ${rows.length} matched creator${rows.length === 1 ? "" : "s"}`);
                      }
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "AI match failed");
                    }
                  })
                }
              >
                Match influencers
              </Button>
              {matches.length > 0 ? (
                <ul className="space-y-2 pt-2">
                  {matches.map((m) => (
                    <li key={m.profile_id} className="rounded-lg bg-muted/30 p-2 text-[11px]">
                      <p className="font-medium">
                        @{m.username} · {m.match_score}
                      </p>
                      <p className="text-muted-foreground">{m.rationale}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
