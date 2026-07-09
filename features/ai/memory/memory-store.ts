import type { AiContext, ConversationState } from "../types";

export interface MemoryStoreOptions {
  /** Future: persist to Supabase or Redis. */
  persist?: boolean;
}

export interface MemoryRecord {
  conversation: ConversationState;
  contextSnapshot?: AiContext;
  metadata?: Record<string, unknown>;
}

/**
 * Placeholder abstraction for conversation and context memory.
 * In-memory implementation; swap for persistent store in production.
 */
export class MemoryStore {
  private readonly records = new Map<string, MemoryRecord>();
  private readonly persist: boolean;

  constructor(options: MemoryStoreOptions = {}) {
    this.persist = options.persist ?? false;
  }

  save(record: MemoryRecord): void {
    this.records.set(record.conversation.id, record);
  }

  get(conversationId: string): MemoryRecord | undefined {
    return this.records.get(conversationId);
  }

  delete(conversationId: string): boolean {
    return this.records.delete(conversationId);
  }

  list(): MemoryRecord[] {
    return Array.from(this.records.values());
  }

  /** Extension point for future snapshot engine persistence. */
  async persistSnapshot(
    conversationId: string,
    snapshot: AiContext["snapshot"]
  ): Promise<void> {
    const record = this.records.get(conversationId);
    if (!record) {
      return;
    }

    record.contextSnapshot = {
      ...record.contextSnapshot,
      workspace: record.contextSnapshot?.workspace ?? { type: "general" },
      snapshot,
    };
    this.records.set(conversationId, record);

    if (this.persist) {
      // Future: write to database
    }
  }
}

export function createMemoryStore(options?: MemoryStoreOptions): MemoryStore {
  return new MemoryStore(options);
}
