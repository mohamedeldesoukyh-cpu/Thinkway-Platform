"use client";

import { useState } from "react";
import { QUOTATION_POST_TYPES, isPostTypeAllowedForCreator, selectAllDeliverableTypes, toggleDeliverableType } from "@/lib/quotations/quotation-deliverable-types";

/** The prototype's inline picker, backed by the existing platform/type rules. */
export function QuotationInlineServicePicker({ value, onChange, allowedPlatforms, disabled }: {
  value: string[]; onChange: (value: string[]) => void; allowedPlatforms: string[]; disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const available = selectAllDeliverableTypes(true, allowedPlatforms);
  const all = available.length > 0 && available.every(type => value.includes(type));
  const custom = value.filter(type => !QUOTATION_POST_TYPES.some(option => option.value === type)).map(type => ({ value: type, label: type }));
  const options = [...QUOTATION_POST_TYPES, ...custom].filter(option => `${option.label} ${option.value}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="qx-ms">
    <div className="qx-ms__top">
      <input className="in in--xs" aria-label="Search services" placeholder="Search services…" value={query} onChange={event => setQuery(event.target.value)} />
      <label className="q-inline-select-all"><input type="checkbox" checked={all} ref={element => { if (element) element.indeterminate = !all && value.length > 0; }} disabled={disabled || !available.length}
        onChange={event => onChange(event.target.checked ? [...new Set([...value, ...available])] : [])} />Select all available ({available.length})</label>
      <button type="button" className="b b--xs" disabled={disabled || !value.length} onClick={() => onChange([])}>Clear all</button>
    </div>
    <div className="qx-ms__list" aria-label="Service types">
      {!options.length && <p className="q-help">No services match your search.</p>}
      {options.map(option => { const allowed = isPostTypeAllowedForCreator(option.value, allowedPlatforms); const selected = value.includes(option.value);
        return <label key={option.value} className={`qx-ms__i ${selected ? "on" : ""} ${allowed ? "" : "off"}`}>
          <input type="checkbox" checked={selected} disabled={disabled || (!allowed && !selected)} onChange={() => onChange(toggleDeliverableType(value, option.value))} />
          <span>{option.label}</span>{!allowed && <small>Unavailable on this creator</small>}
        </label>;
      })}
    </div>
  </div>;
}
