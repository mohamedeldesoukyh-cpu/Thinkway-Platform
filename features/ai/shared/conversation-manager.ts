import type {
  AiContext,
  ConversationMessage,
  ConversationState,
} from "../types";

export interface ConversationManagerOptions {
  maxMessages?: number;
}

function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export class ConversationManager {
  private readonly conversations = new Map<string, ConversationState>();
  private readonly maxMessages: number;

  constructor(options: ConversationManagerOptions = {}) {
    this.maxMessages = options.maxMessages ?? 100;
  }

  createConversation(): ConversationState {
    const now = new Date().toISOString();
    const conversation: ConversationState = {
      id: createConversationId(),
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  getConversation(conversationId: string): ConversationState | undefined {
    return this.conversations.get(conversationId);
  }

  getOrCreateConversation(conversationId?: string): ConversationState {
    if (conversationId) {
      const existing = this.conversations.get(conversationId);
      if (existing) {
        return existing;
      }
    }
    return this.createConversation();
  }

  appendMessage(
    conversationId: string,
    message: Omit<ConversationMessage, "id" | "timestamp">
  ): ConversationMessage {
    const conversation = this.getOrCreateConversation(conversationId);
    const entry: ConversationMessage = {
      ...message,
      id: createMessageId(),
      timestamp: new Date().toISOString(),
    };

    conversation.messages.push(entry);
    if (conversation.messages.length > this.maxMessages) {
      conversation.messages = conversation.messages.slice(-this.maxMessages);
    }
    conversation.updatedAt = entry.timestamp;
    this.conversations.set(conversation.id, conversation);
    return entry;
  }

  attachToContext(
    conversation: ConversationState,
    context: AiContext
  ): AiContext {
    return {
      ...context,
      conversation,
    };
  }
}

export function createConversationManager(
  options?: ConversationManagerOptions
): ConversationManager {
  return new ConversationManager(options);
}
