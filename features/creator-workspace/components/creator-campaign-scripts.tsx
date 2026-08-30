"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { downloadCreatorUnitScriptOriginalAction } from "@/features/creator-workspace/actions";
import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";
import { campaignScriptDownloadFileName, campaignScriptDownloadText } from "@/lib/campaign-script";

export function CreatorCampaignScripts({ units }: { units: CreatorUnitView[] }) {
  const withScripts = units.filter((unit) => unit.hasScript && unit.script);
  if (withScripts.length === 0) {
    return (
      <p className="rounded-2xl border border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No script has been provided for this campaign yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {withScripts.map((unit) => (
        <CreatorScriptCard key={unit.unitKey} unit={unit} />
      ))}
    </div>
  );
}

function CreatorScriptCard({ unit }: { unit: CreatorUnitView }) {
  const script = unit.script!;
  const [scriptLang, setScriptLang] = useState<"en" | "ar">(
    script.sourceLanguage === "ar" ? "ar" : "en"
  );
  const [pending, startTransition] = useTransition();
  const scriptBody = scriptLang === "ar" ? script.bodyAr : script.bodyEn;
  const hasLang = Boolean(scriptBody.trim());

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="font-semibold">{unit.label}</p>
          <p className="text-xs text-muted-foreground">
            Script / content direction
            {unit.platform ? ` · ${unit.platform}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {script.bodyEn.trim() ? (
            <Button
              type="button"
              size="sm"
              variant={scriptLang === "en" ? "default" : "outline"}
              onClick={() => setScriptLang("en")}
            >
              English
            </Button>
          ) : null}
          {script.bodyAr.trim() ? (
            <Button
              type="button"
              size="sm"
              variant={scriptLang === "ar" ? "default" : "outline"}
              onClick={() => setScriptLang("ar")}
            >
              Arabic
            </Button>
          ) : null}
        </div>
        {hasLang ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
            {scriptBody}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">No text in this language.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {hasLang ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                const downloaded = campaignScriptDownloadText({
                  language: scriptLang,
                  bodyEn: script.bodyEn,
                  bodyAr: script.bodyAr,
                });
                if (!downloaded.ok) {
                  toast.error(downloaded.message);
                  return;
                }
                const blob = new Blob([downloaded.text], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = campaignScriptDownloadFileName(unit.label, scriptLang);
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download text
            </Button>
          ) : null}
          {script.hasOriginalDocument ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => {
                startTransition(() => {
                  void (async () => {
                    const result = await downloadCreatorUnitScriptOriginalAction({
                      campaignHeaderId: unit.campaignHeaderId,
                      assignmentDeliverableId: unit.assignmentDeliverableId,
                      assignmentPostScheduleId: unit.assignmentPostScheduleId,
                    });
                    if (!result.ok) {
                      toast.error(result.message);
                      return;
                    }
                    window.open(result.data.url, "_blank", "noopener,noreferrer");
                  })();
                });
              }}
            >
              Download original
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
