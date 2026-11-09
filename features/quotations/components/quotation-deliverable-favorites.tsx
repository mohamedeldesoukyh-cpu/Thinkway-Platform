"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { StarIcon, ListPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuotationDeliverableTypeLinesEditor } from "./quotation-deliverable-type-lines";
import { formatTypeLinesSummary, syncServiceDescriptionWithTypeLines } from "@/lib/quotations/quotation-deliverable-types";
import { loadDeliverableFavorites, saveDeliverableFavorites } from "../deliverable-favorite-actions";
import type { DeliverableFavorite } from "../deliverable-favorites";
import type { QuotationDeliverableTypeLine } from "@/lib/domains/commercial/quotation-types";

type FavoriteContext = {
  favorites: DeliverableFavorite[];
  loading: boolean;
  error: string | null;
  save: (favorites: DeliverableFavorite[]) => Promise<boolean>;
  register: (id: string, apply: (favorite: DeliverableFavorite) => void) => () => void;
  apply: (ids: string[], favorite: DeliverableFavorite) => void;
};
const Context = createContext<FavoriteContext | null>(null);
export function useDeliverableFavorites() {
  const value = useContext(Context);
  if (!value) throw new Error("Favorites provider missing.");
  return value;
}
export function DeliverableFavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<DeliverableFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handlers = useRef(new Map<string, (favorite: DeliverableFavorite) => void>());
  useEffect(() => {
    let active = true;
    void loadDeliverableFavorites().then(result => {
      if (!active) return;
      if (result.ok) setFavorites(result.favorites); else setError(result.message);
      setLoading(false);
    }).catch(() => { if (active) { setError("Could not load favorites."); setLoading(false); } });
    return () => { active = false; };
  }, []);
  const register = useCallback((id: string, apply: (favorite: DeliverableFavorite) => void) => {
    handlers.current.set(id, apply);
    return () => { handlers.current.delete(id); };
  }, []);
  async function save(next: DeliverableFavorite[]) {
    const result = await saveDeliverableFavorites(next);
    if (!result.ok) { toast.error(result.message); return false; }
    setFavorites(result.favorites); setError(null); return true;
  }
  function apply(ids: string[], favorite: DeliverableFavorite) {
    let count = 0;
    for (const id of ids) { const handler = handlers.current.get(id); if (handler) { handler(favorite); count++; } }
    if (count) toast.success(`Deliverables applied to ${count} line${count === 1 ? "" : "s"}. Click Save to keep quotation changes.`);
    else toast.error("Select visible creator lines to apply deliverables.");
  }
  return <Context.Provider value={{ favorites, loading, error, save, register, apply }}>{children}</Context.Provider>;
}

export function QuotationFavoriteButtons({ itemIds, lines = [], description = "", disabled = false }: {
  itemIds: string[];
  lines?: QuotationDeliverableTypeLine[];
  description?: string;
  disabled?: boolean;
}) {
  const store = useDeliverableFavorites();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedLines, setSelectedLines] = useState<QuotationDeliverableTypeLine[]>([]);
  const [service, setService] = useState("");
  const [busy, setBusy] = useState(false);
  const favorite = store.favorites[0];
  function showEditor() { setName(""); setSelectedLines(lines); setService(description); setOpen(true); }
  function applySelectedFavorite(value: DeliverableFavorite) { store.apply(itemIds, value); setOpen(false); }
  async function persist(next: DeliverableFavorite[]) {
    setBusy(true);
    try { return await store.save(next); }
    catch { toast.error("Could not save favorites. Please try again."); return false; }
    finally { setBusy(false); }
  }
  return <span className="q-favorite-tools">
    <button type="button" className="q-favorite-button" disabled={disabled || store.loading} title={favorite ? `Apply ${favorite.name}` : "Set your first favorite"}
      onClick={() => favorite ? applySelectedFavorite(favorite) : showEditor()}><StarIcon size={12} />Favorite</button>
    <button type="button" className="q-favorite-button" disabled={disabled} onClick={showEditor}><ListPlusIcon size={12} />Deliverables</button>
    <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader><DialogTitle>Favorite deliverables</DialogTitle><DialogDescription>Save selections for use across all your quotations. The first favorite is your one-click choice. Applying changes stages them for Save.</DialogDescription></DialogHeader>
        {store.error && <p role="alert" className="text-sm text-destructive">{store.error}</p>}
        {store.favorites.length > 0 && <div className="space-y-2">
          {store.favorites.map((entry, index) => <div className="flex items-center gap-2 rounded-lg border p-2" key={entry.id}>
            <button type="button" className="min-w-0 flex-1 text-left text-sm" disabled={disabled || busy} onClick={() => applySelectedFavorite(entry)}><b>{index === 0 ? "★ " : ""}{entry.name}</b><span className="block truncate text-xs text-slate-500">{formatTypeLinesSummary(entry.lines)}</span></button>
            {index > 0 && <button type="button" className="q-favorite-button" disabled={busy} onClick={() => void persist([entry, ...store.favorites.filter(f => f.id !== entry.id)])}>Set default</button>}
            <button type="button" className="q-favorite-button" disabled={busy} onClick={() => { setName(entry.name); setSelectedLines(entry.lines); setService(entry.description); }}>Edit</button>
            <button type="button" className="q-favorite-button" disabled={busy} onClick={() => void persist(store.favorites.filter(f => f.id !== entry.id))}>Remove</button>
          </div>)}
        </div>}
        <div className="space-y-3 rounded-xl border bg-slate-50 p-3">
          <Label>Deliverable selection</Label>
          <QuotationDeliverableTypeLinesEditor lines={selectedLines} allowedPlatforms={[]} onChange={next => { setService(syncServiceDescriptionWithTypeLines(service, selectedLines, next)); setSelectedLines(next); }} disabled={busy} workspaceDetails />
          <Label htmlFor="favorite-service-description">Service description</Label>
          <Input id="favorite-service-description" value={service} onChange={event => setService(event.target.value)} placeholder={formatTypeLinesSummary(selectedLines) || "Generated from your selection"} />
          <Label htmlFor="deliverable-favorite-name">Favorite name</Label>
          <Input id="deliverable-favorite-name" maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Reel + Story + Mirrored TikTok" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="q-favorite-button" disabled={busy || store.loading || !name.trim() || !selectedLines.some(line => line.type)} onClick={async () => {
              const previous = store.favorites.find(entry => entry.name.toLowerCase() === name.trim().toLowerCase());
              const value = { id: previous?.id ?? crypto.randomUUID(), name: name.trim(), description: service.trim() || formatTypeLinesSummary(selectedLines), lines: selectedLines.filter(line => line.type) };
              const next = previous ? store.favorites.map(entry => entry.id === previous.id ? value : entry) : [...store.favorites, value];
              if (await persist(next)) toast.success("Favorite saved across your quotations.");
            }}>{busy ? "Saving…" : "Save favorite"}</button>
            <button type="button" className="q-favorite-button" disabled={busy || disabled || !selectedLines.some(line => line.type)} onClick={() => applySelectedFavorite({ id: "selection", name: "Selection", description: service.trim() || formatTypeLinesSummary(selectedLines), lines: selectedLines.filter(line => line.type) })}>Apply to {itemIds.length} line{itemIds.length === 1 ? "" : "s"}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </span>;
}
