"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  extractClientCampaignScriptFileAction,
  loadClientCampaignScriptAction,
  saveClientCampaignScriptAction,
  translateClientCampaignScriptAction,
} from "../actions/campaign-script-actions";
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
  scriptOriginBadge,
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

export function CampaignScriptSection({ token }: { token: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    setError(null);
    uploadPreserveRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadClientCampaignScriptAction({ token }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }
      applyScript(result.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [applyScript, token]);

  useEffect(() => {
    if (loading || dirty || script?.translationStatus !== "pending") return;
    let cancelled = false;
    const poll = () => {
      void loadClientCampaignScriptAction({ token }).then((result) => {
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
        applyScript(next);
        if (next.translationStatus === "generated") {
          setNotice(
            `${scriptLanguageLabel(next.translationTargetLanguage ?? next.sourceLanguage)} translation is ready.`
          );
          setError(null);
        }
        if (next.translationStatus === "failed") {
          setError(next.translationError ?? "Translation failed.");
          setNotice(null);
        }
      });
    };
    const interval = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyScript, dirty, loading, script?.translationStatus, token]);

  const save = (expectedCurrentRevisionId: string | null, nextDraft = draft) => {
    startTransition(async () => {
      const result = await saveClientCampaignScriptAction({
        token,
        expectedCurrentRevisionId,
        sourceLanguage: nextDraft.sourceLanguage,
        bodyEn: nextDraft.bodyEn,
        bodyAr: nextDraft.bodyAr,
        originalFileName: nextDraft.originalFileName,
      });
      if (result.ok) {
        applyScript(result.data);
        setNotice("Saved. Thinkway can see this version now.");
        return;
      }
      if (result.conflict) {
        setConflict(result.data ?? null);
        setError(result.message);
        setNotice(null);
        return;
      }
      setError(result.message);
      setNotice(null);
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
      const result = await translateClientCampaignScriptAction({
        token,
        expectedCurrentRevisionId: expectedRevisionId,
        targetLanguage,
        confirmed: confirmed || targetOrigin === "human_edited",
      });
      if (result.ok) {
        applyScript(result.data);
        setNotice(`${scriptLanguageLabel(targetLanguage)} translation pending.`);
        setError(null);
        return;
      }
      if (result.conflict) {
        setConflict(result.data ?? null);
        setError(result.message);
        setNotice(null);
        return;
      }
      setError(result.message);
      setNotice(null);
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
      const extracted = await extractClientCampaignScriptFileAction({ token, file });
      if (!extracted.ok) {
        setError(extracted.message);
        setNotice(null);
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
      setError(null);
      if (extracted.data.mixed) {
        setNotice("Confirm the original language, then save. This file looks mixed.");
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

  return (
    <section className="card" id="campaign-script">
      <p className="ck">Campaign script</p>
      <h2>Shared campaign script</h2>
      <p className="note">
        One script for this campaign. Upload or edit English and Arabic here — Thinkway sees the
        same current version. Use Translate when you want the other language generated.
      </p>
      {script ? <p className="note">{formatScriptCurrentLabel(script)}</p> : null}
      {loading ? <p className="note">Loading script…</p> : null}
      {error ? <p className="note">{error}</p> : null}
      {notice ? <p className="note">{notice}</p> : null}

      {conflict ? (
        <div className="note" style={{ marginBottom: 14 }}>
          {scriptConflictActorLabel(conflict.actorKind, conflict.actorLabel)} saved a newer
          version. Load it, or save your draft as the new current script.
          <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => applyScript(conflict)}>
              Load latest
            </button>
            <button
              type="button"
              className="btn pri"
              disabled={pending}
              onClick={() => save(conflict.currentRevisionId)}
            >
              Save my draft
            </button>
          </div>
        </div>
      ) : null}

      <div className="script-toolbar">
        <label className="script-lang-label" htmlFor="client-script-source">
          Original language
        </label>
        <select
          id="client-script-source"
          className="script-lang-select"
          value={draft.sourceLanguage}
          disabled={pending || loading}
          onChange={(event) => onSourceLanguageChange(event.target.value)}
        >
          <option value="en">English</option>
          <option value="ar">Arabic</option>
        </select>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          hidden
          onChange={(event) => {
            onUpload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={pending || loading}
          onClick={() => fileRef.current?.click()}
        >
          Upload script
        </button>
        <button
          type="button"
          className="btn pri"
          disabled={pending || loading || !dirty}
          onClick={() => save(conflict?.currentRevisionId ?? expectedRevisionId)}
        >
          Save
        </button>
        <details className="script-translate">
          <summary
            className="btn"
            onClick={(event) => {
              if (!canTranslate) event.preventDefault();
            }}
          >
            {translating ? "Translation pending" : "Translate"}
          </summary>
          <div className="script-translate-menu">
            <button
              type="button"
              className="btn"
              disabled={!canTranslate || !translateTargets.includes("ar")}
              onClick={() => translateTo("ar")}
            >
              Translate to Arabic
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canTranslate || !translateTargets.includes("en")}
              onClick={() => translateTo("en")}
            >
              Translate to English
            </button>
          </div>
        </details>
        {retryTarget ? (
          <button
            type="button"
            className="btn"
            disabled={pending || loading || dirty || translating}
            onClick={() => translateTo(retryTarget, true)}
          >
            Retry translation
          </button>
        ) : null}
        <label className="script-lang-label" htmlFor="client-script-replace-both">
          <input
            id="client-script-replace-both"
            type="checkbox"
            checked={replaceBothLanguages}
            disabled={pending || loading}
            onChange={(event) => setReplaceBothLanguages(event.target.checked)}
          />{" "}
          Replace both languages
        </label>
      </div>

      {translationBanner ? <p className="note">{translationBanner}</p> : null}

      {mixedLanguage ? (
        <p className="note">This file looks mixed. Confirm the original language before saving.</p>
      ) : null}

      <div className="script-grid">
        <ClientScriptField
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
        <ClientScriptField
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

function ClientScriptField({
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
    <label className="script-field">
      <span className="script-field-label">
        {scriptOriginBadge({
          language,
          sourceLanguage,
          origin,
          body: value,
          translationStatus: isTarget ? translationStatus : undefined,
          stale: isTarget ? stale : false,
        })}
      </span>
      <textarea
        className="script-body"
        dir={language === "ar" ? "rtl" : "ltr"}
        lang={language}
        value={value}
        disabled={disabled}
        placeholder={
          language === sourceLanguage
            ? `Paste the ${scriptLanguageLabel(language).toLowerCase()} script`
            : translationStatus === "pending"
              ? `${scriptLanguageLabel(language)} translation pending`
              : `${scriptLanguageLabel(language)} translation`
        }
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
