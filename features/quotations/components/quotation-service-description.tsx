"use client";

import { useState } from "react";

/** A wrapping sentence at rest, with the prototype's single-click inline editor. */
export function QuotationServiceDescription({ value, derived, readOnly, onChange }: {
  value: string; derived: string; readOnly: boolean; onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  function commit() {
    setEditing(false);
    if (draft.trim() !== value) onChange(draft.trim());
  }
  if (editing) return <input autoFocus className="in in--xs qx-svc__descin" aria-label="Service description" value={draft} placeholder={derived || "Describe this package"}
    onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => {
      if (event.key === "Enter") { event.preventDefault(); commit(); }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setEditing(false); }
    }} />;
  return <button type="button" className={`qx-svc__desc ${!value || value === derived ? "qx-svc__desc--derived" : ""}`} disabled={readOnly}
    title="Click to edit the service description" onClick={() => { setDraft(value); setEditing(true); }}>
    {value || derived || "Add a description"}
  </button>;
}
