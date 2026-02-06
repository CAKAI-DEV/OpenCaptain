/**
 * Linear integration types for bidirectional sync.
 */

/**
 * Configuration for a project's Linear integration.
 */
export interface LinearConfig {
  apiKey: string;
  teamId: string;
  enabled: boolean;
  statusMappings?: LinearStatusMapping[];
}

/**
 * Maps BlockBot status to Linear workflow state.
 */
export interface LinearStatusMapping {
  blockbotStatus: 'todo' | 'in_progress' | 'done';
  linearStateId: string;
  linearStateName: string;
}

/**
 * Default status mappings (Linear team-specific state IDs filled at runtime).
 */
export const DEFAULT_STATUS_MAPPINGS: Omit<LinearStatusMapping, 'linearStateId'>[] = [
  { blockbotStatus: 'todo', linearStateName: 'Backlog' },
  { blockbotStatus: 'in_progress', linearStateName: 'In Progress' },
  { blockbotStatus: 'done', linearStateName: 'Done' },
];

/**
 * Maps BlockBot priority to Linear priority.
 * Linear uses 0-4: 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
 */
export const PRIORITY_TO_LINEAR: Record<string, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

/**
 * Maps Linear priority back to BlockBot priority.
 */
export const LINEAR_TO_PRIORITY: Record<number, string> = {
  0: 'medium', // No priority -> medium
  1: 'urgent',
  2: 'high',
  3: 'medium',
  4: 'low',
};

/**
 * Sync metadata stored on tasks for Linear correlation.
 */
export interface LinearSyncMetadata {
  linearIssueId: string;
  linearTeamId: string;
  lastSyncedAt: Date;
  syncDirection: 'to_linear' | 'from_linear' | 'bidirectional';
}

/**
 * Linear webhook payload structure.
 * See: https://linear.app/developers/webhooks
 */
export interface LinearWebhookPayload {
  action: 'create' | 'update' | 'remove';
  type: string;
  data: LinearIssueData;
  updatedFrom?: Partial<LinearIssueData>;
  webhookTimestamp: number;
  webhookId: string;
  organizationId: string;
  url?: string;
}

/**
 * Linear issue data from webhook payload.
 */
export interface LinearIssueData {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  state: {
    id: string;
    name: string;
    type: string;
  };
  assignee?: {
    id: string;
    email: string;
    name: string;
  };
  team: {
    id: string;
    key: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  url: string;
}

/**
 * Result of creating a Linear issue.
 */
export interface LinearIssueResult {
  id: string;
  identifier: string;
  url: string;
}

/**
 * Options for syncing a task to Linear.
 */
export interface SyncToLinearOptions {
  skipLinearSync?: boolean;
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  success: boolean;
  linearIssueId?: string;
  error?: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
}
