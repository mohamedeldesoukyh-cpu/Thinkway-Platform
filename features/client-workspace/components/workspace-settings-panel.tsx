"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLIENT_WORKSPACE_NAV_SECTIONS, type ClientWorkspaceNavSection } from "../entitlement";
import { CLIENT_WORKSPACE_SECTION_LABEL } from "../constants";
import { loadWorkspaceSettingsAction, saveWorkspaceSettingsAction } from "../actions/workspace-settings-actions";

export function WorkspaceSettingsPanel({ clientId, reviewId, disabled = false, onEditingChange }: {
  clientId: string; reviewId: string; disabled?: boolean; onEditingChange?: (editing: boolean) => void;
}) {
  const [hidden, setHidden] = useState<ClientWorkspaceNavSection[]>([]);
  const [saved, setSaved] = useState<ClientWorkspaceNavSection[]>([]);
  const [limit, setLimit] = useState(0);
  const [savedLimit, setSavedLimit] = useState(0);
  const [used, setUsed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadWorkspaceSettingsAction(clientId, reviewId).then((result) => {
      if (cancelled) return;
      if (!result.ok) { setError(result.message); return; }
      setHidden(result.hiddenTabs); setSaved(result.hiddenTabs); setLoaded(true);
      setLimit(result.refreshLimit); setSavedLimit(result.refreshLimit); setUsed(result.refreshUsed);
    }).catch(() => { if (!cancelled) setError("Could not load workspace settings."); });
    return () => { cancelled = true; };
  }, [clientId, reviewId, retry]);

  async function save() {
    setBusy(true); setError("");
    try {
      const result = await saveWorkspaceSettingsAction(clientId, reviewId, hidden, limit);
      if (!result.ok) { setError(result.message); return; }
      setSaved(result.hiddenTabs);
      setSavedLimit(result.refreshLimit);
      onEditingChange?.(false);
      toast.success("Client workspace settings saved.");
    } catch { setError("Could not save workspace settings. Please try again."); }
    finally { setBusy(false); }
  }
  const dirty = limit !== savedLimit || CLIENT_WORKSPACE_NAV_SECTIONS.some((tab) => hidden.includes(tab) !== saved.includes(tab));
  return <section className="rounded-lg border border-border p-3" aria-label="Client workspace settings">
    <h3 className="text-sm font-semibold">Client workspace tabs</h3>
    <p className="mt-1 text-xs text-muted-foreground">Choose what the client can see on this shared link. Changes apply across the campaign, assignments, quotation and shortlist.</p>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {!loaded ? <div className="mt-3 text-sm" role="status">{error ? <Button type="button" variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>Retry</Button> : "Loading settings…"}</div> : <>
      <fieldset disabled={busy || disabled} className="mt-3 space-y-1">
        <legend className="sr-only">Visible tabs</legend>
        {CLIENT_WORKSPACE_NAV_SECTIONS.map((tab) => <label key={tab} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted/40">
          <input type="checkbox" className="size-4 accent-primary" checked={!hidden.includes(tab)} onChange={(event) => { onEditingChange?.(true); setHidden((current) => event.target.checked ? current.filter((value) => value !== tab) : [...current, tab]); }} />
          <span className="flex-1 text-sm">{tab === "commercial" ? "Commercial / Quotation (prices)" : CLIENT_WORKSPACE_SECTION_LABEL[tab]}</span>
          <span className="text-xs text-muted-foreground">{hidden.includes(tab) ? "Hidden" : "Shown"}</span>
        </label>)}
      </fieldset>
      <p className="mt-2 text-xs text-muted-foreground">Keep at least one tab visible. Showing a tab keeps the client’s existing access permissions.</p>
      <label className="mt-4 block text-sm font-medium">Campaign metrics refresh allowance
        <Input className="mt-2" type="number" min={0} max={1000} step={1} value={Number.isNaN(limit) ? "" : limit} disabled={busy || disabled} onChange={(event) => { onEditingChange?.(true); setLimit(event.target.valueAsNumber); }} />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">{used} refreshes used. One credit refreshes the campaign’s published content metrics. Set 0 to disable client refreshes. Changing the allowance keeps the usage count. Report downloads are free.</p>
      <p className="mt-2 text-xs text-muted-foreground">Save these campaign settings here. The client profile’s Save changes button saves the On/Off and package settings above.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || disabled || !dirty || hidden.length === CLIENT_WORKSPACE_NAV_SECTIONS.length || !Number.isInteger(limit)} onClick={() => void save()}>{busy ? "Saving…" : "Save workspace settings"}</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || disabled} onClick={() => { setHidden(saved); setLimit(savedLimit); setError(""); onEditingChange?.(false); }}>Reset changes</Button>
      </div>
    </>}
  </section>;
}
