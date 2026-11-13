// Inherits the client boundary from add-creators-to-quotation-modal.tsx.

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { addQuotationProfileLinks, previewQuotationProfileLinks } from "../quotation-profile-link-actions";
import { parseQuotationProfileLinks, QUOTATION_LINK_LIMIT, type QuotationLinkPreview, type QuotationLinkOutcome } from "../quotation-profile-links";

export function QuotationCreatorLinkTab({ quotationId, onAdded, onPendingChange }: {
  quotationId: string;
  onAdded: (result: { itemIds?: string[] }) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ raw: string; preview?: QuotationLinkPreview; error?: string } | null>(null);
  const [outcome, setOutcome] = useState<QuotationLinkOutcome | null>(null);
  const [pending, startTransition] = useTransition();
  const latch = useRef(false);
  const parsed = parseQuotationProfileLinks(raw);
  const preview = checked?.raw === raw ? checked.preview : undefined;
  const previewError = checked?.raw === raw ? checked.error : undefined;
  const overLimit = parsed.profiles.length > QUOTATION_LINK_LIMIT;

  useEffect(() => {
    if (!raw.trim() || !parseQuotationProfileLinks(raw).profiles.length) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void previewQuotationProfileLinks(quotationId, raw).then(result => {
        if (!cancelled) setChecked(result.ok ? { raw, preview: result.preview } : { raw, error: result.message });
      }).catch(() => { if (!cancelled) setChecked({ raw, error: "Could not check Discovery. Edit the paste to retry." }); });
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [raw, quotationId]);

  function addCreators() {
    if (latch.current || !preview || !preview.toAdd || overLimit) return;
    latch.current = true;
    onPendingChange(true);
    setError(null);
    startTransition(async () => {
      try {
        const result = await addQuotationProfileLinks(quotationId, raw);
        if (!result.ok) { setError(result.message); return; }
        setOutcome(result.outcome);
      } catch {
        setError("Could not complete the import. Retry safely; creators already added will be skipped.");
      } finally { latch.current = false; onPendingChange(false); }
    });
  }

  if (outcome) return <div className="space-y-4" aria-live="polite">
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <b>{outcome.added} creator{outcome.added === 1 ? "" : "s"} added to quotation</b>
      <p className="mt-1">{outcome.existing} existing Discovery · {outcome.created} new · {outcome.skipped} already in quotation skipped</p>
    </div>
    {outcome.failed.length > 0 && <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <b>{outcome.failed.length} links could not be added</b>
      {outcome.failed.map(failure => <p key={failure.url} className="break-all">{failure.url}: {failure.message}</p>)}
      <Button type="button" onClick={() => { setRaw(outcome.failed.map(f => f.url).join("\n")); setChecked(null); setOutcome(null); }}>Retry failed links</Button>
    </div>}
    <Button type="button" onClick={() => onAdded({ itemIds: outcome.itemIds })}>Done</Button>
  </div>;

  return <div className="space-y-3">
    <Label htmlFor="quotation-creator-profile-links">Creator profile links</Label>
    <Textarea id="quotation-creator-profile-links" value={raw} disabled={pending} rows={7}
      className="min-h-40 resize-y rounded-lg border-slate-200 bg-white font-mono text-sm"
      placeholder={"Paste links or text containing profile links…\nhttps://www.instagram.com/username/\nhttps://www.tiktok.com/@username"}
      onChange={event => { setRaw(event.target.value); setError(null); }} />
    <p className="text-xs leading-relaxed text-slate-500">Only profile links are extracted from pasted text. Up to {QUOTATION_LINK_LIMIT} unique links per batch. Existing Discovery profiles are reused without enrichment; creators already in this quotation are skipped.</p>
    {parsed.profiles.length > 0 && <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm" aria-live="polite">
      <b>{parsed.profiles.length} unique profile links detected</b>
      {preview ? <>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <span>In Discovery: <b>{preview.alreadyInDiscovery}</b></span>
          <span>New creators: <b>{preview.newCreators}</b></span>
          <span>Already in quotation: <b>{preview.alreadyInQuotation}</b></span>
          <span>Duplicates skipped: <b>{preview.duplicates}</b></span>
        </div>
        <p className="mt-3 font-semibold text-blue-700">{preview.toAdd} creators to add</p>
      </> : <p className="mt-2 text-xs text-slate-500">{previewError ?? (overLimit ? `Limit: ${QUOTATION_LINK_LIMIT} unique links per batch.` : "Checking Discovery and this quotation…")}</p>}
      <ul className="mt-3 max-h-28 overflow-y-auto border-t pt-2 text-xs text-slate-500">
        {parsed.profiles.slice(0, QUOTATION_LINK_LIMIT).map(profile => <li key={profile.normalized_profile_url} className="break-all">{profile.normalized_profile_url}</li>)}
      </ul>
    </div>}
    {parsed.invalid.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <b>{parsed.invalid.length} unsupported or non-profile links will be ignored</b>
      {parsed.invalid.map((url, index) => <p className="break-all" key={`${index}:${url}`}>{url}</p>)}
    </div>}
    {raw.trim() && !parsed.profiles.length && <p role="alert" className="text-sm text-amber-700">No supported profile links found. Paste Instagram, TikTok, YouTube, Facebook, Snapchat, or X profile URLs.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" disabled={pending || !preview?.toAdd || overLimit} onClick={addCreators}>
      {pending ? "Adding creators…" : `Add ${preview?.toAdd ?? 0} creators to quotation`}
    </Button>
    {pending && <p role="status" className="text-xs text-slate-500">Adding creators. Keep this popup open until the batch finishes.</p>}
  </div>;
}
