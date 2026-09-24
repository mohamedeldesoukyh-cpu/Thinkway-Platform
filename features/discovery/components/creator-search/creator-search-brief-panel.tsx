"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { uploadCampaignBriefAction, saveCampaignIntelligenceProfileAction, type CampaignIntelligenceWorkspaceState } from "@/features/campaign-intelligence-profile/actions/profile-actions";
import { profileToDiscoveryRequirements, discoveryRequirementsToProfile, validateDiscoveryRequirements, type DiscoveryCampaignRequirements } from "@/features/campaign-intelligence-profile/services/discovery-campaign-requirements";
import { mapCampaignIntelligenceToDiscoverySearch } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";

const fields: Array<[keyof DiscoveryCampaignRequirements, string, boolean?]> = [
  ["clientName", "Client"], ["brandName", "Brand"], ["marketCountry", "Campaign market (context only)"],
  ["creatorCountries", "Creator countries (ISO codes)", true], ["creatorLanguages", "Creator languages (codes)", true],
  ["contentLanguages", "Content languages (not evaluated)", true], ["creatorGender", "Creator gender (not evaluated)"],
  ["audienceCountries", "Audience countries (not evaluated)", true],
  ["audienceLanguages", "Audience languages (not evaluated)", true], ["audienceGender", "Audience gender (not evaluated)"],
  ["audienceAgeMin", "Audience minimum age (not evaluated)"], ["audienceAgeMax", "Audience maximum age (not evaluated)"],
  ["platforms", "Platforms", true], ["categories", "Creator categories", true],
  ["creatorTiers", "Creator tiers", true], ["followerMin", "Minimum followers"], ["followerMax", "Maximum followers"],
  ["engagementMin", "Minimum engagement (%)"], ["creatorNiches", "Niches (ranking preferences)", true],
  ["keywords", "Content topics (ranking preferences)", true],
];

/** Reuses the existing upload/parser/CIP persistence and structured requirements adapter. */
export function CreatorSearchBriefPanel({ state, onChange, onRun, onRemove, onClose }: {
  state: CampaignIntelligenceWorkspaceState | null | undefined;
  onChange: (state: CampaignIntelligenceWorkspaceState) => void;
  onRun: (state: CampaignIntelligenceWorkspaceState) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [workspace, setWorkspace] = useState(state);
  const [requirements, setRequirements] = useState<DiscoveryCampaignRequirements | null>(state ? profileToDiscoveryRequirements(state.profile) : null);
  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("Uploading brief and understanding campaign…");
    try {
      const form = new FormData(); form.set("file", file); form.set("discoveryBrief", "true");
      const result = await uploadCampaignBriefAction(form);
      if (!result.ok) throw new Error(result.message);
      if (result.phase !== "complete") throw new Error("Could not prepare this brief. Please try again.");
      setWorkspace(result.workspace); setRequirements(profileToDiscoveryRequirements(result.workspace.profile));
      setDirty(false); setListDrafts({}); onChange(result.workspace); setMessage("Campaign requirements ready for review.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read brief"); }
    finally { setBusy(false); }
  }
  async function save(run: boolean) {
    if (!workspace || !requirements) return;
    if (workspace.profile.budget && (!Number.isFinite(workspace.profile.budget.amount) || workspace.profile.budget.amount < 0)) { toast.error("Check campaign budget."); return; }
    const validation = validateDiscoveryRequirements(requirements);
    if (validation) { toast.error(validation); return; }
    const min = requirements.followerMin, max = requirements.followerMax;
    if ([min, max, requirements.engagementMin].some(v => v && (!Number.isFinite(Number(v)) || Number(v) < 0)) || (min && max && Number(min) > Number(max)) || Number(requirements.engagementMin) > 100) {
      toast.error("Check follower and engagement requirements."); return;
    }
    setBusy(true);
    try {
      const profile = dirty ? discoveryRequirementsToProfile(workspace.profile, requirements) : workspace.profile;
      if (dirty) {
        const saved = await saveCampaignIntelligenceProfileAction(workspace.profileId, profile);
        if (!saved.ok) throw new Error(saved.message);
      }
      const next = { ...workspace, profile };
      onChange(next); if (run) onRun(next); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save requirements"); }
    finally { setBusy(false); }
  }
  const preview = workspace && requirements ? mapCampaignIntelligenceToDiscoverySearch(dirty ? discoveryRequirementsToProfile(workspace.profile, requirements) : workspace.profile) : null;
  return <Sheet open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-2xl">
      <SheetHeader><SheetTitle>Campaign requirements</SheetTitle><SheetDescription>Review your brief before using AI to find creators. Lists use commas.</SheetDescription></SheetHeader>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        <label className="block rounded-lg border border-dashed border-border p-4 text-sm">
          {workspace?.fileName ?? "Add Campaign Brief"}
          <Input aria-label={workspace ? "Replace campaign brief" : "Upload campaign brief"} type="file" disabled={busy} accept=".pdf,.doc,.docx,.pptx,.txt,.md,.rtf" className="mt-2" onChange={e => void upload(e.target.files?.[0])} />
          <span className="text-xs text-muted-foreground">PDF, Word, PowerPoint, TXT, MD or RTF · up to 25 MB</span>
        </label>
        {message ? <p role="status" className="text-sm">{message}</p> : null}
        {requirements ? <div className="grid gap-3 sm:grid-cols-2">{fields.map(([key, label, list]) => <label key={key} className="space-y-1 text-xs font-medium">{label}
          <Input disabled={busy} value={listDrafts[key] ?? (Array.isArray(requirements[key]) ? (requirements[key] as string[]).join(", ") : String(requirements[key] ?? ""))} onChange={e => { if (list) setListDrafts({ ...listDrafts, [key]: e.target.value }); setRequirements({ ...requirements, [key]: list ? e.target.value.split(",").map(v => v.trim()).filter(Boolean) : e.target.value }); setDirty(true); }} />
        </label>)}</div> : null}
        {workspace ? <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium">Budget (context)<Input type="number" min="0" disabled={busy} value={workspace.profile.budget?.amount ?? ""} onChange={e => { setWorkspace({ ...workspace, profile: { ...workspace.profile, budget: e.target.value ? { amount: Number(e.target.value), currency: workspace.profile.budget?.currency ?? "" } : undefined } }); setDirty(true); }} /></label>
          <label className="text-xs font-medium">Currency (context)<Input disabled={busy} value={workspace.profile.budget?.currency ?? ""} onChange={e => { setWorkspace({ ...workspace, profile: { ...workspace.profile, budget: { amount: workspace.profile.budget?.amount ?? 0, currency: e.target.value } } }); setDirty(true); }} /></label>
          {(["campaignStartDate", "campaignEndDate"] as const).map(key => <label key={key} className="text-xs font-medium">{key === "campaignStartDate" ? "Campaign start (context)" : "Campaign end (context)"}<Input type="date" disabled={busy} value={workspace.profile[key] ?? ""} onChange={e => { setWorkspace({ ...workspace, profile: { ...workspace.profile, [key]: e.target.value || undefined } }); setDirty(true); }} /></label>)}
        </div> : null}
        {workspace ? <div className="space-y-3">{(["objective", "deliverables", "requirements"] as const).map(key => <label key={key} className="block text-xs font-medium">{key === "requirements" ? "Other requirements (not evaluated)" : key === "deliverables" ? "Content formats / deliverables (context)" : "Campaign objective (context)"}
          <Input disabled={busy} value={key === "requirements" ? workspace.profile.requirements?.mandatory?.join(", ") ?? "" : key === "deliverables" ? workspace.profile.deliverables?.join(", ") ?? "" : workspace.profile.objective ?? ""} onChange={e => {
            const value = e.target.value;
            setWorkspace({ ...workspace, profile: { ...workspace.profile, ...(key === "requirements" ? { requirements: { ...workspace.profile.requirements, mandatory: value.split(",").filter(Boolean) } } : key === "deliverables" ? { deliverables: value.split(",").filter(Boolean) } : { objective: value, objectives: [value] }) } }); setDirty(true);
          }} />
        </label>)}</div> : null}
        {preview?.requirements?.length ? <details className="text-xs"><summary>How requirements will be used</summary><ul className="mt-2 space-y-2">{preview.requirements.map(r => <li key={r.id}><strong>{r.label}:</strong> {r.value} — {r.classification === "UNSUPPORTED" ? "Not evaluated" : r.classification.toLowerCase()}{r.source ? <p className="text-muted-foreground">Source: {r.source}</p> : null}</li>)}</ul></details> : null}
      </div>
      <div className="flex flex-wrap gap-2 border-t p-4">
        {workspace ? <Button variant="ghost" disabled={busy} onClick={() => { onRemove(); onClose(); }}>Remove brief</Button> : null}
        <Button variant="outline" disabled={busy || !workspace} onClick={() => void save(false)}>Save requirements</Button>
        <Button disabled={busy || !workspace} onClick={() => void save(true)}>Use AI to Find Creators</Button>
      </div>
    </SheetContent>
  </Sheet>;
}
