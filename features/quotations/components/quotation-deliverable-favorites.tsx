"use client";

import { useUndoableState } from "@/lib/productivity/workspace-undo";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { StarIcon, ListPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuotationDeliverableTypeLinesEditor } from "./quotation-deliverable-type-lines";
import { formatTypeLinesSummary, syncServiceDescriptionWithTypeLines, isPostTypeAllowedForCreator } from "@/lib/quotations/quotation-deliverable-types";
import { loadDeliverableFavorites, saveDeliverableFavorites } from "../deliverable-favorite-actions";
import type { DeliverableFavorite } from "../deliverable-favorites";
import type { QuotationDeliverableTypeLine } from "@/lib/domains/commercial/quotation-types";

type FavoriteContext = {
  favorites: DeliverableFavorite[];
  loading: boolean;
  error: string | null;
  save: (favorites: DeliverableFavorite[]) => Promise<boolean>;
  register: (id: string, apply: (favorite: DeliverableFavorite) => boolean) => () => void;
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
  const handlers = useRef(new Map<string, (favorite: DeliverableFavorite) => boolean>());
  useEffect(() => {
    let active = true;
    void loadDeliverableFavorites().then(result => {
      if (!active) return;
      if (result.ok) setFavorites(result.favorites); else setError(result.message);
      setLoading(false);
    }).catch(() => { if (active) { setError("Could not load favorites."); setLoading(false); } });
    return () => { active = false; };
  }, []);
  const register = useCallback((id: string, apply: (favorite: DeliverableFavorite) => boolean) => {
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
    for (const id of ids) { const handler = handlers.current.get(id); if (handler?.(favorite)) count++; }
    if (count) toast.success(`Deliverables applied to ${count} line${count === 1 ? "" : "s"}. Click Save to keep quotation changes.`);
    else toast.error("Select visible creator lines to apply deliverables.");
  }
  return <Context.Provider value={{ favorites, loading, error, save, register, apply }}>{children}</Context.Provider>;
}

export function QuotationFavoriteButtons({ itemIds, lines = [], description = "", disabled = false, onDeliverables, creatorName, allowedPlatforms = [] }: {
  itemIds: string[];
  lines?: QuotationDeliverableTypeLine[];
  description?: string;
  disabled?: boolean;
  onDeliverables?: () => void;
  creatorName?: string;
  allowedPlatforms?: string[];
}) {
  const store = useDeliverableFavorites();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm, resetForm] = useUndoableState({ name: '', selectedLines: [] as QuotationDeliverableTypeLine[], service: '' }, "Favorite package", open && !busy);
  const { name, selectedLines, service } = form;
  const setName = (name: string) => setForm(prev => ({ ...prev, name }));
  const favorite = store.favorites[0];
  function showEditor() { setEditingId(null); resetForm({ name: "", selectedLines: lines, service: description }); setOpen(true); }
  function applySelectedFavorite(value: DeliverableFavorite) { store.apply(itemIds, value); setOpen(false); }
  async function persist(next: DeliverableFavorite[]) {
    setBusy(true);
    try { return await store.save(next); }
    catch { toast.error("Could not save favorites. Please try again."); return false; }
    finally { setBusy(false); }
  }
  return <span className="q-favorite-tools">
    <button type="button" data-action-tone="favorite" className="q-favorite-button q-favorite-button--saved" disabled={disabled || store.loading} title={onDeliverables ? "Favorite packages" : favorite ? `Apply ${favorite.name}` : "Set your first favorite"}
      onClick={() => onDeliverables ? showEditor() : favorite ? applySelectedFavorite(favorite) : showEditor()}><StarIcon size={12} />Apply Favorite</button>
    <button type="button" className="q-favorite-button" disabled={disabled} onClick={onDeliverables ?? showEditor}><ListPlusIcon size={12} />Saved Deliverables</button>
    <Sheet modal={false} open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
      <SheetContent showOverlay={false} side="right" showCloseButton={false} className="tq-redesign q-service-sheet qx q-redesign-body q-favorites-sheet">
        <header className="qx-sh__h"><div><SheetTitle>Favorite deliverables</SheetTitle><SheetDescription>{creatorName ? `${creatorName} · ` : ""}Reusable packages · apply to this line, then Save the quotation.</SheetDescription></div><SheetClose className="q-b q-b--sm">Close</SheetClose></header><div className="q-favorites-body qx-sh__b">
        {store.error && <p role="alert" className="text-sm text-destructive">{store.error}</p>}
        <section className="qx-panel"><div className="qx-panel__h"><h4>Saved packages</h4><span className="sp" /><span>{store.favorites.length}</span></div><div className="qx-panel__b">{!store.favorites.length && <p className="q-help">No saved packages yet. Build one below to reuse across quotations.</p>}
          {store.favorites.map((entry, index) => <div className="q-favorite-card" key={entry.id}>
            <div className="q-favorite-card__summary"><b>{index === 0 ? "★ " : ""}{entry.name}</b><span className="q-favorite-card__description">{formatTypeLinesSummary(entry.lines)}</span></div>
            {entry.lines.some(line => !isPostTypeAllowedForCreator(line.type, allowedPlatforms)) && <p className="qx-note qx-note--wrn">Includes services unavailable on this creator. Only supported services can be applied.</p>}
            <div className="q-favorite-card__actions"><button type="button" className="b b--xs" disabled={disabled || busy} onClick={() => applySelectedFavorite(entry)}>Apply to this line</button>{index > 0 && <button type="button" className="q-favorite-button" disabled={busy} onClick={() => void persist([entry, ...store.favorites.filter(f => f.id !== entry.id)])}>Set default</button>}
            <button type="button" className="q-favorite-button" disabled={busy} onClick={() => { setEditingId(entry.id); setForm({ name: entry.name, selectedLines: entry.lines, service: entry.description }); }}>Edit</button>
            <button type="button" data-action-tone="danger" className="q-favorite-button" disabled={busy} onClick={() => void persist(store.favorites.filter(f => f.id !== entry.id))}>Remove</button></div>
          </div>)}
        </div></section>
        <section className="qx-panel"><div className="qx-panel__h"><h4>{editingId ? "Edit package" : "Build a package"}</h4></div><div className="qx-panel__b">
          <QuotationDeliverableTypeLinesEditor lines={selectedLines} allowedPlatforms={[]} onChange={next => { setForm(prev => ({ ...prev, service: syncServiceDescriptionWithTypeLines(prev.service, prev.selectedLines, next), selectedLines: next })); }} disabled={busy} workspaceDetails hidePicker />
          <Label>Package description</Label><p className="qx-readout">{service || formatTypeLinesSummary(selectedLines) || "Choose services in Deliverables first, or edit a saved package."}</p>
          <Label htmlFor="deliverable-favorite-name">Favorite name</Label>
          <Input id="deliverable-favorite-name" maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Reel + Story + Mirrored TikTok" />
        </div></section></div><footer className="qx-sh__f">
            <button type="button" data-action-tone="success" className="q-favorite-button" disabled={busy || store.loading || !name.trim() || !selectedLines.some(line => line.type)} onClick={async () => {
              const previous = store.favorites.find(entry => entry.id === editingId) ?? store.favorites.find(entry => entry.name.toLowerCase() === name.trim().toLowerCase());
              const value = { id: previous?.id ?? crypto.randomUUID(), name: name.trim(), description: service.trim() || formatTypeLinesSummary(selectedLines), lines: selectedLines.filter(line => line.type) };
              const next = previous ? store.favorites.map(entry => entry.id === previous.id ? value : entry) : [...store.favorites, value];
              if (await persist(next)) toast.success("Favorite saved across your quotations.");
            }}>{busy ? "Saving…" : "Save favorite"}</button>
            <button type="button" data-action-tone="primary" className="q-favorite-button" disabled={busy || disabled || !selectedLines.some(line => line.type)} onClick={() => applySelectedFavorite({ id: "selection", name: "Selection", description: service.trim() || formatTypeLinesSummary(selectedLines), lines: selectedLines.filter(line => line.type) })}>Apply to {itemIds.length} line{itemIds.length === 1 ? "" : "s"}</button>
<p className="q-help">Saving a favorite updates the shared library. Applying only stages this line.</p></footer></SheetContent>
    </Sheet>
  </span>;
}
