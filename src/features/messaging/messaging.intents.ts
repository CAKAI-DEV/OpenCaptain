/**
 * Intent detection using LLM function calling.
 *
 * Uses OpenAI-compatible function calling to classify user messages
 * into intents and extract entities for project management actions.
 */

import { logger } from '../../shared/lib/logger';
import { createLLMClient } from '../llm';
import { type IntentResult, intentResultSchema } from './messaging.types';

/**
 * System prompt for intent classification.
 */
const INTENT_SYSTEM_PROMPT = `You are a project management assistant. Your job is to classify user messages into intents.

Available intents:
- query_tasks: User asking about tasks ("what's due this week?", "show my tasks", "upcoming deadlines")
- query_status: User asking about project/squad status ("how's the project going?", "squad status", "progress report")
- create_task: User wants to create a task ("create task", "add task", "new task")
- update_task: User wants to update a task ("mark X as done", "complete task", "update status")
- switch_project: User wants to change project context ("switch project", "go to project X", "/switch")
- help: User asking for help ("help", "what can you do?", "commands")
- general_chat: General conversation not about tasks ("hello", "thanks", "how are you")
- unknown: Can't determine what user wants

Extract entities when present:
- projectName: Project name if mentioned
- taskTitle: Task title if mentioned
- timeRange: today, this_week, this_month, or overdue
- status: todo, in_progress, or done
- priority: low, medium, high, or urgent
- assignee: Person name if mentioned`;

/**
 * Function definition for LLM function calling.
 */
const INTENT_FUNCTION = {
  name: 'classify_intent',
  description: 'Classify the user message intent and extract entities',
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: [
          'query_tasks',
          'query_status',
          'create_task',
          'update_task',
          'switch_project',
          'help',
          'general_chat',
          'unknown',
        ],
        description: 'The classified intent',
      },
      entities: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name if mentioned' },
          taskTitle: { type: 'string', description: 'Task title if mentioned' },
          timeRange: { type: 'string', enum: ['today', 'this_week', 'this_month', 'overdue'] },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          assignee: { type: 'string', description: 'Person name if mentioned' },
        },
        required: [],
      },
      confidence: {
        type: 'number',
        description: 'Confidence score from 0 to 1',
        minimum: 0,
        maximum: 1,
      },
    },
    required: ['intent', 'entities', 'confidence'],
  },
};

/**
 * Detect intent from user message using LLM function calling.
 *
 * @param message - User's message text
 * @param organizationId - Organization ID for LLM model preference lookup
 * @param conversationHistory - Optional recent conversation context
 * @returns Intent result with classified intent, entities, and confidence
 */
export async function detectIntent(
  message: string,
  _organizationId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<IntentResult> {
  try {
    const client = createLLMClient();

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Use smaller model for intent detection
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        ...conversationHistory.slice(-5), // Include recent context
        { role: 'user', content: message },
      ],
      tools: [
        {
          type: 'function',
          function: INTENT_FUNCTION,
        },
      ],
      tool_choice: { type: 'function', function: { name: 'classify_intent' } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || !('function' in toolCall) || toolCall.function.name !== 'classify_intent') {
      logger.warn({ message }, 'No intent function call in response');
      return { intent: 'unknown', entities: {}, confidence: 0 };
    }

    const parsed = JSON.parse(toolCall.function.arguments as string);
    const result = intentResultSchema.safeParse(parsed);

    if (!result.success) {
      logger.warn({ parsed, errors: result.error.issues }, 'Invalid intent result');
      return { intent: 'unknown', entities: {}, confidence: 0 };
    }

    logger.info(
      { intent: result.data.intent, confidence: result.data.confidence },
      'Intent detected'
    );
    return result.data;
  } catch (err) {
    logger.error({ err, message }, 'Failed to detect intent');
    return { intent: 'unknown', entities: {}, confidence: 0 };
  }
}
