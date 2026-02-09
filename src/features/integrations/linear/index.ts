/**
 * Linear integration module.
 * Provides bidirectional sync between BlockBot tasks and Linear issues.
 */

// Client functions
export {
  createLinearClient,
  createLinearIssue,
  getLinearIssue,
  getLinearTeamStates,
  getLinearTeams,
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
// Webhook handler
export { handleLinearWebhook, verifyLinearWebhook } from './linear.webhooks';
