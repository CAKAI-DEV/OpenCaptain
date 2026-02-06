/**
 * Coding agent module exports.
 */
export { codingAgentQueue } from './coding-agent.queue';
export {
  getCodingRequestStatus,
  getLatestCodingRequestForTask,
  isGitHubAppConfigured,
  processCodingRequest,
  requestCodingFix,
} from './coding-agent.service';
export type {
  CodingAgentJobData,
  CodingAgentResult,
  CodingRequest,
  CodingRequestStatus,
  RequestCodingFixInput,
} from './coding-agent.types';
