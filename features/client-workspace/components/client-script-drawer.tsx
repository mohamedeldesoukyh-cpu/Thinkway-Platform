"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { documentationSlotTitle } from "@/lib/services/deliverables/documentation-list-groups";
import type { DocumentationUnitSummary } from "@/lib/services/deliverables/documentation-types";
import {
  scriptLanguageLabel,
  scriptPreviewBlocks,
  scriptWordCount,
  type ScriptLanguage,
} from "@/lib/campaign-script";

const CLOSE_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const DOC_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 13h8v2H8v-2zm0 4h8v2H8v-2z" />
  </svg>
);

export function ClientScriptDrawer({
  open,
  onClose,
  loading,
  pending,
  dirty,
  mode,
  onModeChange,
  headerAvatar,
  unit,
  creatorName,
  statusClass,
  statusLabel,
  version,
  uploadedBy,
  uploadedWhen,
  hasAny,
  previewLanguage,
  onPreviewLanguageChange,
  sourceLanguage,
  onSourceLanguageChange,
  bodyEn,
  bodyAr,
  onSourceBodyChange,
  replaceBothLanguages,
  onReplaceBothLanguagesChange,
  onUploadClick,
  onSave,
  onDownload,
  onRetry,
  translationFailed,
  translationTitle,
  translationMessage,
  translationDetail,
  mixedLanguage,
  conflict,
  fileInput,
  translating,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  pending: boolean;
  dirty: boolean;
  mode: "edit" | "preview";
  onModeChange: (mode: "edit" | "preview") => void;
  headerAvatar: ReactNode;
  unit: DocumentationUnitSummary | null;
  creatorName: string;
  statusClass: string;
  statusLabel: string;
  version: string | null;
  uploadedBy: string | null;
  uploadedWhen: string | null;
  hasAny: boolean;
  previewLanguage: ScriptLanguage;
  onPreviewLanguageChange: (language: ScriptLanguage) => void;
  sourceLanguage: ScriptLanguage;
  onSourceLanguageChange: (language: ScriptLanguage) => void;
  bodyEn: string;
  bodyAr: string;
  onSourceBodyChange: (value: string) => void;
  replaceBothLanguages: boolean;
  onReplaceBothLanguagesChange: (value: boolean) => void;
  onUploadClick: () => void;
  onSave: () => void;
  onDownload: () => void;
  onRetry?: () => void;
  translationFailed: boolean;
  translationTitle: string | null;
  translationMessage: string | null;
  translationDetail: string | null;
  mixedLanguage: boolean;
  conflict: ReactNode;
  fileInput: ReactNode;
  translating: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const isEdit = mode === "edit";
  const targetLanguage: ScriptLanguage = sourceLanguage === "ar" ? "en" : "ar";
  const sourceBody = sourceLanguage === "en" ? bodyEn : bodyAr;
  const targetBody = targetLanguage === "en" ? bodyEn : bodyAr;
  const previewBody = previewLanguage === "en" ? bodyEn : bodyAr;
  const previewReady = Boolean(previewBody.trim());
  const targetReady = Boolean(targetBody.trim());
  const formatLabel = unit ? documentationSlotTitle(unit) : "Deliverable";
  const busy = pending || loading;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setShowDetail(false);
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="tw-review">
      <div className="cx-scrim" data-open="true" onClick={onClose} />
      <aside
        className="cx-dw"
        data-open="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cx-dw-title"
      >
        {fileInput}
        <div className="cx-dw__hd">
          <div className="cx-dw__top">
            {headerAvatar}
            <span className="cx-dw__ttl">
              <span className="ck">{formatLabel} · Script</span>
              <h2 id="cx-dw-title">{creatorName}</h2>
            </span>
            <button type="button" className="cx-dw__x" onClick={onClose} aria-label="Close">
              {CLOSE_ICON}
            </button>
          </div>
          <div className="cx-dw__meta">
            <span className={`cx-pill ${statusClass}`}>{statusLabel}</span>
            {version ? (
              <>
                <span className="sep">·</span>
                <b>{version}</b>
              </>
            ) : null}
            {uploadedBy ? (
              <>
                <span className="sep">·</span>
                Uploaded by <b>{uploadedBy}</b>
              </>
            ) : null}
            {uploadedWhen ? (
              <>
                <span className="sep">·</span>
                {uploadedWhen}
              </>
            ) : null}
          </div>
          <div className="cx-dw__bar">
            <span className="cx-seg">
              <button
                type="button"
                aria-pressed={!isEdit}
                disabled={!hasAny}
                onClick={() => onModeChange("preview")}
              >
                Preview
              </button>
              <button type="button" aria-pressed={isEdit} onClick={() => onModeChange("edit")}>
                Edit
              </button>
            </span>
            <span className="cx-spacer" />
            {!isEdit && hasAny ? (
              <button type="button" className="btn btn-sm" onClick={onDownload} disabled={busy}>
                Download {scriptLanguageLabel(previewLanguage)}
              </button>
            ) : null}
          </div>
        </div>

        <div className="cx-dw__body">
          {conflict}
          {mixedLanguage ? (
            <div className="cx-alert">
              <span className="cx-alert__ic">!</span>
              <span className="cx-alert__b">
                <span className="cx-alert__t">Confirm the original language</span>
                <span className="cx-alert__s">
                  This file looks mixed. Choose Arabic or English, then save.
                </span>
              </span>
            </div>
          ) : null}
          {!isEdit && translationFailed && translationMessage ? (
            <div className="cx-alert">
              <span className="cx-alert__ic">!</span>
              <span className="cx-alert__b">
                <span className="cx-alert__t">
                  {translationTitle ?? "Automatic translation is temporarily unavailable"}
                </span>
                <span className="cx-alert__s">{translationMessage}</span>
                <span className="cx-alert__acts">
                  {onRetry ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={onRetry}
                      disabled={busy || translating}
                    >
                      Retry translation
                    </button>
                  ) : null}
                  {translationDetail ? (
                    <button
                      type="button"
                      className="cx-alert__more"
                      onClick={() => setShowDetail((current) => !current)}
                    >
                      {showDetail ? "Hide" : "Show"} technical details
                    </button>
                  ) : null}
                </span>
                {translationDetail ? (
                  <span className="cx-alert__det" hidden={!showDetail}>
                    {translationDetail}
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}

          {loading ? (
            <div className="cx-empty">
              <div className="cx-empty__t">Loading script</div>
              <div className="cx-empty__s">Thinkway is opening this deliverable.</div>
            </div>
          ) : isEdit ? (
            <div className="cx-ed">
              <div className="cx-ed__tools">
                <span className="cx-ed__lbl">Original language</span>
                <select
                  className="sel"
                  value={sourceLanguage}
                  disabled={busy}
                  onChange={(event) =>
                    onSourceLanguageChange(event.target.value as ScriptLanguage)
                  }
                >
                  <option value="ar">Arabic</option>
                  <option value="en">English</option>
                </select>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={onUploadClick}
                  disabled={busy}
                >
                  Upload document
                </button>
                <span className="cx-spacer" />
                <label className="cx-chk">
                  <input
                    type="checkbox"
                    checked={replaceBothLanguages}
                    disabled={busy}
                    onChange={(event) => onReplaceBothLanguagesChange(event.target.checked)}
                  />
                  Overwrite existing translation
                </label>
              </div>
              <div className="cx-ed__panes">
                <div className="cx-ed__pane">
                  <div className="cx-ed__hd">
                    <span>Original · {scriptLanguageLabel(sourceLanguage)}</span>
                    <span className="cx-doc__c num">{scriptWordCount(sourceBody)} words</span>
                  </div>
                  <textarea
                    className="cx-ed__ta"
                    dir="auto"
                    value={sourceBody}
                    disabled={busy}
                    placeholder={`Paste the ${scriptLanguageLabel(sourceLanguage).toLowerCase()} script…`}
                    onChange={(event) => onSourceBodyChange(event.target.value)}
                  />
                </div>
                <div className="cx-ed__pane">
                  <div className="cx-ed__hd">
                    <span>Translation · {scriptLanguageLabel(targetLanguage)}</span>
                    <span
                      className={`cx-ed__st ${
                        translating
                          ? "cx-ed__st--pend"
                          : targetReady
                            ? "cx-ed__st--ok"
                            : "cx-ed__st--pend"
                      }`}
                    >
                      {translating ? "Pending" : targetReady ? "Ready" : "Generated on save"}
                    </span>
                  </div>
                  <textarea
                    className="cx-ed__ta"
                    dir="auto"
                    readOnly
                    value={targetBody}
                    placeholder="Thinkway translates this automatically once you save."
                  />
                </div>
              </div>
              <div className="cx-ed__ft">
                <span>{dirty ? "Unsaved changes" : "No changes yet"}</span>
                <span className="cx-spacer" />
                <span>Translation runs after saving — you do not need to trigger it.</span>
              </div>
            </div>
          ) : hasAny ? (
            <>
              <div className="cx-lang">
                <span className="cx-lang__t">Language</span>
                <span className="cx-lang__opts">
                  {(["ar", "en"] as const).map((language) => {
                    const available = Boolean((language === "en" ? bodyEn : bodyAr).trim());
                    return (
                      <button
                        key={language}
                        type="button"
                        className="cx-lang__b"
                        aria-pressed={previewLanguage === language}
                        disabled={!available}
                        title={available ? undefined : "Not available yet"}
                        onClick={() => onPreviewLanguageChange(language)}
                      >
                        {scriptLanguageLabel(language)}
                      </button>
                    );
                  })}
                </span>
                <span className="cx-lang__n">
                  {previewLanguage === sourceLanguage ? "Original" : "Machine translation"}
                </span>
              </div>
              {previewReady ? (
                <div className="cx-doc">
                  <div className="cx-doc__hd">
                    <span className="cx-doc__t">Deliverable script</span>
                    <span className="cx-doc__c num">{scriptWordCount(previewBody)} words</span>
                  </div>
                  <div className="cx-doc__b" dir={previewLanguage === "ar" ? "rtl" : "ltr"}>
                    {scriptPreviewBlocks(previewBody).map((block, index) => (
                      <div className="cx-scr__blk" key={`${block.cue ?? "p"}-${index}`}>
                        {block.cue ? <span className="cx-scr__cue">{block.cue}</span> : null}
                        {block.text.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
                          <p className="cx-scr__p" dir="auto" key={paragraphIndex}>
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyScriptState onAdd={() => onModeChange("edit")} onUpload={onUploadClick} />
              )}
            </>
          ) : (
            <EmptyScriptState onAdd={() => onModeChange("edit")} onUpload={onUploadClick} />
          )}
        </div>

        <div className="cx-dw__ft">
          {isEdit ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !dirty}
                onClick={onSave}
              >
                Save script
              </button>
              <button
                type="button"
                className="btn"
                onClick={hasAny ? () => onModeChange("preview") : onClose}
              >
                Cancel
              </button>
              <span className="cx-spacer" />
              <span className="cx-dw__note">
                Saving stores the original and queues the translation.
              </span>
            </>
          ) : (
            <>
              <span className="cx-dw__note">
                {hasAny
                  ? "This script is saved — Thinkway translates the other language automatically."
                  : "Add a script to continue."}
              </span>
              <span className="cx-spacer" />
              <button type="button" className="btn" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}

function EmptyScriptState({
  onAdd,
  onUpload,
}: {
  onAdd: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="cx-empty">
      <span className="cx-empty__ic">{DOC_ICON}</span>
      <div className="cx-empty__t">No script on this deliverable yet</div>
      <div className="cx-empty__s">
        Add the script here and Thinkway will translate it automatically. You can paste it in, or
        upload a document.
      </div>
      <div className="cx-empty__a">
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          Add script
        </button>
        <button type="button" className="btn" onClick={onUpload}>
          Upload document
        </button>
      </div>
    </div>
  );
}
