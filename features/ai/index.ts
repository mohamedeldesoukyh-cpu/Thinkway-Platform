// ── LLM ─────────────────────────────────────────────────────────────────────
export {
  OpenAiProvider,
  createOpenAiProvider,
  getDefaultLlmProvider,
  resetDefaultLlmProvider,
} from "./llm";
export type { OpenAiProviderOptions } from "./llm";

// ── Orchestrator ──────────────────────────────────────────────────────────
export {
  AiOrchestrator,
  createAiOrchestrator,
  getDefaultAiOrchestrator,
  resetDefaultAiOrchestrator,
} from "./orchestrator";
export type {
  AiOrchestratorOptions,
  AiOrchestratorOutput,
  AiOrchestratorResult,
  AiOrchestratorFailure,
} from "./orchestrator";

// ── Agents ──────────────────────────────────────────────────────────────────
export { BaseAiAgent, AgentRegistry, createAgentRegistry } from "./agents";
export type { BaseAiAgentOptions } from "./agents";
export { PlannerAgent, plannerAgent } from "./planner";
export { StrategistAgent, strategistAgent } from "./strategist";
export { ScoutAgent, scoutAgent } from "./scout";
export { AnalystAgent, analystAgent } from "./analyst";
export { GeneralAgent, generalAgent } from "./general";

// ── Routing ─────────────────────────────────────────────────────────────────
export {
  AgentRouter,
  createAgentRouter,
  IntentEngine,
  createIntentEngine,
  analyzeRequest,
  computeConfidence,
  DEFAULT_MULTI_AGENT_THRESHOLD,
} from "./routing";
export type {
  AgentRouterExecuteInput,
  AgentRouterExecuteResult,
  IntentAnalysisResult,
  IntentType,
  RoutableAgentId,
  RequestAnalysisResult,
  AgentConfidenceScore,
  ConfidenceResult,
  RoutingDecision,
  AgentRouterOptions,
  AgentExecutionPlan,
} from "./routing";

// ── Tools ───────────────────────────────────────────────────────────────────
export {
  ToolRegistry,
  createToolRegistry,
  getDefaultToolRegistry,
  resetDefaultToolRegistry,
  DEFAULT_TOOLS,
  searchCreatorsTool,
  getCreatorTool,
  getCampaignTool,
  getClientTool,
  getShortlistTool,
  createShortlistTool,
  buildCampaignTool,
  generateBriefTool,
  generateReportTool,
} from "./tools";

// ── Prompts ─────────────────────────────────────────────────────────────────
export {
  PromptLibrary,
  createPromptLibrary,
  getDefaultPromptLibrary,
  resetDefaultPromptLibrary,
  SYSTEM_BASE_PROMPT,
  PLANNER_PROMPT,
  STRATEGIST_PROMPT,
  SCOUT_PROMPT,
  ANALYST_PROMPT,
  GENERAL_PROMPT,
  BRIEF_GENERATION_PROMPT,
  REPORT_GENERATION_PROMPT,
  DEFAULT_PROMPT_TEMPLATES,
} from "./prompts";
export type { PromptTemplate, RenderedPrompt } from "./prompts";

// ── Shared ──────────────────────────────────────────────────────────────────
export {
  ContextBuilder,
  createContextBuilder,
  ConversationManager,
  createConversationManager,
  interpolatePrompt,
} from "./shared";
export type {
  ContextBuilderInput,
  ContextBuilderOptions,
  ConversationManagerOptions,
  PromptVariables,
} from "./shared";

// ── Memory ──────────────────────────────────────────────────────────────────
export { MemoryStore, createMemoryStore } from "./memory";
export type { MemoryStoreOptions, MemoryRecord } from "./memory";

// ── Types ───────────────────────────────────────────────────────────────────
export type {
  AiIntent,
  AiRequest,
  AiResponse,
  AiResponseMetadata,
  AiError,
  AiErrorCode,
  WorkspaceContext,
  WorkspaceType,
  UserContext,
  CreatorRef,
  CampaignSnapshot,
  ClientSnapshot,
  ShortlistSnapshot,
  FilterContext,
  SnapshotExtension,
  AiContext,
  ConversationMessage,
  ConversationState,
  AiTool,
  AiToolDefinition,
  AnyAiToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolRegistrySnapshot,
  AiAgent,
  AgentExecuteInput,
  AgentExecuteResult,
  AgentCapability,
  LlmMessageRole,
  LlmMessage,
  LlmToolDefinition,
  LlmCompletionRequest,
  LlmTokenUsage,
  LlmCompletionResponse,
  LlmStreamChunk,
  LlmProviderIdentity,
  LlmProvider,
} from "./types";

export { LlmProviderError } from "./types";

// ── Tool schemas (for consumers building custom tools) ──────────────────────
export {
  searchCreatorsInputSchema,
  searchCreatorsOutputSchema,
  getCreatorInputSchema,
  getCreatorOutputSchema,
  getCampaignInputSchema,
  getCampaignOutputSchema,
  getClientInputSchema,
  getClientOutputSchema,
  getShortlistInputSchema,
  getShortlistOutputSchema,
  createShortlistInputSchema,
  createShortlistOutputSchema,
  buildCampaignInputSchema,
  buildCampaignOutputSchema,
  generateBriefInputSchema,
  generateBriefOutputSchema,
  generateReportInputSchema,
  generateReportOutputSchema,
} from "./tools/schemas";

export type {
  SearchCreatorsInput,
  SearchCreatorsOutput,
  GetCreatorInput,
  GetCreatorOutput,
  GetCampaignInput,
  GetCampaignOutput,
  GetClientInput,
  GetClientOutput,
  GetShortlistInput,
  GetShortlistOutput,
  CreateShortlistInput,
  CreateShortlistOutput,
  BuildCampaignInput,
  BuildCampaignOutput,
  GenerateBriefInput,
  GenerateBriefOutput,
  GenerateReportInput,
  GenerateReportOutput,
} from "./tools/schemas";
