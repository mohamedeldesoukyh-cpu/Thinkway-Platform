
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { restoreCreatorIdentityAction } from "./restore-identity-action";

export function RestoreCreatorIdentityButton({ influencerId, onUpdated }: {
  influencerId: string; onUpdated: (creator: UnifiedCreatorResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  return <Button variant="outline" size="sm" disabled={busy} title="Restore name and photo from the remaining linked accounts" onClick={async () => {
    setBusy(true);
    try { onUpdated(await restoreCreatorIdentityAction(influencerId)); toast.success("Name and photo restored from linked accounts."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not restore identity."); }
    finally { setBusy(false); }
  }}>{busy ? "Restoring…" : "Restore name & photo"}</Button>;
}
