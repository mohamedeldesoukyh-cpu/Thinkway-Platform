"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  recommendationColor,
  recommendationLabel,
  resolveAssessmentDisplayName,
} from "../services/client-creator-assessment";
import type { ClientCreatorAssessment } from "../types";

type ClientCreatorEvaluatorProps = {
  assessments: ClientCreatorAssessment[];
  onEvaluateUrls: (urls: string[]) => ClientCreatorAssessment[];
  className?: string;
};

export function ClientCreatorEvaluator({
  assessments,
  onEvaluateUrls,
  className,
}: ClientCreatorEvaluatorProps) {
  const [urlInput, setUrlInput] = useState("");
  const [localAssessments, setLocalAssessments] = useState(assessments);

  const handleEvaluate = () => {
    const urls = urlInput
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setLocalAssessments(onEvaluateUrls(urls));
  };

  const display = localAssessments.length > 0 ? localAssessments : assessments;

  return (
    <Card size="sm" className={cn("rounded-2xl border-border/80 shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Client Creator Evaluation</CardTitle>
        <p className="text-xs text-muted-foreground">
          Paste Instagram, TikTok, or YouTube URLs
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://instagram.com/creator&#10;https://tiktok.com/@creator"
          rows={3}
          className="text-xs"
        />
        <div className="flex gap-2">
          <Input placeholder="Search existing creators…" className="h-8 text-xs" disabled />
          <Button
            type="button"
            size="sm"
            className="h-8 bg-[#1D9E75] hover:bg-[#178f68]"
            onClick={handleEvaluate}
          >
            Evaluate
          </Button>
        </div>

        <div className="space-y-2">
          {display.map((item) => (
            <div
              key={item.creatorId}
              className="rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{resolveAssessmentDisplayName(item)}</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    recommendationColor(item.recommendation)
                  )}
                >
                  {recommendationLabel(item.recommendation)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                <span>Audience {item.audienceMatch}%</span>
                <span>Brand Fit {item.brandFit}</span>
                <span>Overlap {item.overlap}%</span>
                <span>ER {item.clientCreator.engagementRate.toFixed(1)}%</span>
                <span>CPM {item.clientCreator.cpm}</span>
                <span>Risk {item.riskLevel}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-foreground/80">{item.reason}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
