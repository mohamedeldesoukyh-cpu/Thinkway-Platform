"use client";

import { useId, useRef, useState, type ReactElement } from "react";
import { Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DocumentOutputTemplateOption } from "./document-output-toolbar";
import "./preview-layout-menu.css";

export type LayoutId =
  | 'creator-list' | 'creator-list-package' | 'creator-list-additions'
  | 'client-list-by-name'
  | 'pitch' | 'pitch-lump-sum'
  | 'detailed' | 'lump-sum'
  | 'showcase' | 'showcase-lump-sum';

type Thumb = 'cards' | 'cards-total' | 'cards-alt' | 'profiles'
  | 'deck' | 'deck-total' | 'rows' | 'rows-total' | 'gallery' | 'gallery-total';

interface Option {
  id: LayoutId; name: string; desc: string; thumb: Thumb;
  /** true when the layout shows no prices at all */
  noPrices?: boolean;
}
interface Family { label: string; note?: string; options: Option[] }

export const LAYOUT_FAMILIES: Family[] = [
  { label: 'Creator list', note: 'One card per creator',
    options: [
      { id: 'creator-list', name: 'Client prices',
        desc: 'Every service line priced separately', thumb: 'cards' },
      { id: 'creator-list-package', name: 'Package total',
        desc: 'One total per creator, lines not priced', thumb: 'cards-total' },
      { id: 'creator-list-additions', name: 'Option 2 as additions',
        desc: 'Second option shown as add-ons, not an alternative',
        thumb: 'cards-alt' },
    ] },
  { label: 'Client list',
    options: [
      { id: 'client-list-by-name', name: 'By name',
        desc: 'Profiles and performance, no prices', thumb: 'profiles',
        noPrices: true },
    ] },
  { label: 'Pitch', note: 'Presentation deck',
    options: [
      { id: 'pitch', name: 'Pitch presentation',
        desc: 'Large avatars, one creator per slide', thumb: 'deck' },
      { id: 'pitch-lump-sum', name: 'Pitch · lump sum',
        desc: 'Deck with a single campaign total', thumb: 'deck-total' },
    ] },
  { label: 'Document',
    options: [
      { id: 'detailed', name: 'Detailed',
        desc: 'Every line item in a table', thumb: 'rows' },
      { id: 'lump-sum', name: 'Lump sum',
        desc: 'Summary with one total', thumb: 'rows-total' },
    ] },
  { label: 'Showcase', note: 'Creator-led',
    options: [
      { id: 'showcase', name: 'Showcase',
        desc: 'Creator deck with content samples', thumb: 'gallery' },
      { id: 'showcase-lump-sum', name: 'Showcase · lump sum',
        desc: 'Showcase deck with one total', thumb: 'gallery-total' },
    ] },
];

/* ---- schematics: the layout, drawn. No text, no screenshots. ---- */
function Schematic({ kind }: { kind: Thumb }) {
  const bar = (x: number, y: number, w: number, h = 2.4, o = 1) =>
    <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={h} rx={1.1}
      fill="currentColor" opacity={o} />;
  const card = (x: number, y: number, w: number, h: number) =>
    <rect key={`c${x}-${y}`} x={x} y={y} width={w} height={h} rx={2}
      fill="none" stroke="currentColor" strokeWidth=".9" opacity=".5" />;
  const dot = (x: number, y: number, r = 3) =>
    <circle key={`d${x}-${y}`} cx={x} cy={y} r={r} fill="currentColor" opacity=".55" />;

  const body = {
    cards: <>{card(2, 2, 44, 13)}{dot(8, 8.5)}{bar(14, 5.5, 20)}{bar(14, 10, 14, 2, .5)}
      {bar(37, 7.5, 7, 3)}
      {card(2, 17, 44, 13)}{dot(8, 23.5)}{bar(14, 20.5, 18)}{bar(14, 25, 12, 2, .5)}
      {bar(37, 22.5, 7, 3)}</>,
    'cards-total': <>{card(2, 2, 44, 13)}{dot(8, 8.5)}{bar(14, 5.5, 20)}
      {bar(14, 10, 14, 2, .5)}
      {card(2, 17, 44, 13)}{dot(8, 23.5)}{bar(14, 20.5, 18)}{bar(14, 25, 12, 2, .5)}
      {bar(30, 33, 16, 3.4)}</>,
    'cards-alt': <>{card(2, 2, 44, 13)}{dot(8, 8.5)}{bar(14, 5.5, 20)}{bar(14, 10, 14, 2, .5)}
      {card(6, 17, 40, 9)}{bar(10, 20, 16, 2, .6)}{bar(37, 20, 7, 2.4)}
      {card(6, 28, 40, 9)}{bar(10, 31, 14, 2, .6)}{bar(37, 31, 7, 2.4)}</>,
    profiles: <>{dot(9, 9, 5)}{bar(17, 6, 22)}{bar(17, 11, 15, 2, .5)}
      {dot(9, 24, 5)}{bar(17, 21, 19)}{bar(17, 26, 13, 2, .5)}
      {bar(4, 34, 40, 2, .35)}</>,
    deck: <>{card(2, 2, 44, 28)}{dot(13, 15, 8)}{bar(25, 11, 18)}{bar(25, 16, 14, 2, .5)}
      {bar(25, 20.5, 10, 2, .5)}</>,
    'deck-total': <>{card(2, 2, 44, 24)}{dot(13, 13, 7)}{bar(24, 10, 18)}
      {bar(24, 15, 13, 2, .5)}{bar(28, 30, 18, 3.6)}</>,
    rows: <>{bar(3, 4, 42, 2, .35)}{bar(3, 10, 42, 2, .35)}{bar(3, 16, 42, 2, .35)}
      {bar(3, 22, 42, 2, .35)}{bar(3, 28, 42, 2, .35)}{bar(32, 34, 13, 2.6)}</>,
    'rows-total': <>{bar(3, 6, 42, 2, .35)}{bar(3, 13, 42, 2, .35)}
      {bar(3, 20, 42, 2, .35)}{bar(26, 30, 19, 4)}</>,
    gallery: <>{card(2, 2, 20, 14)}{card(26, 2, 20, 14)}{card(2, 19, 20, 14)}
      {card(26, 19, 20, 14)}{dot(7, 7, 2.6)}{dot(31, 7, 2.6)}</>,
    'gallery-total': <>{card(2, 2, 20, 13)}{card(26, 2, 20, 13)}{card(2, 18, 20, 13)}
      {card(26, 18, 20, 13)}{bar(28, 35, 18, 3.4)}</>,
  }[kind];

  return (
    <svg className="qx-lay__sch" viewBox="0 0 48 40" aria-hidden="true"
      focusable="false">{body}</svg>
  );
}


export function PreviewLayoutMenu({ templates, value, onChange, onOpen, trigger, documentKind = "quotation", disabled }: {
  templates: DocumentOutputTemplateOption[];
  value: string;
  onChange: (id: string) => void;
  onOpen: () => void;
  trigger: ReactElement;
  documentKind?: "quotation" | "shortlist";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const name = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const openingPreview = useRef(false);
  const families = LAYOUT_FAMILIES.map(family => ({ ...family,
    options: family.options.filter(option => templates.some(t => t.id === option.id)).map(option =>
      documentKind === "shortlist" && option.id === "creator-list"
        ? { ...option, name: "Profiles & performance", desc: "Creator cards with profiles and performance", thumb: "profiles" as const }
        : option)
  })).filter(family => family.options.length > 0);
  const current = families.flatMap(f => f.options).find(o => o.id === value);
  return <Popover open={open} onOpenChange={next => { openingPreview.current = false; setOpen(next); }}>
    <PopoverTrigger asChild disabled={disabled}>{trigger}</PopoverTrigger>
    <PopoverContent ref={contentRef} className="qx-lay" align="end" collisionPadding={14}
      aria-labelledby={name + "-title"} aria-describedby={name + "-description"}
      onOpenAutoFocus={event => { event.preventDefault(); contentRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus(); }}
      onCloseAutoFocus={event => { if (openingPreview.current) event.preventDefault(); }}>
      <div className="qx-lay__h">
        <div><h3 id={name + "-title"}>Preview layout</h3>
          <p id={name + "-description"}>Changes how the {documentKind} is presented. It does not change prices, lines or what is saved.</p></div>
        <button type="button" className="qx-x" onClick={() => setOpen(false)} aria-label="Close preview layout"><X size={13}/></button>
      </div>
      <div className="qx-lay__b" role="radiogroup" aria-label="Layout">
        {families.map(family => <section className="qx-lay__fam" key={family.label}>
          <h4>{family.label}{family.note && <em>{family.note}</em>}</h4>
          <div className="qx-lay__grid">{family.options.map(option => {
            const selected = option.id === value;
            return <label key={option.id} className={"qx-lay__opt" + (selected ? " on" : "")}>
              <input className="qx-lay__radio" type="radio" name={name} value={option.id} checked={selected}
                onChange={() => onChange(option.id)} disabled={disabled} aria-label={option.name}/>
              <Schematic kind={option.thumb}/>
              <span className="qx-lay__t"><b>{option.name}{selected && <Check size={11}/>}</b>
                <span>{option.desc}</span>{option.noPrices && <span className="chip chip--wrn">No prices</span>}
              </span>
            </label>;
          })}</div>
        </section>)}
      </div>
      <div className="qx-lay__f"><span className="qx-lay__cur"><u>Selected</u><b>{current?.name ?? "—"}</b></span>
        <span className="sp"/>
        <button type="button" className="b" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="b b--pri" disabled={disabled || !current} onClick={() => {
          openingPreview.current = true; setOpen(false); onOpen();
        }}>Open preview</button>
      </div>
    </PopoverContent>
  </Popover>;
}
