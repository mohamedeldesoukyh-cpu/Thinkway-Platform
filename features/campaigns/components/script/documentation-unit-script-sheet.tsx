"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileUpIcon,
  LanguagesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AuroraStatusPill } from "@/features/campaigns/components/aurora/campaign-workspace-frame";
import {
  DetailFormScrollBody,
  OperationalDetailCommandBar,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import {
  ScriptLanguageField,
  ScriptOriginalLanguageLabel,
} from "@/features/campaigns/components/script/campaign-script-fields";
import {
  extractCampaignScriptFileAction,
  loadCampaignScriptForUnitAction,
  saveCampaignScriptForUnitAction,
  translateCampaignScriptForUnitAction,
} from "@/features/campaigns/actions/campaign-script-actions";
import {
  extractClientCampaignScriptFileAction,
  loadClientCampaignScriptForUnitAction,
  saveClientCampaignScriptForUnitAction,
  translateClientCampaignScriptForUnitAction,
} from "@/features/client-workspace/actions/campaign-script-actions";
import { documentationSlotTitle } from "@/lib/services/deliverables/documentation-list-groups";
import type { DocumentationUnitSummary } from "@/lib/services/deliverables/documentation-types";
import {
  SCRIPT_REPLACE_BOTH_LANGUAGES_CONFIRM,
  availableScriptTranslateTargets,
  campaignScriptDownloadFileName,
  campaignScriptDownloadText,
  documentationUnitScriptSheetTitle,
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
  type DocumentationUnitScriptIntent,
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

function triggerTextDownload(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string;
  token?: string;
  surface?: "internal" | "client";
  unit: DocumentationUnitSummary | null;
  intent: DocumentationUnitScriptIntent;
  onPresenceChange: (unitKey: string, hasScript: boolean) => void;
};

export function DocumentationUnitScriptSheet({
  open,
  onOpenChange,
  campaignId = "",
  token = "",
  surface = "internal",
  unit,
  intent,
  onPresenceChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewLanguage, setPreviewLanguage] = useState<ScriptLanguage>("en");
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
  const autoUploadRef = useRef(false);

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
  const slotTitle = unit ? documentationSlotTitle(unit) : "Script";
  const sheetTitle = unit ? documentationUnitScriptSheetTitle(unit) : "Script";

  const applyScript = useCallback((next: CampaignScriptMasterView | null) => {
    const nextDraft = next ? draftFromScript(next) : EMPTY_DRAFT;
    setScript(next);
    setDraft(nextDraft);
    setBaseline(nextDraft);
    setConflict(null);
    setMixedLanguage(false);
    uploadPreserveRef.current = null;
    if (next) setPreviewLanguage(next.sourceLanguage);
  }, []);

  const clientMode = surface === "client";
  const loadUnit = useCallback(
    (nextUnit: DocumentationUnitSummary) =>
      clientMode
        ? loadClientCampaignScriptForUnitAction({
            token,
            assignmentDeliverableId: nextUnit.assignmentDeliverableId,
            assignmentPostScheduleId: nextUnit.assignmentPostScheduleId,
          })
        : loadCampaignScriptForUnitAction({
            campaignId,
            assignmentDeliverableId: nextUnit.assignmentDeliverableId,
            assignmentPostScheduleId: nextUnit.assignmentPostScheduleId,
          }),
    [campaignId, clientMode, token]
  );

  useEffect(() => {
    if (!open || !unit) return;
    let cancelled = false;
    setLoading(true);
    setMode(intent === "preview" ? "preview" : "edit");
    autoUploadRef.current = intent === "upload";
    void loadUnit(unit).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.message);
        setLoading(false);
        return;
      }
      applyScript(result.data);
      setLoading(false);
      if (autoUploadRef.current) {
        autoUploadRef.current = false;
        window.setTimeout(() => fileRef.current?.click(), 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applyScript, intent, loadUnit, open, unit]);

  useEffect(() => {
    if (!open || !unit || loading || dirty || script?.translationStatus !== "pending") return;
    let cancelled = false;
    const poll = () => {
      void loadUnit(unit).then((result) => {
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
  }, [
    applyScript,
    dirty,
    loadUnit,
    loading,
    open,
    script?.bodyAr,
    script?.bodyEn,
    script?.currentRevisionId,
    script?.translationStatus,
    unit,
  ]);

  const save = (expectedCurrentRevisionId: string | null, nextDraft = draft) => {
    if (!unit) return;
    startTransition(async () => {
      const result = clientMode
        ? await saveClientCampaignScriptForUnitAction({
            token,
            assignmentDeliverableId: unit.assignmentDeliverableId,
            assignmentPostScheduleId: unit.assignmentPostScheduleId,
            expectedCurrentRevisionId,
            sourceLanguage: nextDraft.sourceLanguage,
            bodyEn: nextDraft.bodyEn,
            bodyAr: nextDraft.bodyAr,
            originalFileName: nextDraft.originalFileName,
          })
        : await saveCampaignScriptForUnitAction({
            campaignId,
            assignmentDeliverableId: unit.assignmentDeliverableId,
            assignmentPostScheduleId: unit.assignmentPostScheduleId,
            expectedCurrentRevisionId,
            sourceLanguage: nextDraft.sourceLanguage,
            bodyEn: nextDraft.bodyEn,
            bodyAr: nextDraft.bodyAr,
            originalFileName: nextDraft.originalFileName,
          });
      if (result.ok) {
        applyScript(result.data);
        onPresenceChange(unit.unitKey, true);
        toast.success("Script saved for this deliverable.");
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
    if (!script || !unit) return;
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
      const result = clientMode
        ? await translateClientCampaignScriptForUnitAction({
            token,
            assignmentDeliverableId: unit.assignmentDeliverableId,
            assignmentPostScheduleId: unit.assignmentPostScheduleId,
            expectedCurrentRevisionId: expectedRevisionId,
            targetLanguage,
            confirmed: confirmed || targetOrigin === "human_edited",
          })
        : await translateCampaignScriptForUnitAction({
            campaignId,
            assignmentDeliverableId: unit.assignmentDeliverableId,
            assignmentPostScheduleId: unit.assignmentPostScheduleId,
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
    if (!file || !unit) return;
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
      const extracted = clientMode
        ? await extractClientCampaignScriptFileAction({ token, file })
        : await extractCampaignScriptFileAction({ campaignId, file });
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
      setMode("edit");
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

  const downloadSelected = () => {
    const downloaded = campaignScriptDownloadText({
      bodyEn: draft.bodyEn,
      bodyAr: draft.bodyAr,
      language: previewLanguage,
    });
    if (!downloaded.ok) {
      toast.error(downloaded.message);
      return;
    }
    triggerTextDownload(
      campaignScriptDownloadFileName(slotTitle, previewLanguage),
      downloaded.text
    );
  };

  const statusTone = !script ? "mut" : dirty ? "amber" : "green";
  const statusLabel = !script ? "No script yet" : dirty ? "Unsaved changes" : "Current";
  const previewBody = previewLanguage === "en" ? draft.bodyEn : draft.bodyAr;

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={sheetTitle}
      description="Script for this documentation unit"
      variant="detail"
    >
      <OperationalDetailCommandBar
        contextLabel="Deliverable script"
        contextHandle={unit?.creatorName}
        title={sheetTitle}
        subtitle={
          script ? formatScriptCurrentLabel(script) : "No script on this unit yet"
        }
        actions={
          <>
            <Button
              type="button"
              size="sm"
              variant={mode === "preview" ? "secondary" : "ghost"}
              className="h-8 text-[11px]"
              onClick={() => setMode("preview")}
            >
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "edit" ? "secondary" : "ghost"}
              className="h-8 text-[11px]"
              onClick={() => setMode("edit")}
            >
              Edit
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
          <AuroraStatusPill tone={statusTone}>{statusLabel}</AuroraStatusPill>
        </div>
      </OperationalDetailCommandBar>

      <DetailFormScrollBody className="space-y-3 px-4 py-3">
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
            disabled={pending || loading}
            onClick={() => fileRef.current?.click()}
          >
            <FileUpIcon className="size-3" aria-hidden />
            {script ? "Upload / replace" : "Upload script"}
          </Button>
          {mode === "edit" ? (
            <Button
              type="button"
              size="sm"
              className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
              disabled={pending || loading || !dirty}
              onClick={() => save(conflict?.currentRevisionId ?? expectedRevisionId)}
            >
              Save
            </Button>
          ) : null}
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
            disabled={pending || loading}
            onClick={downloadSelected}
          >
            <DownloadIcon className="size-3" aria-hidden />
            Download {scriptLanguageLabel(previewLanguage)}
          </Button>
          {mode === "edit" ? (
            <Select
              value={previewLanguage}
              onValueChange={(value) => setPreviewLanguage(value as ScriptLanguage)}
            >
              <SelectTrigger className="h-[30px] w-[120px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          {mode === "edit" ? (
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
          ) : null}
        </div>

        {conflict ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100">
            {scriptConflictActorLabel(conflict.actorKind, conflict.actorLabel)} saved a newer
            version ({formatScriptCurrentLabel(conflict)}). Load it, or save your draft as the
            new current script.
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
          <p className="text-[11px] text-[var(--camp-text-3)]" aria-live="polite">
            {translationBanner}
          </p>
        ) : null}

        {mixedLanguage ? (
          <p className="text-[11px] text-[var(--camp-amber-text,var(--camp-text-3))]">
            This file looks mixed. Confirm the original language before saving.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <LanguagesIcon className="size-3.5 text-[var(--camp-text-3)]" aria-hidden />
          {mode === "edit" ? <ScriptOriginalLanguageLabel /> : (
            <span className="text-[11px] text-[var(--camp-text-3)]">Language</span>
          )}
          <Select
            value={mode === "edit" ? draft.sourceLanguage : previewLanguage}
            onValueChange={
              mode === "edit"
                ? onSourceLanguageChange
                : (value) => setPreviewLanguage(value as ScriptLanguage)
            }
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

        {mode === "preview" ? (
          <Textarea
            value={previewBody}
            readOnly
            dir={previewLanguage === "ar" ? "rtl" : "ltr"}
            lang={previewLanguage}
            className="min-h-[280px] text-[12.5px] leading-relaxed"
            placeholder={`No ${scriptLanguageLabel(previewLanguage).toLowerCase()} script yet`}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
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
        )}
      </DetailFormScrollBody>
    </OperationalDetailSheet>
  );
}
