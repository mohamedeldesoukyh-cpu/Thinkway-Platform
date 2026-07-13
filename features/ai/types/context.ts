export type WorkspaceType =
  | "campaign"
  | "client"
  | "group"
  | "brand"
  | "vendor"
  | "discovery"
  | "shortlist"
  | "quotation"
  | "general";

export interface WorkspaceContext {
  type: WorkspaceType;
  id?: string;
  campaignId?: string;
  clientId?: string;
  brandId?: string;
  groupId?: string;
  label?: string;
}

export interface UserContext {
  id: string;
  role?: string;
  name?: string;
  email?: string;
}

export interface CreatorRef {
  id: string;
  handle?: string;
  displayName?: string;
  platform?: string;
}

export interface CampaignSnapshot {
  id: string;
  code?: string;
  name: string;
  status?: string;
  brandId?: string;
  clientId?: string;
  poAmount?: number;
  currency?: string;
}

export interface ClientSnapshot {
  id: string;
  name: string;
  groupId?: string;
  country?: string;
}

export interface ShortlistSnapshot {
  id: string;
  name: string;
  creatorCount?: number;
  status?: string;
}

export interface FilterContext {
  query?: string;
  platforms?: string[];
  categories?: string[];
  countries?: string[];
  custom?: Record<string, unknown>;
}

/** Extension point for future snapshot engine integration. */
export interface SnapshotExtension {
  source?: string;
  capturedAt?: string;
  payload?: Record<string, unknown>;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationState {
  id: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AiContext {
  workspace: WorkspaceContext;
  user?: UserContext;
  selectedCreators?: CreatorRef[];
  campaign?: CampaignSnapshot;
  client?: ClientSnapshot;
  shortlist?: ShortlistSnapshot;
  filters?: FilterContext;
  snapshot?: SnapshotExtension;
  conversation?: ConversationState;
  /** Release 1 — saved Campaign Intelligence Profile for search + Director SSOT. */
  campaignIntelligenceProfileId?: string;
}
