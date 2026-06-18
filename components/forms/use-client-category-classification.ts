"use client";

import { useEffect, useRef, useState } from "react";

import { classifyClientCategoryAction } from "@/features/clients/classify-category-action";

type ClassificationResult = {
  categorySlug: string;
  subcategorySlug: string;
  confidence: "high" | "medium" | "low";
  source: "web_search" | "keyword";
};

export const CLIENT_CATEGORY_PAUSE_MESSAGE =
  "Auto-suggest paused — change name to re-classify";

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
  const requestIdRef = useRef(0);
  const lastSuccessKeyRef = useRef("");
  const prevCompanyNameRef = useRef(companyName);
  const onClassifiedRef = useRef(onClassified);
  onClassifiedRef.current = onClassified;

  useEffect(() => {
    const trimmed = companyName.trim();
    if (prevCompanyNameRef.current.trim() !== trimmed) {
      lastSuccessKeyRef.current = "";
      prevCompanyNameRef.current = companyName;
    }

    if (!enabled || trimmed.length < 3) {
      setClassifying(false);
      setMessage(null);
      return;
    }

    const requestKey = `${trimmed}|${country ?? ""}|${website ?? ""}`;
    if (requestKey === lastSuccessKeyRef.current) {
      setClassifying(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setClassifying(true);
    setMessage(null);

    const timer = window.setTimeout(async () => {
      try {
        const result = await classifyClientCategoryAction({
          name: trimmed,
          country: country || undefined,
          website: website || undefined,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!result.ok || !result.categorySlug || !result.subcategorySlug) {
          setMessage(
            result.message ??
              "No automatic match — choose category below if needed."
          );
          return;
        }

        lastSuccessKeyRef.current = requestKey;
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
        if (requestId !== requestIdRef.current) {
          return;
        }
        setMessage("Classification unavailable — choose category below.");
      } finally {
        if (requestId === requestIdRef.current) {
          setClassifying(false);
        }
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [companyName, country, website, enabled]);

  function resetClassificationRequest() {
    lastSuccessKeyRef.current = "";
    requestIdRef.current += 1;
    setClassifying(false);
    setMessage(null);
  }

  return { classifying, message, resetClassificationRequest };
}
