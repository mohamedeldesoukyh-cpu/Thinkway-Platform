"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { MEDIA_PLAN_BRAND } from "./media-plan-brand";
import type {
  InfluencerConcept,
  InfluencerConceptLocaleContent,
  InfluencerConceptsMeta,
} from "../influencer-concepts";
import {
  applyInfluencerConceptsPatch,
  generateInfluencerConcepts,
  localizeCreatorCategory,
  resolveArabicDialect,
  resolveConceptLocaleFields,
  shouldShowProductionNotes,
} from "../influencer-concepts";
import {
  downloadAllConceptsHtml,
  downloadAllConceptsJson,
  downloadConceptJson,
} from "../influencer-concepts-export";
import { resolveMarketIntelligenceConfig } from "@/features/market-intelligence/market-intelligence-config";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { resolveBriefTextForScheduling } from "../brief-media-plan-schedule";
import { sortedPlatforms } from "../media-plan-strategy-narrative";
import { DOCUMENT_PREVIEW_DIALOG_Z } from "./document-preview-window";

type LocaleTab = "en" | "ar";

function ConceptLocalePanel({
  content,
  locale,
}: {
  content: InfluencerConceptLocaleContent;
  locale: LocaleTab;
}) {
  const resolved = resolveConceptLocaleFields(content);

  const rows: Array<[string, string | string[] | undefined]> =
    locale === "ar"
      ? [
          ["اسم المفهوم", resolved.conceptTitle],
          ["الهدف الإبداعي", resolved.creativeObjective],
          ["رحلة المبدع", resolved.creatorJourney],
          ["الخطاف الافتتاحي", resolved.openingHook],
          ["أنواع المبدعين", resolved.targetCreatorTypes.join(" · ")],
          ["المنصات", resolved.recommendedPlatforms.join(" · ")],
          ["المخرجات", resolved.suggestedDeliverables.join(" · ")],
          ["رد فعل الجمهور", resolved.expectedAudienceReaction],
          ["تسلسل القصة", resolved.storyFlow],
          ["الحوار", resolved.suggestedDialogue],
          ["نقاط الحديث", resolved.keyTalkingPoints.join(" · ")],
          ["الأسلوب البصري", resolved.visualStyle],
          ["توجيه الكاميرا", resolved.cameraDirection],
          ["الموسيقى", resolved.music],
          ["الانتقالات", resolved.transitions],
          ["قائمة اللقطات", resolved.suggestedShotList.join(" · ")],
          ["دمج العلامة", resolved.brandIntegration],
          ["دعوة للعمل", resolved.cta],
          ["الهاشتags", resolved.hashtags.join(" ")],
          ["ملاحظات الإنتاج", resolved.productionNotes],
          ["ملاحظات الموافقة", resolved.approvalNotes],
          ["المدة", resolved.estimatedDuration],
        ]
      : [
          ["Concept Title", resolved.conceptTitle],
          ["Creative Objective", resolved.creativeObjective],
          ["Creator Journey", resolved.creatorJourney],
          ["Opening Hook", resolved.openingHook],
          ["Target Creator Types", resolved.targetCreatorTypes.join(" · ")],
          ["Platforms", resolved.recommendedPlatforms.join(" · ")],
          ["Deliverables", resolved.suggestedDeliverables.join(" · ")],
          ["Audience Reaction", resolved.expectedAudienceReaction],
          ["Story Flow", resolved.storyFlow],
          ["Dialogue", resolved.suggestedDialogue],
          ["Talking Points", resolved.keyTalkingPoints.join(" · ")],
          ["Visual Style", resolved.visualStyle],
          ["Camera Direction", resolved.cameraDirection],
          ["Music", resolved.music],
          ["Transitions", resolved.transitions],
          ["Shot List", resolved.suggestedShotList.join(" · ")],
          ["Brand Integration", resolved.brandIntegration],
          ["CTA", resolved.cta],
          ["Hashtags", resolved.hashtags.join(" ")],
          ["Production Notes", resolved.productionNotes],
          ["Approval Notes", resolved.approvalNotes],
          ["Duration", resolved.estimatedDuration],
        ];

  const adaptations = Object.entries(resolved.creatorAdaptations);

  return (
    <div className="space-y-2" dir={locale === "ar" ? "rtl" : undefined}>
      {rows
        .filter(([label, value]) => {
          if (label === "Production Notes" || label === "ملاحظات الإنتاج") {
            return shouldShowProductionNotes(String(value));
          }
          return Boolean(value && String(value).trim());
        })
        .map(([label, value]) => (
          <div key={`${locale}-${label}`}>
            <p
              className="text-[9px] font-bold uppercase tracking-wide"
              style={{ color: MEDIA_PLAN_BRAND.muted }}
            >
              {label}
            </p>
            <p className="text-[11px] leading-snug" style={{ color: MEDIA_PLAN_BRAND.ink }}>
              {value}
            </p>
          </div>
        ))}
      {adaptations.length ? (
        <div className="mt-2 rounded-md border border-[#0B0F1A]/8 bg-white p-2">
          <p
            className="text-[9px] font-bold uppercase tracking-wide"
            style={{ color: MEDIA_PLAN_BRAND.muted }}
          >
            {locale === "ar" ? "تكييف حسب نوع المبدع" : "Creator-Type Adaptations"}
          </p>
          <ul className="mt-1 space-y-1">
            {adaptations.map(([category, note]) => (
              <li key={category} className="text-[10px]" style={{ color: MEDIA_PLAN_BRAND.ink }}>
                <span className="font-semibold">
                  {localizeCreatorCategory(category, locale)}:{" "}
                </span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LocaleTabs({
  tab,
  onChange,
}: {
  tab: LocaleTab;
  onChange: (tab: LocaleTab) => void;
}) {
  return (
    <div className="mb-3 flex gap-1 rounded-lg border border-[#0B0F1A]/8 bg-[#F7F9FE] p-1">
      {(["en", "ar"] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors",
            tab === locale ? "bg-[#0057FF] text-white shadow-sm" : "text-[#6B7280] hover:bg-white"
          )}
          onClick={() => onChange(locale)}
        >
          {locale === "en" ? "English" : "العربية"}
        </button>
      ))}
    </div>
  );
}

function ConceptCard({
  concept,
  onApprove,
  onDelete,
  onDuplicate,
  onReplace,
}: {
  concept: InfluencerConcept;
  onApprove: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReplace: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<LocaleTab>("en");
  const en = resolveConceptLocaleFields(concept.english);

  return (
    <div className="rounded-lg border border-[#0B0F1A]/10 bg-white">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="min-w-0">
          <p className="text-[12px] font-bold" style={{ color: MEDIA_PLAN_BRAND.deepNavy }}>
            {en.conceptTitle}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[10px]" style={{ color: MEDIA_PLAN_BRAND.muted }}>
            {en.creativeObjective}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md bg-[#E8EFFE] px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#0057FF]">
            {concept.source}
          </span>
          {concept.approved ? (
            <span className="rounded-md bg-[#E7F8EF] px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#0C9D57]">
              Approved
            </span>
          ) : null}
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-[#0B0F1A]/8 px-3 pb-3 pt-2">
          <LocaleTabs tab={tab} onChange={setTab} />
          <ConceptLocalePanel
            content={tab === "en" ? concept.english : concept.arabic}
            locale={tab}
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={onApprove}>
              <Check className="mr-1 size-3" /> Approve
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={onReplace}>
              <Pencil className="mr-1 size-3" /> Replace
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={onDuplicate}>
              <Copy className="mr-1 size-3" /> Duplicate
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={onDelete}>
              <Trash2 className="mr-1 size-3" /> Delete
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Centered Notion/Figma-style modal for full influencer concept editing (~90vw × ~90vh). */
export function InfluencerConceptsModal({
  concepts,
  campaignObject,
  platformAllocation,
  onPersist,
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  concepts: InfluencerConcept[];
  campaignObject?: CampaignObject;
  platformAllocation?: Record<string, number>;
  onPersist?: (next: CampaignObject) => void | Promise<void>;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [localConcepts, setLocalConcepts] = useState(concepts);
  const [globalTab, setGlobalTab] = useState<LocaleTab>("en");
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen;

  useEffect(() => {
    setLocalConcepts(concepts);
  }, [concepts]);

  const count = localConcepts.length;

  const persistConcepts = useCallback(
    async (nextConcepts: InfluencerConcept[], patch?: Partial<InfluencerConceptsMeta>) => {
      setLocalConcepts(nextConcepts);
      if (!campaignObject || !onPersist) return;
      const updated = applyInfluencerConceptsPatch(campaignObject, {
        concepts: nextConcepts,
        ...patch,
      });
      await onPersist(updated);
    },
    [campaignObject, onPersist]
  );

  const handleUpload = useCallback(async () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf,.pptx,.doc,.docx,.png,.jpg,.jpeg,.webp";
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const uploadId = `upload-${Date.now()}`;
      const placeholder: InfluencerConcept = {
        id: `manual-${uploadId}`,
        source: "upload",
        uploadedFileRef: file.name,
        english: {
          conceptTitle: `Uploaded: ${file.name}`,
          creativeObjective: "Review uploaded concept document and refine fields as needed.",
          targetCreatorTypes: ["Lifestyle"],
          recommendedPlatforms: ["Instagram"],
          suggestedDeliverables: ["Reel"],
          expectedAudienceReaction: "Pending review",
          storyFlow: "See uploaded document",
          keyTalkingPoints: [],
          cta: "TBD",
          hashtags: [],
          suggestedShotList: [],
          productionNotes: `File reference: ${file.name}`,
          estimatedDuration: "TBD",
          creatorAdaptations: {},
        },
        arabic: {
          conceptTitle: `مرفق: ${file.name}`,
          creativeObjective: "راجع المستند المرفوع وعدّل الحقول حسب الحاجة.",
          targetCreatorTypes: ["Lifestyle"],
          recommendedPlatforms: ["Instagram"],
          suggestedDeliverables: ["Reel"],
          expectedAudienceReaction: "بانتظار المراجعة",
          storyFlow: "راجع المستند المرفق",
          keyTalkingPoints: [],
          cta: "قريباً",
          hashtags: [],
          suggestedShotList: [],
          productionNotes: `مرجع الملف: ${file.name}`,
          estimatedDuration: "TBD",
          creatorAdaptations: {},
        },
        createdAt: new Date().toISOString(),
      };
      const uploads = [
        ...(campaignObject?.meta.influencerConcepts?.uploads ?? []),
        {
          id: uploadId,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          mimeType: file.type,
          storagePath: `campaigns/${campaignObject?.id ?? "draft"}/concepts/${file.name}`,
        },
      ];
      await persistConcepts([...localConcepts, placeholder], { uploads });
    };
    fileInput.click();
  }, [campaignObject, localConcepts, persistConcepts]);

  const handleGenerateAgain = useCallback(async () => {
    if (!campaignObject) return;
    const facts = getCampaignFacts(campaignObject);
    const briefText = resolveBriefTextForScheduling(campaignObject);
    const marketConfig = resolveMarketIntelligenceConfig(campaignObject, briefText);
    const platforms = sortedPlatforms(platformAllocation ?? {}).map((entry) => entry.platform);
    const generated = generateInfluencerConcepts({
      briefText,
      objective: facts?.objective,
      brand: facts?.brandName,
      product: facts?.brandName,
      industry: facts?.industry,
      audience: facts?.audience,
      platforms: platforms.length ? platforms : facts?.platforms ?? [],
      creatorCategories: ["lifestyle", "beauty"],
      marketCountry: marketConfig.countries[0],
      dialect: resolveArabicDialect(marketConfig.countries[0]),
      slate: [],
    });
    await persistConcepts(generated);
  }, [campaignObject, persistConcepts, platformAllocation]);

  const cardActions = useMemo(
    () => ({
      approve: (id: string) => {
        const next = localConcepts.map((concept) =>
          concept.id === id ? { ...concept, approved: true, source: "manual" as const } : concept
        );
        void persistConcepts(next, {
          approvedConceptIds: next.filter((c) => c.approved).map((c) => c.id),
        });
      },
      delete: (id: string) => {
        void persistConcepts(localConcepts.filter((concept) => concept.id !== id));
      },
      duplicate: (id: string) => {
        const source = localConcepts.find((concept) => concept.id === id);
        if (!source) return;
        const copy: InfluencerConcept = {
          ...source,
          id: `${source.id}-copy-${Date.now()}`,
          source: "manual",
          approved: false,
          english: { ...source.english, conceptTitle: `${source.english.conceptTitle} (Copy)` },
          arabic: { ...source.arabic, conceptTitle: `${source.arabic.conceptTitle} (نسخة)` },
        };
        void persistConcepts([...localConcepts, copy]);
      },
      replace: (id: string) => {
        const source = localConcepts.find((concept) => concept.id === id);
        if (!source) return;
        const replacement: InfluencerConcept = {
          ...source,
          source: "manual",
          english: {
            ...source.english,
            creativeObjective: `${source.english.creativeObjective} (edited)`,
          },
        };
        void persistConcepts(localConcepts.map((concept) => (concept.id === id ? replacement : concept)));
      },
    }),
    [localConcepts, persistConcepts]
  );

  if (!count) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "mt-2 flex w-full items-center justify-between rounded-lg border border-dashed border-[#0057FF]/30 bg-white px-3 py-2 text-left transition hover:border-[#0057FF]/50",
              className
            )}
            data-no-drag
          >
            <span className="text-[11px] font-bold" style={{ color: MEDIA_PLAN_BRAND.deepNavy }}>
              Influencer Concepts ({count})
            </span>
            <span
              className="text-[9px] font-bold uppercase tracking-wide"
              style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
            >
              Expand
            </span>
          </button>
        </DialogTrigger>
      ) : null}
      <DialogContent
        className="flex h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[90vw]"
        overlayClassName="bg-black/50 backdrop-blur-sm"
        style={{ zIndex: DOCUMENT_PREVIEW_DIALOG_Z }}
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b border-[#0B0F1A]/8 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="text-base">Influencer Concepts</DialogTitle>
              <DialogDescription className="text-[11px]">
                Campaign-level concepts — switch language tabs; no mixed EN/AR in one view.
              </DialogDescription>
            </div>
            <LocaleTabs tab={globalTab} onChange={setGlobalTab} />
          </div>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap gap-2 border-b border-[#0B0F1A]/8 px-6 py-3">
          <Button type="button" size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => void handleUpload()}>
            <Upload className="mr-1.5 size-3.5" /> Upload New
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[11px]"
            onClick={() => void handleGenerateAgain()}
            disabled={!campaignObject}
          >
            <RefreshCw className="mr-1.5 size-3.5" /> Generate Again
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[11px]"
            onClick={() => downloadAllConceptsJson(localConcepts)}
          >
            <Download className="mr-1.5 size-3.5" /> Export All (JSON)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[11px]"
            onClick={() => downloadAllConceptsHtml(localConcepts, globalTab)}
          >
            <Download className="mr-1.5 size-3.5" /> Export All (HTML)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[11px]"
            onClick={() => {
              const blank: InfluencerConcept = {
                id: `manual-${Date.now()}`,
                source: "manual",
                english: {
                  conceptTitle: "New Concept",
                  creativeObjective: "Describe the creative objective",
                  targetCreatorTypes: [],
                  recommendedPlatforms: [],
                  suggestedDeliverables: [],
                  expectedAudienceReaction: "",
                  storyFlow: "",
                  keyTalkingPoints: [],
                  cta: "",
                  hashtags: [],
                  suggestedShotList: [],
                  productionNotes: "",
                  estimatedDuration: "",
                  creatorAdaptations: {},
                },
                arabic: {
                  conceptTitle: "مفهوم جديد",
                  creativeObjective: "صف الهدف الإبداعي",
                  targetCreatorTypes: [],
                  recommendedPlatforms: [],
                  suggestedDeliverables: [],
                  expectedAudienceReaction: "",
                  storyFlow: "",
                  keyTalkingPoints: [],
                  cta: "",
                  hashtags: [],
                  suggestedShotList: [],
                  productionNotes: "",
                  estimatedDuration: "",
                  creatorAdaptations: {},
                },
              };
              void persistConcepts([...localConcepts, blank]);
            }}
          >
            <Plus className="mr-1.5 size-3.5" /> Add Concept
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            {localConcepts.map((concept) => (
              <div key={concept.id} className="rounded-lg border border-[#0B0F1A]/10 bg-[#F7F9FE] p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-[12px] font-bold" style={{ color: MEDIA_PLAN_BRAND.deepNavy }}>
                    {resolveConceptLocaleFields(globalTab === "en" ? concept.english : concept.arabic).conceptTitle}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title={globalTab === "ar" ? "تحميل JSON" : "Download JSON"}
                      onClick={() => downloadConceptJson(concept)}
                    >
                      <Download className="size-3.5" />
                    </Button>
                    <span className="rounded-md bg-[#E8EFFE] px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#0057FF]">
                      {concept.source}
                    </span>
                  </div>
                </div>
                <ConceptLocalePanel
                  content={globalTab === "en" ? concept.english : concept.arabic}
                  locale={globalTab}
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => cardActions.approve(concept.id)}
                  >
                    <Check className="mr-1 size-3" /> Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => cardActions.replace(concept.id)}
                  >
                    <Pencil className="mr-1 size-3" /> Replace
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => cardActions.duplicate(concept.id)}
                  >
                    <Copy className="mr-1 size-3" /> Duplicate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => cardActions.delete(concept.id)}
                  >
                    <Trash2 className="mr-1 size-3" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use InfluencerConceptsModal — kept for import compatibility. */
export const InfluencerConceptsSheet = InfluencerConceptsModal;
