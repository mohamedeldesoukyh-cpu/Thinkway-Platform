"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDownIcon, FileUpIcon, LanguagesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScriptLanguageField, ScriptOriginalLanguageLabel } from "@/features/campaigns/components/script/campaign-script-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AuroraStatusPill,
} from "@/features/campaigns/components/aurora/campaign-workspace-frame";
import {
  extractCampaignScriptFileAction,
  loadCampaignScriptAction,
  saveCampaignScriptAction,
  translateCampaignScriptAction,
} from "@/features/campaigns/actions/campaign-script-actions";
import {
  SCRIPT_REPLACE_BOTH_LANGUAGES_CONFIRM,
  availableScriptTranslateTargets,
  formatScriptCurrentLabel,
  isHumanTranslationStale,
  mergeExtractedScriptText,
  resolveScriptOrigins,
  scriptConflictActorLabel,
  scriptHasContentToReplace,
  scriptLanguageLabel,
  scriptRegenerateConfirmMessage,
  scriptRetryTargetLanguage,
  translationStatusBanner,
  type CampaignScriptMasterView,
  type ScriptLanguage,
} from "@/lib/campaign-script";

type Draft = {
  sourceLanguage: ScriptLanguage;
  bodyEn: string;
  bodyAr: string;
  originalFileName: string | null;
};

const EMPTY_DRAFT: Draft = {
  sourceLanguage: "en",
  bodyEn: "",
  bodyAr: "",
  originalFileName: null,
};

function draftFromScript(script: CampaignScriptMasterView): Draft {
  return {
    sourceLanguage: script.sourceLanguage,
    bodyEn: script.bodyEn,
    bodyAr: script.bodyAr,
    originalFileName: script.originalFileName,
  };
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    a.sourceLanguage === b.sourceLanguage &&
    a.bodyEn === b.bodyEn &&
    a.bodyAr === b.bodyAr
  );
}

export function CampaignScriptRegister({ campaignId }: { campaignId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [script, setScript] = useState<CampaignScriptMasterView | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [baseline, setBaseline] = useState<Draft>(EMPTY_DRAFT);
  const [conflict, setConflict] = useState<CampaignScriptMasterView | null>(null);
  const [mixedLanguage, setMixedLanguage] = useState(false);
  const [replaceBothLanguages, setReplaceBothLanguages] = useState(false);
  const uploadPreserveRef = useRef<{
    extractedText: string;
    existingBodyEn: string;
    existingBodyAr: string;
    replaceBothLanguages: boolean;
  } | null>(null);

  const expectedRevisionId = script?.currentRevisionId ?? null;
  const dirty = !draftsEqual(draft, baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const origins = resolveScriptOrigins({
    sourceLanguage: draft.sourceLanguage,
    bodyEn: draft.bodyEn,
    bodyAr: draft.bodyAr,
    previous: script,
  });
  const staleHumanTranslation = script ? isHumanTranslationStale(script) : false;
  const translationBanner = script
    ? translationStatusBanner({
        sourceLanguage: script.sourceLanguage,
        translationStatus: script.translationStatus,
        translationTargetLanguage: script.translationTargetLanguage,
        translationError: script.translationError,
        staleHumanTranslation,
      })
    : null;
  const translateTargets = availableScriptTranslateTargets(draft.bodyEn, draft.bodyAr);
  const retryTarget = script ? scriptRetryTargetLanguage(script) : null;
  const translating = script?.translationStatus === "pending";
  const canTranslate =
    Boolean(script) && !dirty && !pending && !loading && !translating && translateTargets.length > 0;

  const applyScript = useCallback((next: CampaignScriptMasterView | null) => {
    const nextDraft = next ? draftFromScript(next) : EMPTY_DRAFT;
    setScript(next);
    setDraft(nextDraft);
    setBaseline(nextDraft);
    setConflict(null);
    setMixedLanguage(false);
    uploadPreserveRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadCampaignScriptAction({ campaignId }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.message);
        setLoading(false);
        return;
      }
      applyScript(result.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [applyScript, campaignId]);

  useEffect(() => {
    if (loading || dirty || script?.translationStatus !== "pending") return;
    let cancelled = false;
    const poll = () => {
      void loadCampaignScriptAction({ campaignId }).then((result) => {
        if (cancelled || dirtyRef.current || !result.ok || !result.data) return;
        const next = result.data;
        if (
          next.currentRevisionId === script?.currentRevisionId &&
          next.translationStatus === script.translationStatus &&
          next.bodyEn === script.bodyEn &&
          next.bodyAr === script.bodyAr
        ) {
          return;
        }
        if (next.translationStatus === "generated") {
          toast.success(
            `${scriptLanguageLabel(next.translationTargetLanguage ?? next.sourceLanguage)} translation is ready.`
          );
        }
        if (next.translationStatus === "failed") {
          toast.error(next.translationError ?? "Translation failed.");
        }
        applyScript(next);
      });
    };
    const interval = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyScript, campaignId, dirty, loading, script?.translationStatus]);

  const save = (expectedCurrentRevisionId: string | null, nextDraft = draft) => {
    startTransition(async () => {
      const result = await saveCampaignScriptAction({
        campaignId,
        expectedCurrentRevisionId,
        sourceLanguage: nextDraft.sourceLanguage,
        bodyEn: nextDraft.bodyEn,
        bodyAr: nextDraft.bodyAr,
        originalFileName: nextDraft.originalFileName,
      });
      if (result.ok) {
        applyScript(result.data);
        toast.success("Campaign script saved. The client can see this version now.");
        return;
      }
      if (result.conflict) {
        setConflict(result.data ?? null);
        toast.error(result.message);
        return;
      }
      toast.error(result.message);
    });
  };

  const translateTo = (targetLanguage: ScriptLanguage, confirmed = false) => {
    if (!script) return;
    const targetOrigin = targetLanguage === "en" ? origins.enOrigin : origins.arOrigin;
    const targetBody = targetLanguage === "en" ? draft.bodyEn : draft.bodyAr;
    if (
      !confirmed &&
      targetOrigin === "human_edited" &&
      targetBody.trim() &&
      !window.confirm(scriptRegenerateConfirmMessage(targetLanguage))
    ) {
      return;
    }
    startTransition(async () => {
      const result = await translateCampaignScriptAction({
        campaignId,
        expectedCurrentRevisionId: expectedRevisionId,
        targetLanguage,
        confirmed: confirmed || targetOrigin === "human_edited",
      });
      if (result.ok) {
        applyScript(result.data);
        toast.message(`${scriptLanguageLabel(targetLanguage)} translation pending.`);
        return;
      }
      if (result.conflict) {
        setConflict(result.data ?? null);
        toast.error(result.message);
        return;
      }
      toast.error(result.message);
    });
  };

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    if (
      replaceBothLanguages &&
      scriptHasContentToReplace(draft.bodyEn, draft.bodyAr) &&
      !window.confirm(SCRIPT_REPLACE_BOTH_LANGUAGES_CONFIRM)
    ) {
      return;
    }
    const existingBodyEn = draft.bodyEn;
    const existingBodyAr = draft.bodyAr;
    startTransition(async () => {
      const extracted = await extractCampaignScriptFileAction({ campaignId, file });
      if (!extracted.ok) {
        toast.error(extracted.message);
        return;
      }
      uploadPreserveRef.current = {
        extractedText: extracted.data.text,
        existingBodyEn,
        existingBodyAr,
        replaceBothLanguages,
      };
      const bodies = mergeExtractedScriptText({
        extractedText: extracted.data.text,
        sourceLanguage: extracted.data.sourceLanguage,
        existingBodyEn,
        existingBodyAr,
        replaceBothLanguages,
      });
      const nextDraft: Draft = {
        sourceLanguage: extracted.data.sourceLanguage,
        bodyEn: bodies.bodyEn,
        bodyAr: bodies.bodyAr,
        originalFileName: extracted.data.fileName,
      };
      setDraft(nextDraft);
      setMixedLanguage(extracted.data.mixed);
      if (extracted.data.mixed) {
        toast.message("Confirm the original language, then save. This file looks mixed.");
        return;
      }
      save(expectedRevisionId, nextDraft);
    });
  };

  const onSourceLanguageChange = (value: string) => {
    const sourceLanguage = value as ScriptLanguage;
    const preserve = uploadPreserveRef.current;
    setDraft((current) => {
      if (!preserve) return { ...current, sourceLanguage };
      const bodies = mergeExtractedScriptText({
        extractedText: preserve.extractedText,
        sourceLanguage,
        existingBodyEn: preserve.existingBodyEn,
        existingBodyAr: preserve.existingBodyAr,
        replaceBothLanguages: preserve.replaceBothLanguages,
      });
      return {
        ...current,
        sourceLanguage,
        bodyEn: bodies.bodyEn,
        bodyAr: bodies.bodyAr,
      };
    });
  };

  const statusTone = !script ? "mut" : dirty ? "amber" : "green";
  const statusLabel = !script ? "No script yet" : dirty ? "Unsaved changes" : "Current";

  return (
    <section
      id="campaign-script-register"
      className="mb-3 rounded-[12px] border border-[var(--camp-line,rgba(15,23,42,0.08))] bg-[var(--camp-card,#fff)] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[13px] font-bold text-[var(--camp-text)]">Campaign script</h2>
            <AuroraStatusPill tone={statusTone}>{statusLabel}</AuroraStatusPill>
          </div>
          <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-[var(--camp-text-3)]">
            Shared with the client. Upload or edit English and Arabic here — this is the single
            current campaign script. Use Translate when you want the other language generated.
          </p>
          {script ? (
            <p className="mt-1 text-[11px] text-[var(--camp-text-3)]">
              {formatScriptCurrentLabel(script)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(event) => {
              onUpload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
            disabled={pending || loading}
            onClick={() => fileRef.current?.click()}
          >
            <FileUpIcon className="size-3" aria-hidden />
            Upload script
          </Button>
          <Button
            type="button"
            size="sm"
            className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
            disabled={pending || loading || !dirty}
            onClick={() => save(conflict?.currentRevisionId ?? expectedRevisionId)}
          >
            Save
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
                disabled={!canTranslate}
              >
                {translating ? "Translation pending" : "Translate"}
                <ChevronDownIcon className="size-3" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem
                disabled={!translateTargets.includes("ar")}
                onSelect={() => translateTo("ar")}
              >
                Translate to Arabic
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!translateTargets.includes("en")}
                onSelect={() => translateTo("en")}
              >
                Translate to English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {retryTarget ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
              disabled={pending || loading || dirty || translating}
              onClick={() => translateTo(retryTarget, true)}
            >
              Retry translation
            </Button>
          ) : null}
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--camp-text-3)]">
            <input
              type="checkbox"
              className="size-3.5"
              checked={replaceBothLanguages}
              disabled={pending || loading}
              onChange={(event) => setReplaceBothLanguages(event.target.checked)}
            />
            Replace both languages
          </label>
        </div>
      </div>

      {conflict ? (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100">
          {scriptConflictActorLabel(conflict.actorKind, conflict.actorLabel)} saved a newer
          version ({formatScriptCurrentLabel(conflict)}). Load it, or save your draft as the new
          current script.
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => applyScript(conflict)}
            >
              Load latest
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-[11px]"
              disabled={pending}
              onClick={() => save(conflict.currentRevisionId)}
            >
              Save my draft
            </Button>
          </div>
        </div>
      ) : null}

      {translationBanner ? (
        <p className="mt-3 text-[11px] text-[var(--camp-text-3)]" aria-live="polite">
          {translationBanner}
        </p>
      ) : null}

      {mixedLanguage ? (
        <p className="mt-3 text-[11px] text-[var(--camp-amber-text,var(--camp-text-3))]">
          This file looks mixed. Confirm the original language before saving.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <LanguagesIcon className="size-3.5 text-[var(--camp-text-3)]" aria-hidden />
        <ScriptOriginalLanguageLabel />
        <Select
          value={draft.sourceLanguage}
          onValueChange={onSourceLanguageChange}
        >
          <SelectTrigger className="h-8 w-[140px] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ar">Arabic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ScriptLanguageField
          language="en"
          sourceLanguage={draft.sourceLanguage}
          origin={origins.enOrigin}
          value={draft.bodyEn}
          translationStatus={script?.translationStatus}
          translationTargetLanguage={script?.translationTargetLanguage}
          stale={staleHumanTranslation}
          disabled={pending || loading}
          onChange={(bodyEn) => setDraft((current) => ({ ...current, bodyEn }))}
        />
        <ScriptLanguageField
          language="ar"
          sourceLanguage={draft.sourceLanguage}
          origin={origins.arOrigin}
          value={draft.bodyAr}
          translationStatus={script?.translationStatus}
          translationTargetLanguage={script?.translationTargetLanguage}
          stale={staleHumanTranslation}
          disabled={pending || loading}
          onChange={(bodyAr) => setDraft((current) => ({ ...current, bodyAr }))}
        />
      </div>
    </section>
  );
}

