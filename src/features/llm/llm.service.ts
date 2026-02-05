/**
 * LLM service for chat completions and embeddings.
 *
 * Uses LiteLLM proxy for model abstraction, allowing switching between
 * OpenAI, Anthropic, and other providers without code changes.
 */
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
