import type {
  AiContext,
  AiRequest,
  CampaignSnapshot,
  ClientSnapshot,
  CreatorRef,
  FilterContext,
  ShortlistSnapshot,
  SnapshotExtension,
  UserContext,
  WorkspaceContext,
} from "../types";

export interface ContextBuilderInput {
  request: AiRequest;
  workspace?: Partial<WorkspaceContext>;
  user?: UserContext;
  selectedCreators?: CreatorRef[];
  campaign?: CampaignSnapshot;
  client?: ClientSnapshot;
  shortlist?: ShortlistSnapshot;
  filters?: FilterContext;
  snapshot?: SnapshotExtension;
  /** Workflow / Studio — routes searchCreators through CIP enterprise discovery. */
  campaignIntelligenceProfileId?: string;
}

export interface ContextBuilderOptions {
  /** Future hook for snapshot engine integration. */
  snapshotProvider?: (context: AiContext) => Promise<SnapshotExtension | undefined>;
}

const DEFAULT_WORKSPACE: WorkspaceContext = {
  type: "general",
};

export class ContextBuilder {
  private readonly snapshotProvider?: ContextBuilderOptions["snapshotProvider"];

  constructor(options: ContextBuilderOptions = {}) {
    this.snapshotProvider = options.snapshotProvider;
  }

  async build(input: ContextBuilderInput): Promise<AiContext> {
    const requestContext = input.request.context ?? {};

    const context: AiContext = {
      workspace: {
        ...DEFAULT_WORKSPACE,
        ...requestContext.workspace,
        ...input.workspace,
      },
      user: input.user ?? requestContext.user,
      selectedCreators:
        input.selectedCreators ?? requestContext.selectedCreators,
      campaign: input.campaign ?? requestContext.campaign,
      client: input.client ?? requestContext.client,
      shortlist: input.shortlist ?? requestContext.shortlist,
      filters: input.filters ?? requestContext.filters,
      snapshot: input.snapshot ?? requestContext.snapshot,
      conversation: requestContext.conversation,
      campaignIntelligenceProfileId:
        input.campaignIntelligenceProfileId ??
        requestContext.campaignIntelligenceProfileId,
    };

    if (this.snapshotProvider) {
      const snapshot = await this.snapshotProvider(context);
      if (snapshot) {
        context.snapshot = snapshot;
      }
    }

    return context;
  }
}

export function createContextBuilder(
  options?: ContextBuilderOptions
): ContextBuilder {
  return new ContextBuilder(options);
}
