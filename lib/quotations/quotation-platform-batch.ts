import type { QuotationCreatorPlatformOption } from "@/features/quotations/actions";

type Ref = { unified_id?: string | null; influencer_id?: string | null; profile_id?: string | null };
type Pending = { ref: Ref; resolve: (value: QuotationCreatorPlatformOption[]) => void; reject: (error: unknown) => void };
let pending: Pending[] = [];

async function flush() {
  const batch = pending;
  pending = [];
  for (let start = 0; start < batch.length; start += 100) {
    const chunk = batch.slice(start, start + 100);
    void (async () => {
      try {
        const response = await fetch("/api/quotations/creator-platforms", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunk.map(item => item.ref)),
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) throw new Error("Could not load creator platforms");
        const rows: QuotationCreatorPlatformOption[][] = await response.json();
        if (!Array.isArray(rows) || rows.length !== chunk.length || rows.some(row => !Array.isArray(row))) {
          throw new Error("Invalid creator platform response");
        }
        chunk.forEach((item, index) => item.resolve(rows[index]));
      } catch (error) {
        chunk.forEach(item => item.reject(error));
      }
    })();
  }
}

/** Coalesce creator headers and the export selector into one read per render turn. */
export function requestCreatorPlatforms(ref: Ref): Promise<QuotationCreatorPlatformOption[]> {
  return new Promise((resolve, reject) => {
    pending.push({ ref, resolve, reject });
    if (pending.length === 1) queueMicrotask(flush);
  });
}
