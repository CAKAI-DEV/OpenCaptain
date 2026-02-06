/**
 * Linear integration module.
 * Provides bidirectional sync between BlockBot tasks and Linear issues.
 */

// Client functions
export {
  createLinearClient,
  createLinearIssue,
  getLinearIssue,
  getLinearTeams,
  getLinearTeamStates,
  LinearRateLimitError,
  updateLinearIssue,
} from './linear.client';

// Sync functions
export {
  getLinearIntegration,
  getLinearSyncMetadata,
  syncFromLinear,
  syncTaskToLinear,
} from './linear.sync';

// Webhook handler
export { handleLinearWebhook, verifyLinearWebhook } from './linear.webhooks';

// Types
export type {
  LinearConfig,
  LinearIssueData,
  LinearIssueResult,
  LinearStatusMapping,
  LinearSyncMetadata,
  LinearWebhookPayload,
  SyncResult,
  SyncToLinearOptions,
} from './linear.types';

export { DEFAULT_STATUS_MAPPINGS, LINEAR_TO_PRIORITY, PRIORITY_TO_LINEAR } from './linear.types';
