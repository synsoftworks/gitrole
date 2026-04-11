import { type RemoteUseDependencies, type RemoteUseResult } from '../contracts.js';
import { ProfileNotFoundError } from './role.js';

export class RoleMissingGithubHostError extends Error {
  constructor(name: string) {
    super(`role "${name}" does not define githubHost`);
    this.name = 'RoleMissingGithubHostError';
  }
}

export class OriginRemoteNotConfiguredError extends Error {
  constructor() {
    super('origin remote is not configured');
    this.name = 'OriginRemoteNotConfiguredError';
  }
}

export class UnsupportedRemoteRewriteError extends Error {
  constructor() {
    super('origin remote could not be rewritten because its owner/repository could not be determined');
    this.name = 'UnsupportedRemoteRewriteError';
  }
}

/**
 * Rewrites the `origin` remote to use the selected role's SSH host alias while
 * preserving the observed repository owner and name.
 *
 * @throws {ProfileNotFoundError} When the named role does not exist.
 * @throws {RoleMissingGithubHostError} When the role does not define a GitHub host alias.
 * @throws {OriginRemoteNotConfiguredError} When the repository has no `origin`.
 * @throws {UnsupportedRemoteRewriteError} When the current remote cannot be parsed.
 */
export async function useRemoteForRole(
  dependencies: RemoteUseDependencies,
  name: string
): Promise<RemoteUseResult> {
  const role = await dependencies.roleStore.get(name);

  if (!role) {
    throw new ProfileNotFoundError(name);
  }

  if (!role.githubHost) {
    throw new RoleMissingGithubHostError(name);
  }

  const previousUrl = await dependencies.repository.getOriginUrl();

  if (!previousUrl) {
    throw new OriginRemoteNotConfiguredError();
  }

  const remote = await dependencies.repository.getOriginRemote();

  if (!remote || !remote.owner || !remote.repository) {
    throw new UnsupportedRemoteRewriteError();
  }

  const nextUrl = `git@${role.githubHost}:${remote.owner}/${remote.repository}.git`;

  await dependencies.repository.setOriginUrl(nextUrl);

  return {
    role,
    previousUrl,
    nextUrl
  };
}
