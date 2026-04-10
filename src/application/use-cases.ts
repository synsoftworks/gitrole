import { matchesIdentity, normalizeRole, type GitIdentity, type Role } from '../domain/role.js';

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

export interface RoleStore {
  list(): Promise<Role[]>;
  get(name: string): Promise<Role | undefined>;
  save(role: Role): Promise<void>;
  remove(name: string): Promise<boolean>;
}

export interface GitConfig {
  getGlobalUserName(): Promise<string | undefined>;
  getGlobalUserEmail(): Promise<string | undefined>;
  setGlobalUserName(name: string): Promise<void>;
  setGlobalUserEmail(email: string): Promise<void>;
}

export interface SshLoadResult {
  ok: boolean;
  message?: string;
}

export interface SshAgent {
  loadKey(path: string): Promise<SshLoadResult>;
}

export interface AppDependencies {
  roleStore: RoleStore;
  gitConfig: GitConfig;
  sshAgent: SshAgent;
}

export interface UseRoleResult {
  role: Role;
  ssh?: SshLoadResult & { path: string };
}

export interface CurrentRoleResult {
  identity: GitIdentity;
  role?: Role;
}

export interface ListRolesResult {
  roles: Role[];
  activeRoleName?: string;
}

/**
 * Creates or updates a saved role definition.
 *
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
 * Applies the selected role to global Git config and optionally loads its SSH key.
 *
 * Git identity changes are the primary operation. SSH key loading is a best-effort
 * follow-up and does not block a successful switch when `ssh-add` fails.
 *
 * @throws {ProfileNotFoundError} When the named role does not exist.
 */
export async function useRole(
  dependencies: AppDependencies,
  name: string
): Promise<UseRoleResult> {
  const role = await dependencies.roleStore.get(name);

  if (!role) {
    throw new ProfileNotFoundError(name);
  }

  await dependencies.gitConfig.setGlobalUserName(role.fullName);
  await dependencies.gitConfig.setGlobalUserEmail(role.email);

  if (!role.sshKeyPath) {
    return { role };
  }

  const ssh = await dependencies.sshAgent.loadKey(role.sshKeyPath);

  return {
    role,
    ssh: {
      ...ssh,
      path: role.sshKeyPath
    }
  };
}

/**
 * Reads the current global Git identity and resolves it to a saved role when
 * both name and email match exactly.
 */
export async function getCurrentRole(
  dependencies: AppDependencies
): Promise<CurrentRoleResult> {
  const [roles, fullName, email] = await Promise.all([
    dependencies.roleStore.list(),
    dependencies.gitConfig.getGlobalUserName(),
    dependencies.gitConfig.getGlobalUserEmail()
  ]);

  const identity = { fullName, email };
  const role = roles.find((candidate) => matchesIdentity(candidate, identity));

  return { identity, role };
}

/**
 * Lists all saved roles and marks which one is currently active, if any.
 */
export async function listRoles(
  dependencies: AppDependencies
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
 * @throws {ProfileNotFoundError} When the named role does not exist.
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
