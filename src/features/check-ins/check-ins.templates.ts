import { v4 as uuid } from 'uuid';
import type { CheckInQuestion } from '../../shared/db/schema/check-in-blocks';

/**
 * Preset check-in templates
 */
export const CHECK_IN_TEMPLATES = {
  daily_standup: {
    id: 'daily_standup',
    name: 'Daily Standup',
    description: 'Classic standup questions for daily sync',
    questions: [
      {
        id: uuid(),
        text: 'What did you accomplish yesterday?',
        type: 'text' as const,
        required: true,
      },
      {
        id: uuid(),
        text: 'What are you working on today?',
        type: 'text' as const,
        required: true,
      },
      {
        id: uuid(),
        text: 'Any blockers or concerns?',
        type: 'text' as const,
        required: false,
      },
    ],
    defaultCron: '0 9 * * 1-5', // 9 AM weekdays
  },

  output_count: {
    id: 'output_count',
    name: 'Output Count',
    description: 'Track daily deliverable output',
    questions: [
      {
        id: uuid(),
        text: 'How many items did you complete today?',
        type: 'number' as const,
        required: true,
      },
      {
        id: uuid(),
        text: 'Are you blocked on anything?',
        type: 'boolean' as const,
        required: true,
      },
      {
        id: uuid(),
        text: 'If blocked, describe the issue:',
        type: 'text' as const,
        required: false,
      },
    ],
    defaultCron: '0 17 * * 1-5', // 5 PM weekdays
  },

  weekly_forecast: {
    id: 'weekly_forecast',
    name: 'Weekly Forecast',
    description: 'End-of-week reflection and planning',
    questions: [
      {
        id: uuid(),
        text: 'Key accomplishments this week:',
        type: 'text' as const,
        required: true,
      },
      {
        id: uuid(),
        text: 'Goals for next week:',
        type: 'text' as const,
        required: true,
      },
      {
        id: uuid(),
        text: 'Expected deliverable count:',
        type: 'number' as const,
        required: false,
      },
      {
        id: uuid(),
        text: 'Risks or concerns:',
        type: 'text' as const,
        required: false,
      },
    ],
    defaultCron: '0 16 * * 5', // 4 PM Friday
  },
} as const;

export type TemplateId = keyof typeof CHECK_IN_TEMPLATES;

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): (typeof CHECK_IN_TEMPLATES)[TemplateId] | null {
  if (templateId in CHECK_IN_TEMPLATES) {
    return CHECK_IN_TEMPLATES[templateId as TemplateId];
  }
  return null;
}

/**
 * List all available templates
 */
export function listTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  defaultCron: string;
}> {
  return Object.values(CHECK_IN_TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    defaultCron: t.defaultCron,
  }));
}

/**
 * Generate fresh question IDs for a template
 * (Templates have static IDs, but each block should have unique question IDs)
 */
export function getTemplateQuestions(templateId: string): CheckInQuestion[] | null {
  const template = getTemplate(templateId);
  if (!template) return null;

  return template.questions.map((q) => ({
    ...q,
    id: uuid(), // Fresh UUID for each use
  }));
}
