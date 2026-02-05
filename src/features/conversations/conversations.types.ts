import type { ChatMessage } from '../llm/llm.types';

/** Input for creating a new conversation */
export type CreateConversationInput = {
  organizationId: string;
  userId: string;
  projectId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
};

/** Input for adding a message to a conversation */
export type AddMessageInput = {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
};

/** Context assembled for LLM conversation */
export type ConversationContext = {
  /** System message with assembled context */
  systemMessage: string;
  /** Recent conversation messages */
  recentMessages: ChatMessage[];
  /** RAG documents included in context */
  ragDocuments: Array<{
    content: string;
    sourceType: string;
    sourceId: string;
    similarity: number;
  }>;
  /** Memories included in context */
  memories: Array<{
    content: string;
    type: string;
    scope: string;
  }>;
};

/** Response from sendMessage including context and LLM response */
export type SendMessageResponse = {
  /** The assistant's response message */
  message: {
    id: string;
    role: 'assistant';
    content: string;
    createdAt: Date;
  };
  /** Context that was assembled for this response */
  context: {
    ragDocumentsUsed: number;
    memoriesUsed: number;
  };
  /** Token usage from LLM */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

/** Message count threshold to trigger consolidation */
export const CONSOLIDATION_THRESHOLD = 20;
