/**
 * LLM client factory for creating OpenAI SDK instances.
 *
 * In development, uses OpenAI directly if OPENAI_API_KEY is set.
 * In production, can use LiteLLM proxy for model abstraction.
 */
import OpenAI from 'openai';
import { env } from '../../shared/lib/env';

/**
 * Creates a new OpenAI client.
 *
 * Uses OpenAI directly if OPENAI_API_KEY is set, otherwise falls back to LiteLLM.
 *
 * @returns OpenAI client instance
 *
 * @example
 * ```ts
 * const client = createLLMClient();
 * const completion = await client.chat.completions.create({
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export function createLLMClient(): OpenAI {
  // Use OpenAI directly if API key is set (bypasses LiteLLM auth issues)
  if (env.OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  // Fall back to LiteLLM proxy
  return new OpenAI({
    apiKey: env.LITELLM_API_KEY,
    baseURL: env.LITELLM_URL,
  });
}
