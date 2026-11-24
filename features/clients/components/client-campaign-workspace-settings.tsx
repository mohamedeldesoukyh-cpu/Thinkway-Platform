import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { listClientWorkspacesAction } from "@/features/client-workspace/actions/workspace-settings-actions";
import { WorkspaceSettingsPanel } from "@/features/client-workspace/components/workspace-settings-panel";

type Choice = { reviewId: string; workspaceId: string; label: string };

export function ClientCampaignWorkspaceSettings({ clientId, disabled }: { clientId: string; disabled?: boolean }) {
  const selectorId = useId();
  const [workspaces, setWorkspaces] = useState<Choice[] | null>(null);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    listClientWorkspacesAction(clientId).then((result) => {
      if (cancelled) return;
      if (!result.ok) { setError(result.message); return; }
      setError(""); setWorkspaces(result.workspaces);
      setSelected(result.workspaces.length === 1 ? result.workspaces[0].reviewId : "");
    }).catch(() => { if (!cancelled) setError("Could not load campaign workspaces."); });
    return () => { cancelled = true; };
  }, [clientId, retry]);

  return <div className="mt-4 space-y-3 border-t border-[#e6ebf3] pt-4">
    <div>
      <h3 className="text-sm font-semibold">Campaign workspace controls · Internal only</h3>
      <p className="mt-1 text-xs text-muted-foreground">Manage the tabs and refresh credits on each campaign’s shared client link. Clients cannot change these settings. You can configure a link while it is off.</p>
    </div>
    {error ? <div role="alert" className="text-sm text-destructive">{error} <Button type="button" size="sm" variant="outline" onClick={() => setRetry(value => value + 1)}>Retry</Button></div>
      : !workspaces ? <p role="status" className="text-sm text-muted-foreground">Loading campaign workspaces…</p>
      : workspaces.length === 0 ? <p className="text-sm text-muted-foreground">No shared workspaces yet. Generate a Client Workspace link from this client’s campaign, quotation or shortlist, then return here to configure it.</p>
      : <>
        <label htmlFor={selectorId} className="block text-sm font-medium">Campaign / shared workspace</label>
        <select id={selectorId} className="min-h-10 w-full rounded-md border border-[#e6ebf3] bg-white px-3 text-sm" value={selected} disabled={disabled || editing} onChange={event => setSelected(event.target.value)}>
          <option value="">Select a campaign workspace</option>
          {workspaces.map(workspace => <option key={workspace.workspaceId} value={workspace.reviewId}>{workspace.label}</option>)}
        </select>
        {editing && <p className="text-xs text-muted-foreground">Save or reset the changes below before selecting another campaign.</p>}
        {selected && <WorkspaceSettingsPanel key={`${clientId}:${selected}`} clientId={clientId} reviewId={selected} disabled={disabled} onEditingChange={setEditing} />}
      </>}
  </div>;
}
