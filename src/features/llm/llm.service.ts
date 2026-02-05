/**
 * LLM service for chat completions and embeddings.
 *
 * Uses LiteLLM proxy for model abstraction, allowing switching between
 * OpenAI, Anthropic, and other providers without code changes.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../shared/db';
import { organizations } from '../../shared/db/schema/organizations';
import { createLLMClient } from './llm.client';
import type {
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatMessage,
  EmbeddingResult,
} from './llm.types';

/** Default model for chat completions */
const DEFAULT_CHAT_MODEL = 'gpt-4o';

/** Default model for embeddings */
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Performs a chat completion request.
 *
 * @param messages - Conversation messages
 * @param options - Optional configuration (model, temperature, maxTokens)
 * @returns Chat completion result with content and usage stats
 *
 * @example
 * ```ts
 * const result = await chatCompletion([
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'What is 2+2?' },
 * ]);
 * console.log(result.content); // "4"
 * ```
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const client = createLLMClient();
  const model = options?.model ?? DEFAULT_CHAT_MODEL;

  const response = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: options?.temperature,
    max_tokens: options?.maxTokens,
    stream: false,
  });

  const choice = response.choices[0];
  if (!choice?.message?.content) {
    throw new Error('No content in chat completion response');
  }

  return {
    content: choice.message.content,
    model: response.model,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * Generates an embedding vector for text.
 *
 * @param text - Text to embed
 * @param model - Model to use (defaults to text-embedding-3-small)
 * @returns Embedding result with vector and model info
 *
 * @example
 * ```ts
 * const result = await generateEmbedding('Hello, world!');
 * console.log(result.embedding.length); // 1536
 * ```
 */
export async function generateEmbedding(text: string, model?: string): Promise<EmbeddingResult> {
  const client = createLLMClient();
  const embeddingModel = model ?? DEFAULT_EMBEDDING_MODEL;

  // Clean text: replace newlines with spaces
  const cleanedText = text.replaceAll('\n', ' ').trim();

  const response = await client.embeddings.create({
    model: embeddingModel,
    input: cleanedText,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error('No embedding in response');
  }

  return {
    embedding,
    model: response.model,
    dimensions: embedding.length,
  };
}

/**
 * Performs a chat completion using an organization's model preference.
 *
 * Uses the organization's configured llmModel as primary, with automatic
 * fallback to llmFallbackModel on non-retryable errors.
 *
 * @param organizationId - Organization ID to look up model preference
 * @param messages - Conversation messages
 * @param options - Optional configuration (overrides org model if provided)
 * @returns Chat completion result with content, model used, and usage stats
 *
 * @example
 * ```ts
 * const result = await chatCompletionForOrg('org-123', [
 *   { role: 'user', content: 'Hello' },
 * ]);
 * console.log(result.model); // "gpt-4o" or "claude-3-5-sonnet" (fallback)
 * ```
 */
export async function chatCompletionForOrg(
  organizationId: string,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  // Fetch organization's model preferences
  const org = await db
    .select({
      llmModel: organizations.llmModel,
      llmFallbackModel: organizations.llmFallbackModel,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!org) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  // Use org's model preference, falling back to default if not set
  const primaryModel = options?.model ?? org.llmModel ?? DEFAULT_CHAT_MODEL;
  const fallbackModel = org.llmFallbackModel ?? 'claude-3-5-sonnet';

  try {
    // Try primary model first
    return await chatCompletion(messages, { ...options, model: primaryModel });
  } catch (error) {
    // Check if this is a non-retryable error that warrants fallback
    // Non-retryable: model not found, invalid request, auth errors
    // Retryable: rate limits, timeouts, server errors - should NOT fallback
    const isNonRetryable =
      error instanceof Error &&
      (error.message.includes('model') ||
        error.message.includes('invalid') ||
        error.message.includes('not found') ||
        error.message.includes('400') ||
        error.message.includes('401') ||
        error.message.includes('403') ||
        error.message.includes('404'));

    if (isNonRetryable && primaryModel !== fallbackModel) {
      // Try fallback model once
      return await chatCompletion(messages, { ...options, model: fallbackModel });
    }

    // Re-throw for retryable errors or if fallback is same as primary
    throw error;
  }
}
