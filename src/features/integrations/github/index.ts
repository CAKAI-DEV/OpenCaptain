/**
 * GitHub integration module exports.
 */
export { createGitHubAppClient, getInstallationToken } from './github.app';
export {
  createBranch,
  createPullRequest,
  getDefaultBranch,
  getFileContent,
  updateFile,
} from './github.client';
export type {
  BranchResult,
  FileContent,
  FileUpdateResult,
  GitHubAppConfig,
  LinkedRepo,
  PullRequestResult,
} from './github.types';
