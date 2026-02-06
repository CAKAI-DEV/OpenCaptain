/**
 * GitHub App integration types.
 */

/**
 * Configuration for GitHub App authentication.
 */
export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  installationId: number;
}

/**
 * Linked GitHub repository for a project.
 */
export interface LinkedRepo {
  id: string;
  projectId: string;
  owner: string;
  repo: string;
  installationId: number;
  createdAt: Date;
}

/**
 * Result of creating a pull request.
 */
export interface PullRequestResult {
  number: number;
  url: string;
  state: string;
  htmlUrl: string;
}

/**
 * Result of creating a branch.
 */
export interface BranchResult {
  ref: string;
  sha: string;
}

/**
 * File content from repository.
 */
export interface FileContent {
  path: string;
  content: string;
  sha: string;
  encoding: string;
}

/**
 * Result of updating a file.
 */
export interface FileUpdateResult {
  sha: string;
  commitSha: string;
}
