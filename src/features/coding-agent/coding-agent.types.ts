/**
 * Coding agent types.
 */

/**
 * Status of a coding request.
 */
export type CodingRequestStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * A coding fix request.
 */
export interface CodingRequest {
  id: string;
  taskId: string;
  linkedRepoId: string;
  authorizedById: string;
  description: string;
  status: CodingRequestStatus;
  branchName: string | null;
  prNumber: number | null;
  prUrl: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of a coding agent operation.
 */
export interface CodingAgentResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

/**
 * Input for requesting a coding fix.
 */
export interface RequestCodingFixInput {
  taskId: string;
  description: string;
  authorizedById: string;
}

/**
 * Job data for the coding agent worker.
 */
export interface CodingAgentJobData {
  requestId: string;
}
