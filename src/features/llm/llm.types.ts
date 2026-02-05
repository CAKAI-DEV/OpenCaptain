/**
 * LLM types for chat completions and embeddings via LiteLLM proxy.
 */

/** Chat message role */
export type ChatRole = 'system' | 'user' | 'assistant';

/** Chat message for conversation */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Options for chat completion requests */
export interface ChatCompletionOptions {
  /** Model to use (defaults to org preference or 'gpt-4o') */
  model?: string;
  /** Whether to stream the response (not implemented yet) */
  stream?: boolean;
  /** Temperature for response randomness (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
}

/** Token usage statistics */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Result from a chat completion request */
export interface ChatCompletionResult {
  /** Generated response content */
  content: string;
  /** Model that was used */
  model: string;
  /** Token usage statistics */
  usage: TokenUsage;
}

/** Result from an embedding request */
export interface EmbeddingResult {
  /** The embedding vector */
  embedding: number[];
  /** Model that was used */
  model: string;
  /** Number of dimensions in the embedding */
  dimensions: number;
}
