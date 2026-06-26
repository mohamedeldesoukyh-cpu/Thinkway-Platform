"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, ChevronDownIcon, CircleIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateClientOnboardingChecklistAction,
  overrideClientOnboardingStatusAction,
} from "@/features/clients/onboarding-actions";
import type { ClientOnboardingTimelineEvent } from "@/features/clients/onboarding-queries";
import { useDebouncedAutosave, type AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import {
  CLIENT_ONBOARDING_STATUSES,
  computeOnboardingProgress,
  ONBOARDING_STATUS_LABELS,
  type ClientOnboardingStatus,
  type OnboardingChecklistSection,
  type OnboardingCompletionFields,
} from "@/lib/clients/onboarding-status";
import { cn } from "@/lib/utils";

import { OnboardingStatusBadge } from "./onboarding-status-badge";

type OnboardingWorkspaceProps = {
  clientId: string;
  status: ClientOnboardingStatus;
  completion: OnboardingCompletionFields;
  activatedAt: string | null;
  timeline: ClientOnboardingTimelineEvent[];
  canEditChecklist: boolean;
  canOverrideStatus: boolean;
  className?: string;
  compact?: boolean;
  /** When true, checklist/override/timeline collapse behind a slim summary bar. */
  collapsible?: boolean;
  /** Initial expanded state when collapsible (defaults to collapsed). */
  defaultExpanded?: boolean;
};

type ChecklistState = Record<OnboardingChecklistSection, boolean>;

function completionToChecklist(completion: OnboardingCompletionFields): ChecklistState {
  return {
    legal: Boolean(completion.legal_completed_at),
    finance: Boolean(completion.finance_completed_at),
    contracts: Boolean(completion.contracts_completed_at),
    tax: Boolean(completion.tax_completed_at),
  };
}

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "saved") {
    return <span className="text-xs text-success">Saved</span>;
  }
  if (status === "saving" || status === "pending") {
    return <span className="text-xs text-muted-foreground">Saving…</span>;
  }
  if (status === "error") {
    return <span className="text-xs text-destructive">Save failed</span>;
  }
  return null;
}

function formatTimelineDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function OnboardingWorkspace({
  clientId,
  status: initialStatus,
  completion,
  activatedAt,
  timeline,
  canEditChecklist,
  canOverrideStatus,
  className,
  compact = false,
  collapsible = false,
  defaultExpanded = false,
}: OnboardingWorkspaceProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [checklist, setChecklist] = useState<ChecklistState>(() =>
    completionToChecklist(completion)
  );
  const [overrideStatus, setOverrideStatus] = useState<ClientOnboardingStatus>(initialStatus);
  const [overridePending, setOverridePending] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
    setOverrideStatus(initialStatus);
    setChecklist(completionToChecklist(completion));
  }, [initialStatus, completion]);

  const progress = computeOnboardingProgress({
    legal_completed_at: checklist.legal ? completion.legal_completed_at ?? new Date().toISOString() : null,
    finance_completed_at: checklist.finance ? completion.finance_completed_at ?? new Date().toISOString() : null,
    contracts_completed_at: checklist.contracts ? completion.contracts_completed_at ?? new Date().toISOString() : null,
    tax_completed_at: checklist.tax ? completion.tax_completed_at ?? new Date().toISOString() : null,
  });

  const saveChecklist = useCallback(
    async (payload: ChecklistState) => {
      const result = await updateClientOnboardingChecklistAction({
        client_id: clientId,
        ...payload,
      });
      if (result.ok && result.onboardingStatus) {
        setStatus(result.onboardingStatus);
        setOverrideStatus(result.onboardingStatus);
        router.refresh();
      }
      return { ok: result.ok, message: result.message };
    },
    [clientId, router]
  );

  const { status: saveStatus, schedule } = useDebouncedAutosave(saveChecklist);

  function toggleSection(section: OnboardingChecklistSection, checked: boolean) {
    const next = { ...checklist, [section]: checked };
    setChecklist(next);
    schedule(next);
  }

  async function applyManualOverride(next: ClientOnboardingStatus) {
    setOverridePending(true);
    try {
      const result = await overrideClientOnboardingStatusAction({
        client_id: clientId,
        status: next,
      });
      if (result.ok && result.onboardingStatus) {
        setStatus(result.onboardingStatus);
        setOverrideStatus(result.onboardingStatus);
        router.refresh();
      }
    } finally {
      setOverridePending(false);
    }
  }

  const sectionLabels: Record<OnboardingChecklistSection, string> = {
    legal: "Legal completed",
    finance: "Finance completed",
    contracts: "Contracts completed",
    tax: "Tax completed",
  };

  const fallbackTimeline: ClientOnboardingTimelineEvent[] = [];
  if (completion.legal_completed_at) {
    fallbackTimeline.push({
      id: "legal-fallback",
      kind: "legal_completed",
      label: "Legal completed",
      occurredAt: completion.legal_completed_at,
      actorName: null,
      previousStatus: null,
      newStatus: "finance_pending",
    });
  }
  if (completion.finance_completed_at) {
    fallbackTimeline.push({
      id: "finance-fallback",
      kind: "finance_completed",
      label: "Finance approved",
      occurredAt: completion.finance_completed_at,
      actorName: null,
      previousStatus: null,
      newStatus: "ready",
    });
  }
  if (activatedAt) {
    fallbackTimeline.push({
      id: "activated-fallback",
      kind: "activated",
      label: "Client activated",
      occurredAt: activatedAt,
      actorName: null,
      previousStatus: "ready",
      newStatus: "active",
    });
  }

  const displayTimeline =
    timeline.length > 0
      ? timeline
      : fallbackTimeline.sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );

  const progressBar = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted sm:h-2">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress.percentage}%` }}
          role="progressbar"
          aria-valuenow={progress.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progress.percentage}% onboarding complete`}
        />
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {progress.percentage}%
      </span>
    </div>
  );

  const checklistGrid = (
    <ul
      className={cn(
        "grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2",
        compact && "gap-y-1.5"
      )}
    >
      {progress.sections.map((section) => (
        <li key={section.id} className="flex items-center gap-2 text-sm">
          {canEditChecklist ? (
            <Checkbox
              id={`onboarding-${section.id}`}
              checked={checklist[section.id]}
              disabled={saveStatus === "saving"}
              onCheckedChange={(checked) =>
                toggleSection(section.id, checked === true)
              }
              aria-label={sectionLabels[section.id]}
            />
          ) : section.completed ? (
            <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden />
          ) : (
            <CircleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <Label
            htmlFor={canEditChecklist ? `onboarding-${section.id}` : undefined}
            className={cn(
              "font-normal",
              section.completed || checklist[section.id]
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {sectionLabels[section.id]}
          </Label>
        </li>
      ))}
    </ul>
  );

  const expandedDetails = (
    <>
      {!compact ? (
        <p className="text-xs text-muted-foreground">
          Complete legal, finance, contracts, and tax before activating for campaigns.
        </p>
      ) : null}

      {checklistGrid}

      {canOverrideStatus ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="onboarding-status-override" className="text-xs text-muted-foreground">
              Manual status override
            </Label>
            <Select
              value={overrideStatus}
              onValueChange={(value) => {
                const next = value as ClientOnboardingStatus;
                setOverrideStatus(next);
                void applyManualOverride(next);
              }}
              disabled={overridePending}
            >
              <SelectTrigger id="onboarding-status-override" className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_ONBOARDING_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ONBOARDING_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {displayTimeline.length > 0 ? (
        <div className="border-t border-border pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline
          </h4>
          <ol className="mt-2 space-y-1.5">
            {displayTimeline.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{event.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimelineDate(event.occurredAt)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </>
  );

  if (collapsible) {
    return (
      <section
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-card",
          className
        )}
        aria-label="Client onboarding progress"
      >
        <details className="group" {...(defaultExpanded ? { open: true } : {})}>
          <summary className="cursor-pointer list-none px-3 py-2.5 marker:content-none sm:px-4 sm:py-3 [&::-webkit-details-marker]:hidden">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h3
                    className={cn(
                      "font-semibold text-foreground",
                      compact ? "text-sm" : "text-[15px]"
                    )}
                  >
                    Onboarding progress
                  </h3>
                  <ChevronDownIcon
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </div>
                <div className="flex items-center gap-2">
                  {canEditChecklist ? <SaveIndicator status={saveStatus} /> : null}
                  <OnboardingStatusBadge status={status} />
                </div>
              </div>
              {progressBar}
            </div>
          </summary>
          <div className="space-y-3 border-t border-border px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
            {expandedDetails}
          </div>
        </details>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        compact && "p-3",
        className
      )}
      aria-label="Client onboarding progress"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
            Onboarding progress
          </h3>
          {!compact ? (
            <p className="text-xs text-muted-foreground">
              Complete legal, finance, contracts, and tax before activating for campaigns.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canEditChecklist ? <SaveIndicator status={saveStatus} /> : null}
          <OnboardingStatusBadge status={status} />
        </div>
      </div>

      <div className="mt-3">{progressBar}</div>

      <div className={cn("mt-3", compact && "mt-2")}>{checklistGrid}</div>

      {canOverrideStatus ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="onboarding-status-override" className="text-xs text-muted-foreground">
              Manual status override
            </Label>
            <Select
              value={overrideStatus}
              onValueChange={(value) => {
                const next = value as ClientOnboardingStatus;
                setOverrideStatus(next);
                void applyManualOverride(next);
              }}
              disabled={overridePending}
            >
              <SelectTrigger id="onboarding-status-override" className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_ONBOARDING_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ONBOARDING_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {displayTimeline.length > 0 ? (
        <div className="mt-4 border-t border-border pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline
          </h4>
          <ol className="mt-2 space-y-2">
            {displayTimeline.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{event.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimelineDate(event.occurredAt)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
