"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { StarIcon } from "lucide-react";
import { setShortlistCreatorRecommendation } from "../actions";
export function ShortlistRecommendationButton({ shortlistId, itemId, rank, name, disabled }: { shortlistId: string; itemId: string; rank?: number; name: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <span className="inline-flex flex-col items-start">
    <button type="button" aria-pressed={Boolean(rank)} aria-label={rank ? "Remove recommendation " + rank + " for " + name : "Recommend " + name}
      title={rank ? "Recommendation " + rank + ". Click to remove star." : "Star as a high recommendation"}
      disabled={disabled || pending} className={"inline-flex min-h-8 items-center gap-1 rounded px-1 text-xs disabled:opacity-50 " + (rank ? "text-amber-700" : "text-slate-500")}
      onClick={event => { event.stopPropagation(); startTransition(async () => { setError(""); try { const result = await setShortlistCreatorRecommendation(shortlistId, itemId, !rank); if (!result.ok) setError(result.message); else router.refresh(); } catch { setError("Unable to save star. Try again."); } }); }}>
      <StarIcon className="size-4" fill={rank ? "currentColor" : "none"} aria-hidden="true" />{rank ?? "Recommend"}
    </button>{error && <span role="alert" className="text-xs text-red-600">{error}</span>}
  </span>;
}
