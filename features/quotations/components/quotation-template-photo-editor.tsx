import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { setQuotationTemplatePhoto } from "@/features/quotations/actions";
import { TEMPLATE_PHOTO_MAX_BYTES } from "@/lib/quotations/quotation-template-photos";

/** Inherits the ordering dialog's client boundary. Changes apply explicitly, independently of ordering. */
export function QuotationTemplatePhotoEditor({ quotationId, itemId, name, original, current, disabled, onBusy, onApplied }: {
  quotationId: string; itemId: string; name: string; original: string | null; current?: string;
  disabled: boolean; onBusy: (busy: boolean) => void; onApplied: (photo: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const src = preview || current || original;
  function discard() { setFile(null); if (input.current) input.current.value = ""; }
  async function apply(reset = false) {
    if (busy || disabled) return;
    setError(""); setStatus(""); setBusy(true); onBusy(true);
    try {
      const form = new FormData();
      if (reset) form.set("reset", "true"); else if (file) form.set("file", file); else return;
      const result = await setQuotationTemplatePhoto(quotationId, itemId, form);
      if (!result.ok) { setError(result.message); return; }
      onApplied(result.photo); discard();
      setStatus(reset ? "Profile photo restored for templates and the linked workspace." : "Photo applied to this quotation’s templates and linked workspace.");
    } catch { setError("Could not apply this photo. Please try again."); }
    finally { setBusy(false); onBusy(false); requestAnimationFrame(() => input.current?.focus()); }
  }
  return <div className="w-full min-w-0 border-t pt-3">
    <div className="flex items-start gap-3">
      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {src ? <img key={src} src={src} alt={`${name} template photo`} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-muted-foreground">No photo</span>}
      </div>
      <div className="min-w-0 flex-1">
        <label className="block text-sm font-medium" htmlFor={`template-photo-${itemId}`}>Quotation photo</label>
        <input ref={input} id={`template-photo-${itemId}`} aria-label={`Upload template photo for ${name}`} className="mt-1 block min-h-11 w-full min-w-0 max-w-full text-xs file:mr-2 file:min-h-11 file:rounded-md file:border file:bg-background file:px-2 file:text-foreground" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} onChange={event => {
          const chosen = event.target.files?.[0] ?? null;
          setError(""); setStatus("");
          if (chosen && (chosen.size > TEMPLATE_PHOTO_MAX_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(chosen.type))) {
            setError("Choose a JPG, PNG or WebP photo up to 750 KB."); discard(); return;
          }
          setFile(chosen);
        }} />
        {file ? <p className="mt-1 break-all text-xs text-muted-foreground">{file.name}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {file ? <><Button type="button" className="min-h-11" size="sm" disabled={disabled || busy} onClick={() => void apply()}> {busy ? "Applying…" : "Apply photo"}</Button><Button type="button" className="min-h-11" variant="outline" size="sm" disabled={disabled || busy} onClick={discard}>Discard photo</Button></> : null}
          {current && !file ? <Button type="button" className="min-h-11" variant="outline" size="sm" disabled={disabled || busy} onClick={() => void apply(true)}>{busy ? "Restoring…" : "Use profile photo"}</Button> : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{file ? "Preview only — choose Apply photo to save." : current ? "Custom quotation photo" : "Current profile photo"}</p>
      </div>
    </div>
    {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
    <p role="status" className="mt-1 text-xs text-muted-foreground">{status}</p>
  </div>;
}
