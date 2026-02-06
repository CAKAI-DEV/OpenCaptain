/**
 * Task extraction service using LLM function calling.
 *
 * Extracts task creation intent and details from natural language messages.
 * CRITICAL: Never auto-creates tasks - always returns extracted data for confirmation.
 */

import { logger } from '../../shared/lib/logger';
import { createLLMClient } from '../llm';
import type { ActionableItem, TaskExtractionResult } from './messaging.types';

/**
 * System prompt for task extraction.
 */
const TASK_EXTRACTION_SYSTEM_PROMPT = `You are a project management assistant. Your job is to detect when a user wants to create a task and extract the details.

Indicators of task creation intent:
- Explicit requests: "create a task", "add a task", "new task", "make a task"
- Implicit requests: "we need to", "I have to", "someone should", "let's", "can you add"
- Action items: "do X by Y", "finish X", "complete X"

Extract these fields when present:
- title: Clear, actionable task title
- description: Additional context or details
- assigneeHint: Person's name if mentioned
- dueDate: Due date hint (relative: "tomorrow", "next Friday", "end of week")
- priority: low, medium, high, or urgent (based on urgency words)

Be conservative with confidence scores:
- 0.9+: Explicit task creation request with clear title
- 0.7-0.9: Implicit task request or clear action item
- 0.5-0.7: Possible task, but unclear intent
- <0.5: Probably not a task creation request

Examples:
- "Create a task to review the PR" -> task creation, high confidence
- "We need to fix the login bug by Friday" -> task creation, medium-high confidence
- "What's the status of the project?" -> NOT task creation`;

/**
 * Function definition for LLM task extraction.
 */
const CREATE_TASK_FUNCTION = {
  name: 'extract_task_from_message',
  description: 'Extract task creation intent and details from a user message',
  parameters: {
    type: 'object',
    properties: {
      isTaskCreation: {
        type: 'boolean',
        description: 'Whether the user wants to create a task',
      },
      title: {
        type: 'string',
        description: 'Extracted task title (clear, actionable)',
      },
      description: {
        type: 'string',
        description: 'Additional context or details for the task',
      },
      assigneeHint: {
        type: 'string',
        description: 'Person name if mentioned for assignment',
      },
      dueDate: {
        type: 'string',
        description: 'Due date hint (e.g., "tomorrow", "next week", "Friday")',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
        description: 'Priority level based on urgency indicators',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score from 0 to 1',
        minimum: 0,
        maximum: 1,
      },
    },
    required: ['isTaskCreation', 'confidence'],
  },
};

/**
 * System prompt for actionable items detection.
 */
const ACTIONABLE_ITEMS_SYSTEM_PROMPT = `You are a project management assistant. Your job is to identify actionable items in a conversation that could become tasks.

Look for:
- Action items: "need to X", "should X", "have to X"
- Assignments: "X will do Y", "I'll take care of Y"
- Commitments: "Let's X", "We agreed to X"
- Follow-ups: "We should follow up on X", "Don't forget to X"

Do NOT flag:
- Questions about status
- General discussion
- Already completed items
- Vague statements without clear actions

Return high confidence (0.7+) only for clear, actionable items.`;

/**
 * Function definition for detecting actionable items.
 */
const DETECT_ACTIONABLE_FUNCTION = {
  name: 'detect_actionable_items',
  description: 'Detect actionable items in conversation messages that could become tasks',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The actionable phrase from the conversation',
            },
            suggestedTitle: {
              type: 'string',
              description: 'Suggested task title based on the phrase',
            },
            confidence: {
              type: 'number',
              description: 'Confidence score from 0 to 1',
              minimum: 0,
              maximum: 1,
            },
          },
          required: ['text', 'suggestedTitle', 'confidence'],
        },
        description: 'List of actionable items found',
      },
    },
    required: ['items'],
  },
};

/**
 * Extract task details from a natural language message.
 *
 * Uses LLM function calling to detect task creation intent and extract fields.
 * Requires confidence > 0.7 for task creation intent to be considered valid.
 *
 * @param message - User's message text
 * @returns Task extraction result with confidence score
 */
export async function extractTaskFromMessage(message: string): Promise<TaskExtractionResult> {
  try {
    const client = createLLMClient();

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Use smaller model for speed/cost
      messages: [
        { role: 'system', content: TASK_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      tools: [
        {
          type: 'function',
          function: CREATE_TASK_FUNCTION,
        },
      ],
      tool_choice: { type: 'function', function: { name: 'extract_task_from_message' } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (
      !toolCall ||
      !('function' in toolCall) ||
      toolCall.function.name !== 'extract_task_from_message'
    ) {
      logger.warn({ message }, 'No task extraction function call in response');
      return {
        isTaskCreation: false,
        title: null,
        description: null,
        assigneeHint: null,
        dueDate: null,
        priority: null,
        confidence: 0,
      };
    }

    const parsed = JSON.parse(toolCall.function.arguments as string) as Record<string, unknown>;

    const result: TaskExtractionResult = {
      isTaskCreation: Boolean(parsed.isTaskCreation),
      title: (parsed.title as string) || null,
      description: (parsed.description as string) || null,
      assigneeHint: (parsed.assigneeHint as string) || null,
      dueDate: (parsed.dueDate as string) || null,
      priority: (parsed.priority as TaskExtractionResult['priority']) || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    };

    logger.info(
      { isTaskCreation: result.isTaskCreation, confidence: result.confidence, title: result.title },
      'Task extraction completed'
    );

    return result;
  } catch (err) {
    logger.error({ err, message }, 'Failed to extract task from message');
    return {
      isTaskCreation: false,
      title: null,
      description: null,
      assigneeHint: null,
      dueDate: null,
      priority: null,
      confidence: 0,
    };
  }
}

/**
 * Detect actionable items in a conversation that could become tasks.
 *
 * Analyzes recent conversation messages to identify phrases that could be tasks.
 * Returns items with confidence > 0.6 only.
 *
 * @param messages - Recent conversation messages to analyze
 * @returns Array of actionable items with suggested task titles
 */
export async function detectActionableItems(messages: string[]): Promise<ActionableItem[]> {
  if (messages.length === 0) {
    return [];
  }

  try {
    const client = createLLMClient();

    // Combine messages into a conversation context
    const conversationContext = messages.map((m, i) => `Message ${i + 1}: ${m}`).join('\n');

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: ACTIONABLE_ITEMS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze this conversation and identify actionable items:\n\n${conversationContext}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: DETECT_ACTIONABLE_FUNCTION,
        },
      ],
      tool_choice: { type: 'function', function: { name: 'detect_actionable_items' } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (
      !toolCall ||
      !('function' in toolCall) ||
      toolCall.function.name !== 'detect_actionable_items'
    ) {
      logger.warn('No actionable items function call in response');
      return [];
    }

    const parsed = JSON.parse(toolCall.function.arguments as string) as {
      items: ActionableItem[];
    };

    // Filter by confidence threshold (> 0.6)
    const filteredItems = (parsed.items || []).filter((item) => item.confidence > 0.6);

    logger.info(
      { totalItems: parsed.items?.length, filteredItems: filteredItems.length },
      'Actionable items detected'
    );

    return filteredItems;
  } catch (err) {
    logger.error({ err }, 'Failed to detect actionable items');
    return [];
  }
}
