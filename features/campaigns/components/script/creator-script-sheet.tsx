"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDownIcon, LanguagesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { AuroraStatusPill } from "@/features/campaigns/components/aurora/campaign-workspace-frame";
import { ScriptLanguageField, ScriptOriginalLanguageLabel } from "@/features/campaigns/components/script/campaign-script-fields";
import {
  applyCampaignScriptToLinesAction,
  customizeCreatorCampaignScriptAction,
  loadCreatorCampaignScriptAction,
  reapplyMasterCreatorScriptAction,
  saveCreatorCampaignScriptAction,
  translateCreatorCampaignScriptAction,
} from "@/features/campaigns/actions/campaign-script-actions";
import {
  availableScriptTranslateTargets,
  formatScriptCurrentLabel,
  isHumanTranslationStale,
  resolveScriptOrigins,
  scriptConflictActorLabel,
  scriptLanguageLabel,
  scriptRegenerateConfirmMessage,
  scriptRetryTargetLanguage,
  translationStatusBanner,
  type CampaignScriptMasterView,
  type CreatorCampaignScriptBundle,
  type ScriptLanguage,
} from "@/lib/campaign-script";
import { APP_MAIN_HALF_PANEL_WIDTH } from "@/lib/layout/app-sidebar-width";

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

export function CreatorScriptSheet({
  open,
  onOpenChange,
  campaignId,
  influencerId,
  creatorName,
  lineId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  influencerId: string | null;
  creatorName: string;
  lineId: string | null;
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<CreatorCampaignScriptBundle | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [baseline, setBaseline] = useState<Draft>(EMPTY_DRAFT);
  const [conflict, setConflict] = useState<CampaignScriptMasterView | null>(null);
  const [reapplyOpen, setReapplyOpen] = useState(false);

  const script = bundle?.effective ?? null;
  const assignment = bundle?.assignment ?? null;
  const readOnly = bundle?.readOnly ?? true;
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
    Boolean(assignment?.mode === "customized") &&
    Boolean(script) &&
    !dirty &&
    !pending &&
    !loading &&
    !translating &&
    translateTargets.length > 0;

  const applyBundle = useCallback((next: CreatorCampaignScriptBundle) => {
    const nextDraft = next.effective ? draftFromScript(next.effective) : EMPTY_DRAFT;
    setBundle(next);
    setDraft(nextDraft);
    setBaseline(nextDraft);
    setConflict(null);
  }, []);

  useEffect(() => {
    if (!open || !influencerId) return;
    let cancelled = false;
    setLoading(true);
    void loadCreatorCampaignScriptAction({ campaignId, influencerId }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.message);
        setLoading(false);
        return;
      }
      applyBundle(result.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [applyBundle, campaignId, influencerId, open]);

  useEffect(() => {
    if (!open || loading || dirty || script?.translationStatus !== "pending" || !influencerId) {
      return;
    }
    let cancelled = false;
    const poll = () => {
      void loadCreatorCampaignScriptAction({ campaignId, influencerId }).then((result) => {
        if (cancelled || dirtyRef.current || !result.ok) return;
        const next = result.data.effective;
        if (
          next?.currentRevisionId === script?.currentRevisionId &&
          next?.translationStatus === script.translationStatus &&
          next?.bodyEn === script.bodyEn &&
          next?.bodyAr === script.bodyAr
        ) {
          return;
        }
        if (next?.translationStatus === "generated") {
          toast.success(
            `${scriptLanguageLabel(next.translationTargetLanguage ?? next.sourceLanguage)} translation is ready.`
          );
        }
        if (next?.translationStatus === "failed") {
          toast.error(next.translationError ?? "Translation failed.");
        }
        applyBundle(result.data);
      });
    };
    const interval = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyBundle, campaignId, dirty, influencerId, loading, open, script]);

  const save = (expectedCurrentRevisionId: string | null, nextDraft = draft) => {
    if (!assignment) return;
    startTransition(async () => {
      const result = await saveCreatorCampaignScriptAction({
        assignmentId: assignment.id,
        expectedCurrentRevisionId,
        sourceLanguage: nextDraft.sourceLanguage,
        bodyEn: nextDraft.bodyEn,
        bodyAr: nextDraft.bodyAr,
        originalFileName: nextDraft.originalFileName,
      });
      if (result.ok) {
        const reloaded = await loadCreatorCampaignScriptAction({
          campaignId,
          influencerId: assignment.influencerId,
        });
        if (reloaded.ok) applyBundle(reloaded.data);
        onChanged?.();
        toast.success("Creator script saved. The campaign master was not changed.");
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
    if (!assignment || !script) return;
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
      const result = await translateCreatorCampaignScriptAction({
        assignmentId: assignment.id,
        expectedCurrentRevisionId: expectedRevisionId,
        targetLanguage,
        confirmed: confirmed || targetOrigin === "human_edited",
      });
      if (result.ok) {
        const reloaded = await loadCreatorCampaignScriptAction({
          campaignId,
          influencerId: assignment.influencerId,
        });
        if (reloaded.ok) applyBundle(reloaded.data);
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

  const customize = () => {
    if (!assignment) return;
    startTransition(async () => {
      const result = await customizeCreatorCampaignScriptAction({ assignmentId: assignment.id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      applyBundle(result.data);
      onChanged?.();
      toast.success("This creator now has a customized script. The master is unchanged.");
    });
  };

  const assignMaster = () => {
    if (!lineId) {
      toast.error("This creator is not on a campaign assignment yet.");
      return;
    }
    startTransition(async () => {
      const result = await applyCampaignScriptToLinesAction({
        campaignId,
        lineIds: [lineId],
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (!influencerId) return;
      const reloaded = await loadCreatorCampaignScriptAction({ campaignId, influencerId });
      if (reloaded.ok) applyBundle(reloaded.data);
      onChanged?.();
      toast.success("Campaign script assigned. This creator inherits the current master.");
    });
  };

  const reapplyMaster = () => {
    if (!assignment) return;
    startTransition(async () => {
      const result = await reapplyMasterCreatorScriptAction({
        assignmentId: assignment.id,
        confirmed: true,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      applyBundle(result.data);
      setReapplyOpen(false);
      onChanged?.();
      toast.success("This creator now inherits the current Campaign Master Script.");
    });
  };

  const status = bundle?.status;
  const inherited = assignment?.mode === "inherited";
  const customized = assignment?.mode === "customized";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-none"
          style={{ width: `min(100vw, ${APP_MAIN_HALF_PANEL_WIDTH}px)` }}
        >
          <SheetTitle className="sr-only">{creatorName} campaign script</SheetTitle>
          <SheetDescription className="sr-only">
            Creator script assignment for {creatorName}
          </SheetDescription>
          <div className="border-b border-border/60 px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Creator
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{creatorName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AuroraStatusPill tone={customized ? "amber" : inherited ? "green" : "mut"}>
                {status?.state === "customized"
                  ? "Customized"
                  : status?.state === "inherited"
                    ? "Inherited"
                    : "Not assigned"}
              </AuroraStatusPill>
              {status?.versionLabel && status.state !== "not_assigned" ? (
                <span className="text-[11px] text-muted-foreground">{status.versionLabel}</span>
              ) : null}
            </div>
            {inherited ? (
              <p className="mt-2 text-[12px] text-muted-foreground">
                This creator is using the current Campaign Master Script
                {bundle?.master ? ` (${bundle.master.businessVersion})` : ""}.
              </p>
            ) : null}
            {customized ? (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Customized for this creator. Saving here does not change the campaign master.
              </p>
            ) : null}
            {status?.alignmentNote ? (
              <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-950 dark:text-amber-100">
                {status.alignmentNote}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
            {status?.state === "not_assigned" ? (
              <Button
                type="button"
                size="sm"
                className="h-[30px] text-[11px]"
                disabled={pending || loading}
                onClick={assignMaster}
              >
                Assign Campaign Script
              </Button>
            ) : null}
            {inherited ? (
              <Button
                type="button"
                size="sm"
                className="h-[30px] text-[11px]"
                disabled={pending || loading}
                onClick={customize}
              >
                Customize for this creator
              </Button>
            ) : null}
            {customized ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="h-[30px] text-[11px]"
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
                      className="h-[30px] text-[11px]"
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
                    className="h-[30px] text-[11px]"
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
                  className="h-[30px] text-[11px]"
                  disabled={pending || loading || dirty}
                  onClick={() => setReapplyOpen(true)}
                >
                  Re-apply Master
                </Button>
              </>
            ) : null}
          </div>

          <div className="px-5 py-4">
            {conflict ? (
              <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100">
                {scriptConflictActorLabel(conflict.actorKind, conflict.actorLabel)} saved a newer
                version ({formatScriptCurrentLabel(conflict)}). Load it, or save your draft as the
                new current script.
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      const nextDraft = draftFromScript(conflict);
                      setDraft(nextDraft);
                      setBaseline(nextDraft);
                      setConflict(null);
                    }}
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
            {translationBanner && customized ? (
              <p className="mb-3 text-[11px] text-muted-foreground" aria-live="polite">
                {translationBanner}
              </p>
            ) : null}
            {script ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <LanguagesIcon className="size-3.5 text-muted-foreground" aria-hidden />
                  <ScriptOriginalLanguageLabel />
                  <Select
                    value={draft.sourceLanguage}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        sourceLanguage: value as ScriptLanguage,
                      }))
                    }
                    disabled={readOnly || pending || loading}
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
                    translationStatus={script.translationStatus}
                    translationTargetLanguage={script.translationTargetLanguage}
                    stale={staleHumanTranslation}
                    disabled={readOnly || pending || loading}
                    onChange={(bodyEn) => setDraft((current) => ({ ...current, bodyEn }))}
                  />
                  <ScriptLanguageField
                    language="ar"
                    sourceLanguage={draft.sourceLanguage}
                    origin={origins.arOrigin}
                    value={draft.bodyAr}
                    translationStatus={script.translationStatus}
                    translationTargetLanguage={script.translationTargetLanguage}
                    stale={staleHumanTranslation}
                    disabled={readOnly || pending || loading}
                    onChange={(bodyAr) => setDraft((current) => ({ ...current, bodyAr }))}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Loading script…"
                  : "Save the campaign master script before assigning it to creators."}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={reapplyOpen} onOpenChange={setReapplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-apply Master</DialogTitle>
            <DialogDescription>
              This creator currently has a customized script. Re-applying the master will replace
              the customized version with the current Campaign Master Script. The customized
              version stays in history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReapplyOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={reapplyMaster}>
              {pending ? "Re-applying…" : "Re-apply Master"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
