"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ClientIoTermsEditor } from "./client-io-terms-editor";
import type { VendorIoRow } from "@/features/io/types";
import { resolveEffectiveVendorIoTerms, serializeTermsText, type ClientIoTerm } from "@/lib/io/client-io-terms";
import { updateVendorIoConditionsAction } from "../update-vendor-io-conditions-action";

export function VendorIoConditionsEditor({ row, effective }: { row: VendorIoRow; effective: ClientIoTerm[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState(effective);
  const [saved, setSaved] = useState<ClientIoTerm[] | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [inherit, setInherit] = useState(false);
  const country = { override: row.compliance_country_code, creatorCountry: row.creator_country_code };
  const displayed = saved ?? effective;

  if (!editing) return <div className="space-y-3">
    <Button type="button" variant="outline" size="sm" disabled={row.is_superseded}
      onClick={() => { setTerms(displayed.map(term => ({ ...term }))); setInherit(false); setMessage(""); setEditing(true); }}>
      Edit terms
    </Button>
    <ul className="space-y-2 text-sm text-foreground">
      {displayed.map((term, index) => <li key={index} className="break-words">
        <span className="font-medium">{index + 1}. {term.title}</span>{" "}
        <span className="text-muted-foreground">{term.body}</span>
      </li>)}
    </ul>
  </div>;

  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      try {
        const result = await updateVendorIoConditionsAction({
          id: row.id, campaignId: row.campaign_header_id, updatedAt: row.updated_at, terms: inherit ? null : terms,
        });
        if (!result.ok) { setMessage(result.message); return; }
        setSaved(resolveEffectiveVendorIoTerms(row.vendor_io_terms_text, inherit ? null : serializeTermsText(terms), country));
        setEditing(false);
        toast.success(result.message);
        router.refresh();
      } catch { setMessage("Could not save terms. Your edits are still here; please try again."); }
    });
  }}>
    <ClientIoTermsEditor terms={terms} onChange={next => { setTerms(next); setInherit(false); }} disabled={pending}
      isTermReadOnly={term => term.title.startsWith("Compliance with Local Laws")}
      onRecover={() => { setTerms(resolveEffectiveVendorIoTerms(row.vendor_io_terms_text, null, country)); setInherit(true); }}
      recoverLabel="Restore default"
      description="Changes apply only to this IO and its document. Restore default loads the creator’s vendor defaults, or platform defaults if none exist; save to apply. Local compliance wording follows the country selected above." />
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    <div className="sticky bottom-0 flex gap-2 border-t bg-background py-3">
      <Button type="submit" disabled={pending || terms.some(term => !term.title.trim() || !term.body.trim())}>
        {pending ? "Saving…" : "Save terms"}
      </Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(false)}>Cancel</Button>
    </div>
  </form>;
}
