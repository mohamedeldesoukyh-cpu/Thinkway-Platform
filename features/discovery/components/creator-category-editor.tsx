"use client";
import { useState } from "react";
import { CANONICAL_CREATOR_CATEGORIES } from "@/lib/creator-intelligence/taxonomy";
import { loadCreatorCategoryOptionsAction } from "@/features/discovery/creator-profile/update-creator-commercial-actions";
import { normalizeCreatorCategoryChoices } from "@/lib/creators/category-choices";

export function CreatorCategoryEditor({ categories = [], categoriesBusy = false, onCategoriesChange, plain = false }: {
 categories?: string[]; categoriesBusy?: boolean; onCategoriesChange?: (categories: string[]) => void | Promise<void>; plain?: boolean;
}) {
 const [open, setOpen] = useState(false);
 const [query, setQuery] = useState("");
 const [selected, setSelected] = useState<string[]>([]);
 const [removed, setRemoved] = useState<string[]>([]);
 const [options, setOptions] = useState<string[]>([...CANONICAL_CREATOR_CATEGORIES, "Chef"]);
 const [loading, setLoading] = useState(false);
 const [loadError, setLoadError] = useState(false);
 const choices = normalizeCreatorCategoryChoices([...options, ...categories, ...selected]).sort((a,b) => a.localeCompare(b));
 const remaining = categories.filter(value => !removed.includes(value));
 const existing = new Set(remaining.map(value => value.toLowerCase()));
 const pending = selected.length > 0 || removed.length > 0;
 const search = query.trim().replace(/\s+/g, " ");
 const visible = choices.filter(value => !existing.has(value.toLowerCase()) && value.toLowerCase().includes(search.toLowerCase()));
 const canCreate = search.length > 0 && !choices.some(value => value.toLowerCase() === search.toLowerCase());
 async function showPicker() {
   setOpen(!open);
   if (open) return;
   setLoading(true); setLoadError(false);
   try { setOptions(await loadCreatorCategoryOptionsAction()); } catch { setLoadError(true); }
   finally { setLoading(false); }
 }
 function toggle(value: string) { setSelected(previous => previous.includes(value) ? previous.filter(item => item !== value) : [...previous, value]); }
 return (<section className={plain ? "tw-category-editor tw-category-editor--plain" : "tw-category-editor"} aria-label="Creator categories">
   <strong>Categories</strong>
   <div className="tw-category-editor__chips">
     {remaining.map(category => <span className="tw-category-editor__chip" key={category}>{category}
       {onCategoriesChange ? <button type="button" aria-label={`Remove category ${category}`} disabled={categoriesBusy} onClick={() => setRemoved(previous => [...previous, category])}>&times;</button> : null}
     </span>)}
     {!remaining.length ? <span>No categories set</span> : null}
   </div>
   {onCategoriesChange ? <>
     <button type="button" className="tw-category-editor__toggle" aria-expanded={open} disabled={categoriesBusy} onClick={showPicker}>+ Add categories</button>
     {open ? <div className="tw-category-editor__picker">
       <input aria-label="Search creator categories" placeholder="Search categories..." value={query} maxLength={100} disabled={categoriesBusy} onChange={event => setQuery(event.target.value)} />
       {loading ? <small>Loading categories...</small> : null}
       {loadError ? <small>Could not load all categories. You can still add a new one.</small> : null}
       <div className="tw-category-editor__options" role="group" aria-label="Available categories">
         {visible.map(value => <label key={value}><input type="checkbox" checked={selected.includes(value)} disabled={categoriesBusy} onChange={() => toggle(value)} />{value}</label>)}
         {!visible.length && !loading ? <small>No matching categories.</small> : null}
       </div>
       {canCreate ? <button type="button" disabled={categoriesBusy} onClick={() => { setSelected(previous => normalizeCreatorCategoryChoices([...previous, search])); setQuery(""); }}>+ New: {search}</button> : null}
       <small>{selected.length} selected to add</small>
     </div> : null}
     {pending ? <div className="tw-category-editor__pending">
       <small>{removed.length} to remove · {selected.length} to add</small>
       <button type="button" disabled={categoriesBusy} onClick={async () => { await onCategoriesChange(normalizeCreatorCategoryChoices([...remaining, ...selected])); setRemoved([]); setSelected([]); setQuery(""); setOpen(false); }}>Apply</button>
       <button type="button" disabled={categoriesBusy} onClick={() => { setRemoved([]); setSelected([]); setQuery(""); setOpen(false); }}>Cancel</button>
     </div> : null}
   </> : null}
   <small role="status">{categoriesBusy ? "Saving categories..." : "Kept until refresh returns new category data."}</small>
 </section>);
}
