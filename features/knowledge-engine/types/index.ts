import type {
  CampaignSnapshot,
  ClientSnapshot,
  FilterContext,
  UserContext,
  WorkspaceContext,
} from "@/features/ai";

export type EntityType =
  | "client"
  | "brand"
  | "campaign"
  | "campaign_line"
  | "creator"
  | "influencer"
  | "platform_account"
  | "shortlist"
  | "quotation"
  | "invoice"
  | "purchase_order"
  | "vendor"
  | "country"
  | "city"
  | "platform"
  | "category"
  | "hashtag"
  | "product"
  | "brand_group"
  | "campaign_code"
  | "document_number"
  | "creator_handle";

export type MatchMethod =
  | "document_number"
  | "uuid"
  | "exact_name"
  | "alias"
  | "partial"
  | "fuzzy"
  | "workspace"
  | "pattern";

export type MatchSource =
  | "database"
  | "workspace"
  | "message"
  | "cache"
  | "pattern";

export type ResolvedEntity = {
  id: string;
  type: EntityType;
  label: string;
  confidence: number;
  matchedBy: MatchMethod;
  source: MatchSource;
  metadata?: Record<string, unknown>;
};

export type DisambiguationOption = {
  id: string;
  type: EntityType;
  label: string;
  subtitle?: string;
  confidence: number;
  matchedBy: MatchMethod;
};

export type BrandSnapshot = {
  id: string;
  name: string;
  documentNumber?: string;
  clientId?: string;
  groupId?: string;
  categoryId?: string;
};

export type CreatorSnapshot = {
  id: string;
  handle?: string;
  displayName?: string;
  platform?: string;
  sourceType?: "influencer" | "discovered";
};

export type WorkspaceKnowledge = {
  workspace: WorkspaceContext;
  user?: UserContext;
  page?: string;
  campaign?: CampaignSnapshot;
  client?: ClientSnapshot;
  brand?: BrandSnapshot;
  shortlist?: {
    id: string;
    name: string;
    creatorCount?: number;
    status?: string;
  };
  filters?: FilterContext;
  companyId?: string;
};

export type RelationshipNode = {
  id: string;
  type: EntityType | string;
  label: string;
  metadata?: Record<string, unknown>;
};

export type RelationshipEdge = {
  from: string;
  to: string;
  relation: string;
};

export type RelationshipGraph = {
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  rootIds: string[];
};

export type KnowledgeContext = {
  entities: ResolvedEntity[];
  workspace: WorkspaceKnowledge;
  relationships: RelationshipGraph;
  resolvedCampaign?: CampaignSnapshot;
  resolvedClient?: ClientSnapshot;
  resolvedBrand?: BrandSnapshot;
  resolvedCreators?: CreatorSnapshot[];
  confidence: number;
  disambiguation?: DisambiguationOption[];
  buildMs?: number;
  resolutionMs?: number;
};

export type KnowledgeBuildInput = {
  message: string;
  supabase: import("@supabase/supabase-js").SupabaseClient;
  workspaceInput?: Omit<
    import("@/features/ai/shared").ContextBuilderInput,
    "request"
  >;
  userId?: string;
};

export type EntitySearchHit = {
  id: string;
  type: EntityType;
  label: string;
  confidence: number;
  matchedBy: MatchMethod;
  subtitle?: string;
  metadata?: Record<string, unknown>;
};

export type EntitySearchResult = {
  query: string;
  hits: EntitySearchHit[];
  strategy: MatchMethod;
};
