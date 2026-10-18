import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon, EyeIcon } from "lucide-react";
import { setQuotationTemplatePhoto } from "@/features/quotations/actions";
import { TEMPLATE_PHOTO_MAX_BYTES } from "@/lib/quotations/quotation-template-photos";
import styles from "@/features/discovery/document-preview/creator-dialog.module.css";

/** Inherits the ordering dialog's client boundary. Photo saves remain explicit and independent of ordering. */
export function QuotationTemplatePhotoEditor({ quotationId, itemId, name, optionCount, original, current, disabled, onBusy, onApplied, controls, savePhoto = setQuotationTemplatePhoto, documentLabel = "quotation", detailLabel }: {
  savePhoto?: typeof setQuotationTemplatePhoto; documentLabel?: string; detailLabel?: string;
  quotationId: string; itemId: string; name: string; optionCount: number; original: string | null; current?: string;
  disabled: boolean; onBusy: (busy: boolean) => void; onApplied: (photo: string | null) => void; controls: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const src = preview || current || original;
  function discard() { setFile(null); if (input.current) input.current.value = ""; }
  function focusUpload() { requestAnimationFrame(() => uploadButton.current?.focus()); }
  async function apply(reset = false) {
    if (busy || disabled) return;
    setError(""); setStatus(""); setBusy(true); onBusy(true);
    try {
      const form = new FormData();
      if (reset) form.set("reset", "true"); else if (file) form.set("file", file); else return;
      const result = await savePhoto(quotationId, itemId, form);
      if (!result.ok) { setError(result.message); return; }
      onApplied(result.photo); discard();
      setStatus(reset ? "Profile photo restored for templates and the linked workspace." : `Photo applied to this ${documentLabel}'s templates and linked workspace.`);
    } catch { setError("Could not apply this photo. Please try again."); }
    finally { setBusy(false); onBusy(false); focusUpload(); }
  }
  return <>
    <div className={styles.thumbnail}>
      {src && src !== failedSrc ? <img src={src} alt={`${name} ${documentLabel} photo`} onError={() => setFailedSrc(src)} /> : <span className={styles.initials}>{name.trim().slice(0, 2).toUpperCase()}</span>}
      {file || current ? <span className={styles.photoBadge} title={file ? "Photo preview" : `Custom ${documentLabel} photo`}>{file ? <EyeIcon size={12} aria-hidden="true" /> : <CheckIcon size={12} aria-hidden="true" />}</span> : null}
    </div>
    <div className={styles.identity}>
      <strong dir="auto">{name}</strong>
      <span>{detailLabel ?? `${optionCount} ${optionCount === 1 ? "option" : "options"}`} &middot; {current ? `custom ${documentLabel} photo` : "profile photo"}</span>
    </div>
    <div className={styles.photoActions}>
      <button ref={uploadButton} type="button" className={`${styles.button} ${styles.small}`} disabled={disabled || busy} aria-label={`${current ? "Replace" : "Upload"} photo for ${name}`} onClick={() => input.current?.click()}>{current ? "Replace photo" : "Upload photo"}</button>
      <input ref={input} id={`template-photo-${itemId}`} aria-label={`Upload template photo for ${name}`} hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} onChange={event => {
        const chosen = event.target.files?.[0] ?? null;
        if (!chosen) return;
        setError(""); setStatus("");
        if (chosen.size > TEMPLATE_PHOTO_MAX_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(chosen.type)) {
          setError(chosen.size > TEMPLATE_PHOTO_MAX_BYTES ? `That photo is ${Math.ceil(chosen.size / 1000)} KB. The limit is 750 KB.` : `That file is a ${chosen.type || "unsupported format"}. Use JPG, PNG or WebP.`); discard(); focusUpload(); return;
        }
        setFile(chosen);
      }} />
      {current && !file ? <button type="button" className={`${styles.button} ${styles.small} ${styles.ghost}`} disabled={disabled || busy} aria-label={`Reset photo for ${name}`} onClick={() => void apply(true)}>{busy ? "Restoring..." : "Reset"}</button> : null}
    </div>
    {controls}
    {file ? <div className={styles.pendingPhoto}>
      <span>{file.name}<small>Preview only. Apply photo to save.</small></span>
      <button type="button" className={`${styles.button} ${styles.small} ${styles.primary}`} disabled={disabled || busy} onClick={() => void apply()}>{busy ? "Applying..." : "Apply photo"}</button>
      <button type="button" className={`${styles.button} ${styles.small}`} disabled={disabled || busy} onClick={() => { discard(); focusUpload(); }}>Discard photo</button>
    </div> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <span role="status" className="sr-only">{status}</span>
  </>;
}
