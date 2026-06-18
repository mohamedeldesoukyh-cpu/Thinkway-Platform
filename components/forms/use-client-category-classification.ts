"use client";

import { useEffect, useRef, useState } from "react";

import { classifyClientCategoryAction } from "@/features/clients/actions";

type ClassificationResult = {
  categorySlug: string;
  subcategorySlug: string;
  confidence: "high" | "medium" | "low";
  source: "web_search" | "keyword";
};

type UseClientCategoryClassificationOptions = {
  companyName: string;
  country?: string;
  website?: string;
  enabled?: boolean;
  onClassified?: (result: ClassificationResult) => void;
};

export function useClientCategoryClassification({
  companyName,
  country,
  website,
  enabled = true,
  onClassified,
}: UseClientCategoryClassificationOptions) {
  const [classifying, setClassifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lastRequested = useRef("");
  const onClassifiedRef = useRef(onClassified);
  onClassifiedRef.current = onClassified;

  useEffect(() => {
    const trimmed = companyName.trim();
    if (!enabled || trimmed.length < 3) {
      setClassifying(false);
      setMessage(null);
      return;
    }

    const requestKey = `${trimmed}|${country ?? ""}|${website ?? ""}`;
    if (requestKey === lastRequested.current) {
      return;
    }

    let cancelled = false;
    setClassifying(true);
    setMessage("Classifying…");

    const timer = window.setTimeout(async () => {
      lastRequested.current = requestKey;
      try {
        const result = await classifyClientCategoryAction({
          name: trimmed,
          country: country || undefined,
          website: website || undefined,
        });

        if (cancelled) {
          return;
        }

        if (!result.ok || !result.categorySlug || !result.subcategorySlug) {
          setMessage(result.message ?? null);
          return;
        }

        onClassifiedRef.current?.({
          categorySlug: result.categorySlug,
          subcategorySlug: result.subcategorySlug,
          confidence: result.confidence ?? "low",
          source: result.source ?? "keyword",
        });

        const sourceLabel =
          result.source === "web_search" ? "web lookup" : "name matching";
        setMessage(
          `Suggested from ${sourceLabel}${
            result.confidence ? ` (${result.confidence} confidence)` : ""
          }. You can override below.`
        );
      } catch {
        if (!cancelled) {
          setMessage(null);
        }
      } finally {
        if (!cancelled) {
          setClassifying(false);
        }
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [companyName, country, website, enabled]);

  function resetClassificationRequest() {
    lastRequested.current = "";
    setMessage(null);
  }

  return { classifying, message, resetClassificationRequest };
}
