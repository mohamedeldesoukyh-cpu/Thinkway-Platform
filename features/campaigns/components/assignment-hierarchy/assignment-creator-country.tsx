
import { useEffect, useId, useState } from "react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { COUNTRY_OPTIONS } from "@/features/vendors/constants";
import { loadCreatorCountry, saveCreatorCountry } from "@/features/vendors/creator-country-actions";

export function AssignmentCreatorCountry({ creatorId }: { creatorId: string }) {
  const id = useId();
  const [country, setCountry] = useState("");
  const [saved, setSaved] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    loadCreatorCountry(creatorId).then((result) => {
      if (!active) return;
      setCountry(result.country);
      setSaved(result.country);
      setCanEdit(result.canEdit);
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : "Could not load country.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [creatorId]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const value = await saveCreatorCountry(creatorId, country);
      setCountry(value);
      setSaved(value);
      setMessage("Country saved to the shared creator profile.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save country. Please retry.");
    } finally { setSaving(false); }
  }

  return (
    <section className="space-y-2 border-b p-5">
      <label htmlFor={id} className="text-sm font-medium">Creator country</label>
      <div className="flex flex-wrap items-center gap-2">
        <SearchableSelect id={id} value={country} onValueChange={(value) => { setCountry(value); setMessage(""); }}
          options={COUNTRY_OPTIONS} disabled={loading || saving || !canEdit} className="min-w-0 flex-1"
          placeholder={loading ? "Loading country…" : "Select country"} searchPlaceholder="Search countries…" />
        {canEdit && <Button type="button" onClick={save} disabled={saving || !country || country === saved}>{saving ? "Saving…" : "Save country"}</Button>}
      </div>
      <p className="text-xs text-muted-foreground" role="status">{message || "Shared with CRM and the other creator detail cards."}</p>
    </section>
  );
}
