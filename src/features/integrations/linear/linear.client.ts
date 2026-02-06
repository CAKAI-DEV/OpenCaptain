/**
 * Linear API client wrapper with typed methods.
 */
import { LinearClient } from '@linear/sdk';
import { logger } from '../../../shared/lib/logger';
import { type LinearIssueResult, PRIORITY_TO_LINEAR } from './linear.types';

/**
 * Creates a new Linear client with the given API key.
 */
export function createLinearClient(apiKey: string): LinearClient {
  return new LinearClient({ apiKey });
}

/**
 * Creates a new issue in Linear.
 */
export async function createLinearIssue(
  client: LinearClient,
  params: {
    teamId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    stateId?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  }
): Promise<LinearIssueResult> {
  try {
    const result = await client.createIssue({
      teamId: params.teamId,
      title: params.title,
      description: params.description,
      assigneeId: params.assigneeId,
      stateId: params.stateId,
      priority: params.priority ? PRIORITY_TO_LINEAR[params.priority] : undefined,
    });

    if (!result.success) {
      throw new Error('Failed to create Linear issue');
    }

    const issue = await result.issue;
    if (!issue) {
      throw new Error('Issue created but could not be retrieved');
    }

    logger.info({ issueId: issue.id, identifier: issue.identifier }, 'Created Linear issue');

    return {
      id: issue.id,
      identifier: issue.identifier,
      url: issue.url,
    };
  } catch (error) {
    // Handle rate limiting
    if (error instanceof Error && error.message.includes('rate limit')) {
      logger.warn({ error }, 'Linear API rate limit reached');
      throw new LinearRateLimitError('Rate limit exceeded', getRetryAfter(error));
    }
    throw error;
  }
}

/**
 * Updates an existing issue in Linear.
 */
export async function updateLinearIssue(
  client: LinearClient,
  issueId: string,
  updates: {
    title?: string;
    description?: string;
    stateId?: string;
    assigneeId?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  }
): Promise<boolean> {
  try {
    const result = await client.updateIssue(issueId, {
      title: updates.title,
      description: updates.description,
      stateId: updates.stateId,
      assigneeId: updates.assigneeId,
      priority: updates.priority ? PRIORITY_TO_LINEAR[updates.priority] : undefined,
    });

    if (result.success) {
      logger.info({ issueId }, 'Updated Linear issue');
    }

    return result.success;
  } catch (error) {
    // Handle rate limiting
    if (error instanceof Error && error.message.includes('rate limit')) {
      logger.warn({ error }, 'Linear API rate limit reached');
      throw new LinearRateLimitError('Rate limit exceeded', getRetryAfter(error));
    }
    throw error;
  }
}

/**
 * Gets an issue from Linear by ID.
 */
export async function getLinearIssue(
  client: LinearClient,
  issueId: string
): Promise<{
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: { id: string; name: string };
  priority: number;
  updatedAt: Date;
} | null> {
  try {
    const issue = await client.issue(issueId);
    if (!issue) {
      return null;
    }

    const state = await issue.state;

    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? undefined,
      state: state ? { id: state.id, name: state.name } : { id: '', name: 'Unknown' },
      priority: issue.priority,
      updatedAt: issue.updatedAt,
    };
  } catch (error) {
    logger.error({ error, issueId }, 'Failed to get Linear issue');
    return null;
  }
}

/**
 * Gets workflow states for a Linear team.
 * Used to build status mappings.
 */
export async function getLinearTeamStates(
  client: LinearClient,
  teamId: string
): Promise<Array<{ id: string; name: string; type: string }>> {
  try {
    const team = await client.team(teamId);
    const states = await team.states();

    return states.nodes.map((state) => ({
      id: state.id,
      name: state.name,
      type: state.type,
    }));
  } catch (error) {
    logger.error({ error, teamId }, 'Failed to get Linear team states');
    return [];
  }
}

/**
 * Gets teams accessible by the API key.
 */
export async function getLinearTeams(
  client: LinearClient
): Promise<Array<{ id: string; key: string; name: string }>> {
  try {
    const teams = await client.teams();
    return teams.nodes.map((team) => ({
      id: team.id,
      key: team.key,
      name: team.name,
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to get Linear teams');
    return [];
  }
}

/**
 * Custom error for rate limiting with retry information.
 */
export class LinearRateLimitError extends Error {
  retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'LinearRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Extracts retry-after value from error (default 60 seconds if not found).
 */
function getRetryAfter(error: Error): number {
  // Linear typically returns retry info in error message or headers
  const match = error.message.match(/(\d+)\s*(seconds?|ms)/i);
  if (match && match[1] && match[2]) {
    const value = Number.parseInt(match[1], 10);
    return match[2].toLowerCase().startsWith('ms') ? value : value * 1000;
  }
  return 60000; // Default 60 seconds
}
