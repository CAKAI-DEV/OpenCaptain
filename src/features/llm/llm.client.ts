/**
 * LLM client factory for creating OpenAI SDK instances pointing at LiteLLM.
 *
 * Client is created per-request to allow model-specific configuration.
 * LiteLLM provides an OpenAI-compatible API that proxies to multiple providers.
 */
import OpenAI from 'openai';
import { env } from '../../shared/lib/env';

/**
 * Creates a new OpenAI client configured to use LiteLLM proxy.
 *
 * @returns OpenAI client instance pointing at LiteLLM
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
  return new OpenAI({
    apiKey: env.LITELLM_API_KEY,
    baseURL: env.LITELLM_URL,
  });
}
