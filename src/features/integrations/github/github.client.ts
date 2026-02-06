/**
 * GitHub client operations for repository management and PR creation.
 */
import type { Octokit } from '@octokit/rest';
import type {
  BranchResult,
  FileContent,
  FileUpdateResult,
  PullRequestResult,
} from './github.types';

/**
 * Creates a new branch from an existing branch.
 *
 * @param octokit - Authenticated Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param baseBranch - Base branch to branch from
 * @param newBranch - Name of the new branch
 * @returns Branch creation result
 */
export async function createBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  baseBranch: string,
  newBranch: string
): Promise<BranchResult> {
  // Get the SHA of the base branch
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });

  // Create the new branch
  const { data: newRef } = await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: ref.object.sha,
  });

  return {
    ref: newRef.ref,
    sha: newRef.object.sha,
  };
}

/**
 * Gets the content of a file from the repository.
 *
 * @param octokit - Authenticated Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path in the repository
 * @param ref - Branch, tag, or commit SHA (optional, defaults to default branch)
 * @returns File content
 */
export async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<FileContent> {
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });

  // Ensure we got a file, not a directory
  if (Array.isArray(data) || data.type !== 'file') {
    throw new Error(`Path ${path} is not a file`);
  }

  return {
    path: data.path,
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
    encoding: data.encoding,
  };
}

/**
 * Updates a file in the repository.
 *
 * @param octokit - Authenticated Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path in the repository
 * @param content - New file content
 * @param message - Commit message
 * @param sha - SHA of the file being replaced
 * @param branch - Branch to commit to
 * @returns File update result
 */
export async function updateFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha: string,
  branch: string
): Promise<FileUpdateResult> {
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString('base64'),
    sha,
    branch,
  });

  return {
    sha: data.content?.sha ?? '',
    commitSha: data.commit.sha ?? '',
  };
}

/**
 * Creates a pull request.
 * By default, creates as a draft PR for human review.
 *
 * @param octokit - Authenticated Octokit client
 * @param params - Pull request parameters
 * @returns Pull request result
 */
export async function createPullRequest(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;
    base: string;
    draft?: boolean;
  }
): Promise<PullRequestResult> {
  const { data } = await octokit.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base,
    draft: params.draft ?? true, // Default to draft PR for safety
  });

  return {
    number: data.number,
    url: data.url,
    state: data.state,
    htmlUrl: data.html_url,
  };
}

/**
 * Gets the default branch of a repository.
 *
 * @param octokit - Authenticated Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Default branch name
 */
export async function getDefaultBranch(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string> {
  const { data } = await octokit.repos.get({
    owner,
    repo,
  });

  return data.default_branch;
}
