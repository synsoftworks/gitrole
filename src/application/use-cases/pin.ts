/*
 * Creates a strict repo-local .gitrole policy for the current repository.
 */
import { validateRoleName } from '../../domain/role.js';
import type { PinRepoPolicyDependencies, PinRepoPolicyResult } from '../contracts.js';
import { saveRepoPolicy } from '../repo-policy.js';
import { ProfileNotFoundError } from './role.js';

export class PinRepoPolicyRepositoryContextError extends Error {
  constructor() {
    super('not inside a git repository; pin requires a repo context');
    this.name = 'PinRepoPolicyRepositoryContextError';
  }
}

/**
 * Pins the current repository to a single saved role by creating `.gitrole`.
 *
 * @remarks
 * This command is intentionally strict: it creates a new repo policy when none
 * exists and refuses to merge with or overwrite an existing file.
 *
 * @throws
 * {@link ProfileNotFoundError} when the named role does not exist.
 *
 * @throws
 * {@link PinRepoPolicyRepositoryContextError} when run outside a Git repository.
 */
export async function pinRepoPolicy(
  dependencies: PinRepoPolicyDependencies,
  name: string
): Promise<PinRepoPolicyResult> {
  const roleName = validateRoleName(name);
  const role = await dependencies.roleStore.get(roleName);

  if (!role) {
    throw new ProfileNotFoundError(roleName);
  }

  if (!(await dependencies.repository.isInsideWorkTree())) {
    throw new PinRepoPolicyRepositoryContextError();
  }

  const repoPolicy = {
    version: 1 as const,
    defaultRole: role.name,
    allowedRoles: [role.name]
  };

  await saveRepoPolicy(dependencies.repository, repoPolicy);

  return {
    role,
    repoPolicy
  };
}
