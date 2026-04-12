/*
 * Implements role creation, activation, lookup, and removal workflows.
 */
import { matchesIdentity, normalizeRole, type Role } from '../../domain/role.js';
import {
  type AppDependencies,
  type CurrentRoleDependencies,
  type CurrentRoleResult,
  type ListRolesResult,
  type UseRoleDependencies,
  type UseRoleOptions,
  type UseRoleResult
} from '../contracts.js';
import { maybeAssessRoleAlignment } from './diagnosis.js';

export class ProfileNotFoundError extends Error {
  constructor(name: string) {
    super(`role "${name}" was not found`);
    this.name = 'ProfileNotFoundError';
  }
}

export class GitNotInstalledError extends Error {
  constructor() {
    super('git is not installed or not available on PATH');
    this.name = 'GitNotInstalledError';
  }
}

export class NotInGitRepositoryError extends Error {
  constructor() {
    super('not inside a git repository; --local requires a repo context');
    this.name = 'NotInGitRepositoryError';
  }
}

/**
 * Creates or updates a saved role definition.
 *
 * @remarks
 * The role is normalized before storage so whitespace does not produce duplicate
 * or surprising values in the persisted config.
 */
export async function addRole(
  dependencies: AppDependencies,
  input: Role
): Promise<Role> {
  const role = normalizeRole(input);

  await dependencies.roleStore.save(role);

  return role;
}

/**
 * Applies the selected role to Git config and optionally loads its SSH key.
 *
 * @remarks
 * Git identity changes are the primary operation. SSH key loading is a best-effort
 * follow-up and does not block a successful switch when `ssh-add` fails.
 *
 * When `scope` is `local`, the selected role is applied to the current repository
 * only. Without a scope option, the existing global behavior is preserved.
 *
 * @throws
 * {@link ProfileNotFoundError} when the named role does not exist.
 *
 * @throws
 * {@link NotInGitRepositoryError} when `scope` is `local` outside a Git repository.
 */
export async function useRole(
  dependencies: UseRoleDependencies,
  name: string,
  options: UseRoleOptions = {}
): Promise<UseRoleResult> {
  const role = await dependencies.roleStore.get(name);
  const scope = options.scope ?? 'global';

  if (!role) {
    throw new ProfileNotFoundError(name);
  }

  if (scope === 'local') {
    if (!dependencies.repository || !(await dependencies.repository.isInsideWorkTree())) {
      throw new NotInGitRepositoryError();
    }

    await dependencies.repository.setLocalUserName(role.fullName);
    await dependencies.repository.setLocalUserEmail(role.email);
  } else {
    await dependencies.gitConfig.setGlobalUserName(role.fullName);
    await dependencies.gitConfig.setGlobalUserEmail(role.email);
  }

  const alignment = await assessRoleAlignmentSafely(dependencies, role);

  if (!role.sshKeyPath) {
    return {
      role,
      scope,
      alignment
    };
  }

  const ssh = await dependencies.sshAgent.loadKey(role.sshKeyPath);

  return {
    role,
    scope,
    ssh: {
      ...ssh,
      path: role.sshKeyPath
    },
    alignment
  };
}

async function assessRoleAlignmentSafely(
  dependencies: UseRoleDependencies,
  role: Role
): Promise<UseRoleResult['alignment']> {
  try {
    return await maybeAssessRoleAlignment(dependencies, role);
  } catch {
    return undefined;
  }
}

/**
 * Reads the effective Git identity for the current context and resolves it to a
 * saved role when both name and email match exactly.
 *
 * @remarks
 * When repository-local overrides are available, they take precedence over the
 * global identity because they are what Git will actually use for commits in
 * the current repository.
 */
export async function getCurrentRole(
  dependencies: CurrentRoleDependencies
): Promise<CurrentRoleResult> {
  const [roles, globalName, globalEmail, localName, localEmail] = await Promise.all([
    dependencies.roleStore.list(),
    dependencies.gitConfig.getGlobalUserName(),
    dependencies.gitConfig.getGlobalUserEmail(),
    dependencies.repository?.getLocalUserName(),
    dependencies.repository?.getLocalUserEmail()
  ]);

  const identity = {
    fullName: localName ?? globalName,
    email: localEmail ?? globalEmail
  };
  const role = roles.find((candidate) => matchesIdentity(candidate, identity));

  return { identity, role };
}

/**
 * Lists all saved roles and marks which one is currently active, if any.
 */
export async function listRoles(
  dependencies: CurrentRoleDependencies
): Promise<ListRolesResult> {
  const [roles, current] = await Promise.all([
    dependencies.roleStore.list(),
    getCurrentRole(dependencies)
  ]);

  return {
    roles,
    activeRoleName: current.role?.name
  };
}

/**
 * Deletes a saved role definition without changing the active Git config.
 *
 * @throws
 * {@link ProfileNotFoundError} when the named role does not exist.
 */
export async function removeRole(
  dependencies: AppDependencies,
  name: string
): Promise<Role> {
  const role = await dependencies.roleStore.get(name);

  if (!role) {
    throw new ProfileNotFoundError(name);
  }

  await dependencies.roleStore.remove(name);

  return role;
}
