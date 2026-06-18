"use client";

import { useEffect, useRef, useState } from "react";

import {
  classifyClientCategoryAction,
  getClientCategoryClassificationCapabilitiesAction,
} from "@/features/clients/classify-category-action";

type ClassificationResult = {
  categorySlug: string;
  subcategorySlug: string;
  confidence: "high" | "medium" | "low";
  source: "ai" | "web_search" | "keyword";
};

export const CLIENT_CATEGORY_PAUSE_MESSAGE =
  "Auto-suggest paused — change name to re-classify";

function sourceLabel(source: ClassificationResult["source"]): string {
  switch (source) {
    case "ai":
      return "AI analysis";
    case "web_search":
      return "web lookup";
    default:
      return "name matching";
  }
}

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
  const [aiAvailable, setAiAvailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const lastSuccessKeyRef = useRef("");
  const prevCompanyNameRef = useRef(companyName);
  const onClassifiedRef = useRef(onClassified);
  onClassifiedRef.current = onClassified;

  useEffect(() => {
    let cancelled = false;

    void getClientCategoryClassificationCapabilitiesAction().then((capabilities) => {
      if (!cancelled) {
        setAiAvailable(capabilities.aiAvailable);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

    const debounceMs = aiAvailable ? 900 : 700;

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
        const source = result.source ?? "keyword";
        onClassifiedRef.current?.({
          categorySlug: result.categorySlug,
          subcategorySlug: result.subcategorySlug,
          confidence: result.confidence ?? "low",
          source,
        });

        setMessage(
          `Suggested from ${sourceLabel(source)}${
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
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [companyName, country, website, enabled, aiAvailable]);

  function resetClassificationRequest() {
    lastSuccessKeyRef.current = "";
    requestIdRef.current += 1;
    setClassifying(false);
    setMessage(null);
  }

  const classifyingLabel =
    classifying && aiAvailable ? "Classifying with AI…" : classifying ? "Classifying…" : null;

  return {
    classifying,
    classifyingLabel,
    aiAvailable,
    message,
    resetClassificationRequest,
  };
}
