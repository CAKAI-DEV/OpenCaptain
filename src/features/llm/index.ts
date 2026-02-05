/**
 * LLM feature - Chat completions and embeddings via LiteLLM proxy.
 *
 * @module features/llm
 */

// Client
export { createLLMClient } from './llm.client';
// Service
export { chatCompletion, chatCompletionForOrg, generateEmbedding } from './llm.service';
// Types
export type {
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatMessage,
  ChatRole,
  EmbeddingResult,
  TokenUsage,
} from './llm.types';
