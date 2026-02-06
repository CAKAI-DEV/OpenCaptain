/**
 * GitHub App authentication.
 * Uses @octokit/auth-app for installation token generation.
 *
 * CRITICAL: Generate fresh token per operation, don't cache.
 * Installation tokens expire in 1 hour per GitHub docs.
 */
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import type { GitHubAppConfig } from './github.types';

/**
 * Generates an installation access token for the GitHub App.
 * Each token is valid for 1 hour.
 *
 * @param config - GitHub App configuration
 * @returns Installation access token
 */
export async function getInstallationToken(config: GitHubAppConfig): Promise<string> {
  const auth = createAppAuth({
    appId: config.appId,
    privateKey: config.privateKey,
    installationId: config.installationId,
  });

  const { token } = await auth({ type: 'installation' });
  return token;
}

/**
 * Creates an authenticated Octokit client for a GitHub App installation.
 * Generates a fresh token for each call - do not cache the client.
 *
 * @param config - GitHub App configuration
 * @returns Authenticated Octokit client
 */
export async function createGitHubAppClient(config: GitHubAppConfig): Promise<Octokit> {
  const token = await getInstallationToken(config);
  return new Octokit({ auth: token });
}
