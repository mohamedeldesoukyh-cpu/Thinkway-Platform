"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import {
  updateDiscoveryControlSettingsAction,
  type DiscoverySettingsActionState,
} from "@/features/discovery/control-center/actions";
import type { DiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-types";

const INITIAL_STATE: DiscoverySettingsActionState = { ok: false };

type RadioOption = {
  value: string;
  label: string;
  description: string;
};

function PolicyRadioGroup({
  name,
  value,
  options,
}: {
  name: string;
  value: string;
  options: RadioOption[];
}) {
  return (
    <div className="grid gap-3">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 p-3 transition-colors hover:border-[#1D9E75]/40"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={value === option.value}
            className="mt-1 accent-[#1D9E75]"
          />
          <span className="grid gap-1">
            <span className="text-sm font-medium text-foreground">{option.label}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              {option.description}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function DiscoveryEngineSettingsSection({
  settings,
}: {
  settings: DiscoveryControlSettings;
}) {
  const [state, formAction, pending] = useActionState(
    updateDiscoveryControlSettingsAction,
    INITIAL_STATE
  );

  const isHybrid = settings.discoverySource === "hybrid";

  return (
    <form action={formAction} className="grid gap-6">
      <OperationalFormSection
        title="Discovery source"
        description="Controls where creator candidates originate before enrichment and ranking."
      >
        <PolicyRadioGroup
          name="discoverySource"
          value={settings.discoverySource}
          options={[
            {
              value: "platform_database_only",
              label: "Platform database only",
              description:
                "Search operational influencers and imported discovery profiles only. Apify live fetch is never triggered.",
            },
            {
              value: "hybrid",
              label: "Hybrid (database-first)",
              description:
                "Query the platform database first. When coverage is insufficient, enqueue Apify backfill up to the coverage threshold.",
            },
            {
              value: "apify_live_only",
              label: "Apify live only",
              description:
                "Prioritize live Apify discovery. Database results are secondary or merged after live fetch depending on search priority.",
            },
          ]}
        />
      </OperationalFormSection>

      <OperationalFormSection
        title="Search priority"
        description="Order of operations when hybrid or live modes are active."
      >
        <PolicyRadioGroup
          name="searchPriority"
          value={settings.searchPriority}
          options={[
            {
              value: "database_first",
              label: "Database first",
              description: "Evaluate platform coverage before any live Apify backfill.",
            },
            {
              value: "apify_first",
              label: "Apify first",
              description: "Trigger live discovery before or alongside database merge (apify_live_only).",
            },
          ]}
        />
      </OperationalFormSection>

      <OperationalFormSection
        title="Coverage threshold"
        description="Minimum coverage score (0–100) before hybrid mode skips Apify backfill."
        actions={
          !isHybrid ? (
            <Badge variant="secondary">Hybrid mode only</Badge>
          ) : (
            <Badge className="bg-[#1D9E75] text-white hover:bg-[#1D9E75]/90">
              {settings.coverageThreshold}
            </Badge>
          )
        }
      >
        <div className="grid max-w-md gap-2">
          <Label htmlFor="coverageThreshold">Threshold</Label>
          <input
            id="coverageThreshold"
            name="coverageThreshold"
            type="range"
            min={0}
            max={100}
            step={5}
            defaultValue={settings.coverageThreshold}
            disabled={!isHybrid}
            className="w-full accent-[#1D9E75] disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">
            Default 80 — matches Release 1.2 hybrid behavior. Lower values trigger Apify sooner.
          </p>
        </div>
      </OperationalFormSection>

      <OperationalFormSection
        title="Automatic enrichment"
        description="When creators are enriched automatically (manual refresh is always governed separately)."
      >
        <PolicyRadioGroup
          name="automaticEnrichment"
          value={settings.automaticEnrichment}
          options={[
            {
              value: "never",
              label: "Never",
              description: "No automatic enrichment triggers. Matches current production default.",
            },
            {
              value: "shortlisted",
              label: "When shortlisted",
              description: "Enqueue enrichment when a creator is added to a discovery shortlist.",
            },
            {
              value: "before_proposal",
              label: "Before proposal",
              description: "Enrich on shortlist add and campaign assignment before client proposal.",
            },
            {
              value: "always",
              label: "Always",
              description: "Allow all automatic enrichment triggers (detail, stale, campaign, shortlist).",
            },
          ]}
        />
      </OperationalFormSection>

      <OperationalFormSection
        title="Creator DNA policy flags"
        description="Operational toggles for DNA generation — does not change merge or completeness algorithms."
      >
        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="dnaGenerateAfterImport"
              defaultChecked={settings.dnaPolicy.generateAfterImport}
              className="accent-[#1D9E75]"
            />
            Generate DNA after Apify import
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="dnaUpdateAfterEnrichment"
              defaultChecked={settings.dnaPolicy.updateAfterEnrichment}
              className="accent-[#1D9E75]"
            />
            Update DNA after enrichment runs
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="dnaCalculateCompleteness"
              defaultChecked={settings.dnaPolicy.calculateCompleteness}
              className="accent-[#1D9E75]"
            />
            Calculate DNA completeness scores
          </label>
        </div>
      </OperationalFormSection>

      <OperationalFormSection
        title="Data freshness"
        description="Flag creators in browse results when enrichment data exceeds the configured age."
      >
        <select
          name="dataFreshnessDays"
          defaultValue={settings.dataFreshnessDays == null ? "" : String(settings.dataFreshnessDays)}
          className="flex h-9 max-w-xs rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="">Ignore — no outdated flag</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Browse metadata only — does not auto-trigger Apify refresh.
        </p>
      </OperationalFormSection>

      <OperationalFormSection
        title="Cost protection"
        description="Daily Apify budgets (fail-closed). Both must be greater than 0 or all Apify acquisition is rejected. 0 is never unlimited."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="maxRequestsPerDay">Max requests per day</Label>
            <Input
              id="maxRequestsPerDay"
              name="maxRequestsPerDay"
              type="number"
              min={1}
              defaultValue={settings.costProtection.maxRequestsPerDay}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="maxCreditsPerDay">Max credits per day</Label>
            <Input
              id="maxCreditsPerDay"
              name="maxCreditsPerDay"
              type="number"
              min={0.01}
              step={0.01}
              defaultValue={settings.costProtection.maxCreditsPerDay}
            />
          </div>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="confirmBeforeExceed"
            defaultChecked={settings.costProtection.confirmBeforeExceed}
            className="accent-[#1D9E75]"
          />
          Require admin confirmation before exceeding limits (reserved for future UI gate)
        </label>
      </OperationalFormSection>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="bg-[#1D9E75] hover:bg-[#1D9E75]/90">
          {pending ? "Saving…" : "Save discovery settings"}
        </Button>
        {state.message ? (
          <span
            className={
              state.ok ? "text-sm text-[#1D9E75]" : "text-sm text-destructive"
            }
          >
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
