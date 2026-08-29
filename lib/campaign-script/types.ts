export const SCRIPT_LANGUAGES = ["en", "ar"] as const;
export type ScriptLanguage = (typeof SCRIPT_LANGUAGES)[number];

export const SCRIPT_TEXT_ORIGINS = ["source", "generated", "human_edited"] as const;
export type ScriptTextOrigin = (typeof SCRIPT_TEXT_ORIGINS)[number];

export const SCRIPT_ACTOR_KINDS = ["internal", "client"] as const;
export type ScriptActorKind = (typeof SCRIPT_ACTOR_KINDS)[number];

export const SCRIPT_ORIGINS = ["internal", "client"] as const;
export type ScriptOrigin = (typeof SCRIPT_ORIGINS)[number];

export const SCRIPT_TRANSLATION_STATUSES = ["idle", "pending", "generated", "failed"] as const;
export type ScriptTranslationStatus = (typeof SCRIPT_TRANSLATION_STATUSES)[number];

export const CAMPAIGN_SCRIPT_BODY_MAX_CHARS = 120_000;
export const CAMPAIGN_SCRIPT_FILE_MAX_BYTES = 8 * 1024 * 1024;

export type CampaignScriptMasterView = {
  scriptId: string;
  campaignHeaderId: string;
  currentRevisionId: string;
  revisionNumber: number;
  businessVersion: string;
  sourceLanguage: ScriptLanguage;
  bodyEn: string;
  bodyAr: string;
  enOrigin: ScriptTextOrigin;
  arOrigin: ScriptTextOrigin;
  actorKind: ScriptActorKind;
  actorLabel: string | null;
  createdAt: string;
  origin: ScriptOrigin;
  originalFileName: string | null;
  originalStorageBucket: string | null;
  originalStoragePath: string | null;
  originalMimeType: string | null;
  originalFileSize: number | null;
  assignmentDeliverableId: string | null;
  assignmentPostScheduleId: string | null;
  translationStatus: ScriptTranslationStatus;
  translationTargetLanguage: ScriptLanguage | null;
  translationSourceRevisionId: string | null;
  translationError: string | null;
  translationAttempts: number;
  translationUpdatedAt: string | null;
};

export type SaveCampaignScriptInput = {
  campaignHeaderId: string;
  expectedCurrentRevisionId: string | null;
  scriptId?: string | null;
  unit?: {
    assignmentDeliverableId: string;
    assignmentPostScheduleId?: string | null;
  } | null;
  sourceLanguage: ScriptLanguage;
  bodyEn: string;
  bodyAr: string;
  actorKind: ScriptActorKind;
  actorUserId: string | null;
  actorLabel: string | null;
  origin: ScriptOrigin;
  reviewId?: string | null;
  originalFileName?: string | null;
  originalDocument?: {
    fileName: string;
    storageBucket: string;
    storagePath: string;
    mimeType: string | null;
    fileSize: number;
  } | null;
  originalDocumentUpload?: {
    fileName: string;
    mimeType?: string | null;
    bytes: Buffer;
  } | null;
  changeSummary?: string | null;
  bumpBusinessVersion?: boolean;
  originsOverride?: { enOrigin: ScriptTextOrigin; arOrigin: ScriptTextOrigin };
};

export type SaveCampaignScriptResult =
  | { ok: true; conflict: false; script: CampaignScriptMasterView }
  | {
      ok: false;
      conflict: true;
      script: CampaignScriptMasterView | null;
      message: string;
    }
  | { ok: false; conflict: false; message: string };

export type DetectedScriptLanguage = {
  language: ScriptLanguage;
  mixed: boolean;
  confidence: "high" | "low";
  arabicLetterCount: number;
  latinLetterCount: number;
};

export const SCRIPT_ASSIGNMENT_MODES = ["inherited", "customized"] as const;
export type ScriptAssignmentMode = (typeof SCRIPT_ASSIGNMENT_MODES)[number];

export const SCRIPT_ASSIGNMENT_ALIGNMENTS = [
  "current",
  "customized",
  "master_updated",
] as const;
export type ScriptAssignmentAlignment = (typeof SCRIPT_ASSIGNMENT_ALIGNMENTS)[number];

export type CampaignScriptParticipation = {
  campaignInfluencerId: string;
  campaignLineId: string;
  influencerId: string;
};

export type CampaignScriptAssignmentRecord = {
  id: string;
  campaignHeaderId: string;
  scriptId: string;
  campaignLineId: string | null;
  influencerId: string;
  campaignInfluencerId: string | null;
  mode: ScriptAssignmentMode;
  overrideRevisionId: string | null;
  forkedFromMasterRevisionId: string | null;
  assignedAt: string;
  assignedBy: string | null;
  updatedAt: string;
  translationStatus: ScriptTranslationStatus;
  translationTargetLanguage: ScriptLanguage | null;
  translationSourceRevisionId: string | null;
  translationError: string | null;
  translationAttempts: number;
  translationUpdatedAt: string | null;
};

export type ApplyMasterScriptItemOutcome =
  | "created"
  | "already_inherited"
  | "kept_customized";

export type ApplyMasterScriptResult =
  | {
      ok: true;
      scriptId: string;
      items: Array<{
        influencerId: string;
        campaignLineId: string;
        campaignInfluencerId: string;
        assignmentId: string;
        outcome: ApplyMasterScriptItemOutcome;
      }>;
    }
  | { ok: false; message: string };

export type ApplyMasterScriptPreview = {
  masterVersion: string | null;
  masterRevisionId: string | null;
  creatorCount: number;
  willCreate: number;
  alreadyInherited: number;
  keptCustomized: number;
};

export type CreatorScriptStatusState = "not_assigned" | "inherited" | "customized";

export type CreatorScriptStatusView = {
  influencerId: string;
  assignmentId: string | null;
  state: CreatorScriptStatusState;
  versionLabel: string;
  alignmentNote: string | null;
  actionLabel: "Assign" | "Open";
};

export type EffectiveCampaignScript =
  | { kind: "not_assigned" }
  | {
      kind: "inherited";
      assignment: CampaignScriptAssignmentRecord;
      revisionId: string;
      alignment: "current";
    }
  | {
      kind: "customized";
      assignment: CampaignScriptAssignmentRecord;
      revisionId: string;
      alignment: "customized" | "master_updated";
    };
