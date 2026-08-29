"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  scriptLanguageLabel,
  scriptOriginBadge,
  type CampaignScriptMasterView,
  type ScriptLanguage,
} from "@/lib/campaign-script";

export function ScriptLanguageField({
  language,
  sourceLanguage,
  origin,
  value,
  translationStatus,
  translationTargetLanguage,
  stale,
  disabled,
  onChange,
}: {
  language: ScriptLanguage;
  sourceLanguage: ScriptLanguage;
  origin: CampaignScriptMasterView["enOrigin"];
  value: string;
  translationStatus?: CampaignScriptMasterView["translationStatus"];
  translationTargetLanguage?: CampaignScriptMasterView["translationTargetLanguage"];
  stale: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const isTarget =
    translationStatus === "pending" || translationStatus === "failed"
      ? language === translationTargetLanguage
      : language !== sourceLanguage;
  return (
    <div>
      <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--camp-text-3)]">
        {scriptOriginBadge({
          language,
          sourceLanguage,
          origin,
          body: value,
          translationStatus: isTarget ? translationStatus : undefined,
          stale: isTarget ? stale : false,
        })}
      </p>
      <Textarea
        value={value}
        disabled={disabled}
        readOnly={disabled}
        dir={language === "ar" ? "rtl" : "ltr"}
        lang={language}
        placeholder={
          language === sourceLanguage
            ? `Paste the ${scriptLanguageLabel(language).toLowerCase()} script`
            : translationStatus === "pending"
              ? `${scriptLanguageLabel(language)} translation pending`
              : `${scriptLanguageLabel(language)} translation`
        }
        className="min-h-[220px] text-[12.5px] leading-relaxed"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function ScriptOriginalLanguageLabel() {
  return <Label className="text-[11px] text-[var(--camp-text-3)]">Original language</Label>;
}
